/**
 * Unit tests — sendPxUploadReminderNow (Task-130, manual on-demand reminder).
 *
 * Locks in:
 *   - Picks 'first' then 'final' based on which idempotency flag is unset.
 *   - Refuses with INVALID_STATE when the link is missing, expired, consumed,
 *     the upload has already arrived, or both reminders have already gone out.
 *   - On Delivered, flips the matching idempotency flag (so the cron sweep
 *     won't double-send) and stamps order.updated_at.
 *   - On Bounced/Failed, leaves both flags unset.
 *   - Audits the staff actor_id passed by the route (not 'system').
 *
 * Plus an integration-style test that runs sendPxUploadReminders after a
 * manual send and confirms the cron sweep skips the same order.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Order } from '../../types';

vi.mock('../../constants', async () => {
  const actual = await vi.importActual<typeof import('../../constants')>('../../constants');
  return { ...actual, NOW: '2026-05-11T08:00:00Z' };
});

// sendPxUploadReminderNow lives in the same module as the email helper it
// invokes, so spying on the namespace export doesn't intercept the internal
// call. Mock Postmark instead — it's the boundary the email helper crosses.
const postmarkResult: {
  current: { status: 'Delivered' | 'Bounced' | 'Failed'; message_id: string | null; error_message: string | null };
} = { current: { status: 'Delivered', message_id: 'mock-msg', error_message: null } };

vi.mock('@/lib/integrations/postmark', () => ({
  sendPatientEmail: vi.fn(async () => postmarkResult.current),
  sendStaffEmail:   vi.fn(async () => postmarkResult.current),
}));

import { sendPxUploadReminders } from '../sendPxUploadReminders';
import { MOCK_ORDERS, sendPxUploadReminderNow } from '../../fixtures/orders';
import { MOCK_PATIENTS } from '../../fixtures/patients';
import { APIError } from '../../constants';

const CLINIC = 'feeltru' as const;
const NOW = '2026-05-11T08:00:00Z';
const NOW_MS = new Date(NOW).getTime();
const HOUR = 60 * 60 * 1000;
const ACTOR = { user_id: 'usr-staff-manual' };

let ordersSnapshot: Order[];

function snapshotOrders() {
  ordersSnapshot = MOCK_ORDERS.map((o) => structuredClone(o));
}
function restoreOrders() {
  MOCK_ORDERS.splice(0, MOCK_ORDERS.length, ...ordersSnapshot.map((o) => structuredClone(o)));
}

function seedOrder(opts: {
  id: string;
  sentHoursAgo: number | null;
  expiresInHours: number;
  consumed?: boolean;
  uploaded?: boolean;
  reminderFlag?: string | null;
  finalReminderFlag?: string | null;
  noLink?: boolean;
  noPatientEmail?: boolean;
}): Order {
  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === CLINIC)!;
  const order: Order = {
    id: opts.id,
    clinic_id: CLINIC,
    patient_id: patient.id,
    type: 'new',
    status: 'clinical_check',
    product: { medication: 'Mounjaro', dose: '2.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
    questionnaire_responses: {},
    amendment_window: 'pre_approval',
    primed_order_id: null,
    primed_clinical_check_completed: false,
    ryft_authorisation_id: null,
    amount_charged: null,
    amount_authorised: 149,
    clinical_decision: null,
    sla_warn_at: '2026-05-12T08:00:00Z',
    sla_breach_at: '2026-05-13T08:00:00Z',
    g6_flags: [],
    contextual_flags: ['Px upload pending'],
    intervention_raised_at: null,
    px_upload: opts.uploaded
      ? { filename: 'rx.pdf', size: 1000, content_type: 'application/pdf', uploaded_at: '2026-05-10T08:00:00Z', object_path: '/x' }
      : null,
    px_upload_link: opts.noLink
      ? null
      : {
          token: `tok-${opts.id}`,
          expires_at: new Date(NOW_MS + opts.expiresInHours * HOUR).toISOString(),
          sent_at: opts.sentHoursAgo == null ? null : new Date(NOW_MS - opts.sentHoursAgo * HOUR).toISOString(),
          consumed_at: opts.consumed ? '2026-05-10T08:00:00Z' : null,
          email_message_id: 'mock-id',
          to_email: opts.noPatientEmail ? null : 'patient@example.com',
          reminder_sent_at: opts.reminderFlag ?? null,
          final_reminder_sent_at: opts.finalReminderFlag ?? null,
        },
    expired_at: null,
    created_at: '2026-05-05T08:00:00Z',
    updated_at: '2026-05-05T08:00:00Z',
  };
  MOCK_ORDERS.push(order);
  return order;
}

describe('sendPxUploadReminderNow', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let originalEmails: Map<string, string | null>;

  beforeEach(() => {
    snapshotOrders();
    MOCK_ORDERS.splice(0, MOCK_ORDERS.length);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Pin patient email so the no-email branch is testable in isolation.
    originalEmails = new Map();
    for (const p of MOCK_PATIENTS) {
      if (p.clinic_id !== CLINIC) continue;
      originalEmails.set(p.id, p.contact.email ?? null);
      p.contact.email = 'patient@example.com';
    }
  });

  afterEach(() => {
    restoreOrders();
    for (const p of MOCK_PATIENTS) {
      if (p.clinic_id !== CLINIC) continue;
      if (originalEmails.has(p.id)) {
        p.contact.email = originalEmails.get(p.id) ?? undefined;
      }
    }
    logSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("picks 'first' when no reminder has been sent and flips reminder_sent_at on Delivered", async () => {
    const order = seedOrder({ id: 'ORD-MAN-1', sentHoursAgo: 1, expiresInHours: 13 * 24 });
    const result = await sendPxUploadReminderNow(CLINIC, order.id, ACTOR);
    expect(result.kind).toBe('first');
    expect(result.status).toBe('Delivered');
    const link = MOCK_ORDERS[0]!.px_upload_link!;
    expect(link.reminder_sent_at).toBe(NOW);
    expect(link.final_reminder_sent_at ?? null).toBeNull();
    expect(MOCK_ORDERS[0]!.updated_at).toBe(NOW);
  });

  it("picks 'final' when first has already been sent", async () => {
    const order = seedOrder({
      id: 'ORD-MAN-2',
      sentHoursAgo: 5 * 24,
      expiresInHours: 5 * 24,
      reminderFlag: '2026-05-09T08:00:00Z',
    });
    const result = await sendPxUploadReminderNow(CLINIC, order.id, ACTOR);
    expect(result.kind).toBe('final');
    expect(result.status).toBe('Delivered');
    const link = MOCK_ORDERS[0]!.px_upload_link!;
    expect(link.reminder_sent_at).toBe('2026-05-09T08:00:00Z');
    expect(link.final_reminder_sent_at).toBe(NOW);
  });

  it('refuses (INVALID_STATE) when both reminders have already been sent', async () => {
    const order = seedOrder({
      id: 'ORD-MAN-3',
      sentHoursAgo: 5 * 24,
      expiresInHours: 5 * 24,
      reminderFlag: '2026-05-09T08:00:00Z',
      finalReminderFlag: '2026-05-10T08:00:00Z',
    });
    await expect(sendPxUploadReminderNow(CLINIC, order.id, ACTOR))
      .rejects.toBeInstanceOf(APIError);
  });

  it('refuses when the link is expired', async () => {
    const order = seedOrder({ id: 'ORD-MAN-4', sentHoursAgo: 15 * 24, expiresInHours: -1 });
    await expect(sendPxUploadReminderNow(CLINIC, order.id, ACTOR))
      .rejects.toThrow(/expired/i);
  });

  it('refuses when the upload has already been consumed', async () => {
    const order = seedOrder({ id: 'ORD-MAN-5', sentHoursAgo: 2 * 24, expiresInHours: 5 * 24, consumed: true });
    await expect(sendPxUploadReminderNow(CLINIC, order.id, ACTOR))
      .rejects.toThrow(/already been uploaded/i);
  });

  it('refuses when the upload has already arrived', async () => {
    const order = seedOrder({ id: 'ORD-MAN-6', sentHoursAgo: 2 * 24, expiresInHours: 5 * 24, uploaded: true });
    await expect(sendPxUploadReminderNow(CLINIC, order.id, ACTOR))
      .rejects.toThrow(/already been uploaded/i);
  });

  it('refuses when there is no px_upload_link on the order', async () => {
    const order = seedOrder({ id: 'ORD-MAN-7', sentHoursAgo: null, expiresInHours: 0, noLink: true });
    await expect(sendPxUploadReminderNow(CLINIC, order.id, ACTOR))
      .rejects.toThrow(/does not have a prescription upload link/i);
  });

  it('records the staff actor_id (not "system") in the audit log on attempt and outcome', async () => {
    const order = seedOrder({ id: 'ORD-MAN-8', sentHoursAgo: 1, expiresInHours: 13 * 24 });
    await sendPxUploadReminderNow(CLINIC, order.id, ACTOR);

    const auditCalls = logSpy.mock.calls.filter(
      (c) => c[0] === '[AUDIT]' && typeof c[1] === 'object',
    );
    const events = auditCalls.map((c) => c[1] as Record<string, unknown>);

    const attempt = events.find((e) => e.event_type === 'px_upload_link_manual_reminder_attempt');
    const sent    = events.find((e) => e.event_type === 'px_upload_link_manual_reminder_sent');

    expect(attempt).toBeDefined();
    expect(attempt!.by_user_id).toBe(ACTOR.user_id);
    expect(sent).toBeDefined();
    expect(sent!.by_user_id).toBe(ACTOR.user_id);
    expect(sent!.outcome).toBe('Delivered');
  });

  it('does NOT flip the idempotency flag when delivery fails', async () => {
    postmarkResult.current = {
      status: 'Failed',
      message_id: null,
      error_message: 'Postmark 422: InactiveRecipient',
    };
    try {
      const order = seedOrder({ id: 'ORD-MAN-9', sentHoursAgo: 1, expiresInHours: 13 * 24 });
      const result = await sendPxUploadReminderNow(CLINIC, order.id, ACTOR);
      expect(result.status).toBe('Failed');
      const link = MOCK_ORDERS[0]!.px_upload_link!;
      expect(link.reminder_sent_at ?? null).toBeNull();
      expect(link.final_reminder_sent_at ?? null).toBeNull();
    } finally {
      postmarkResult.current = { status: 'Delivered', message_id: 'mock-msg', error_message: null };
    }
  });
});

describe('sendPxUploadReminderNow ↔ sendPxUploadReminders integration', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let originalEmails: Map<string, string | null>;

  beforeEach(() => {
    snapshotOrders();
    MOCK_ORDERS.splice(0, MOCK_ORDERS.length);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    originalEmails = new Map();
    for (const p of MOCK_PATIENTS) {
      if (p.clinic_id !== CLINIC) continue;
      originalEmails.set(p.id, p.contact.email ?? null);
      p.contact.email = 'patient@example.com';
    }
  });

  afterEach(() => {
    restoreOrders();
    for (const p of MOCK_PATIENTS) {
      if (p.clinic_id !== CLINIC) continue;
      if (originalEmails.has(p.id)) {
        p.contact.email = originalEmails.get(p.id) ?? undefined;
      }
    }
    logSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('cron sweep skips an order whose first-reminder flag was just flipped by the manual button', async () => {
    // Cron-eligible: 49h since send, link still alive — would normally fire 'first'.
    const order = seedOrder({ id: 'ORD-INT-1', sentHoursAgo: 49, expiresInHours: 13 * 24 });

    // Staff hits the manual button first.
    const manual = await sendPxUploadReminderNow(CLINIC, order.id, ACTOR);
    expect(manual.kind).toBe('first');
    expect(manual.status).toBe('Delivered');
    expect(MOCK_ORDERS[0]!.px_upload_link!.reminder_sent_at).toBe(NOW);

    // Cron runs immediately afterwards — must be a no-op for this order.
    const sweep = await sendPxUploadReminders(CLINIC);
    expect(sweep.considered).toBe(0);
    expect(sweep.sent).toHaveLength(0);
    expect(sweep.failed).toHaveLength(0);
  });

  it('cron sweep skips the final-reminder window after a manual final send', async () => {
    const order = seedOrder({
      id: 'ORD-INT-2',
      sentHoursAgo: 13 * 24,
      expiresInHours: 20,
      reminderFlag: '2026-05-09T08:00:00Z',
    });

    const manual = await sendPxUploadReminderNow(CLINIC, order.id, ACTOR);
    expect(manual.kind).toBe('final');
    expect(MOCK_ORDERS[0]!.px_upload_link!.final_reminder_sent_at).toBe(NOW);

    const sweep = await sendPxUploadReminders(CLINIC);
    expect(sweep.considered).toBe(0);
    expect(sweep.sent).toHaveLength(0);
  });
});
