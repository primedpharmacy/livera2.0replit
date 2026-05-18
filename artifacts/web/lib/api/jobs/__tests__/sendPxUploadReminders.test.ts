/**
 * Unit tests — sendPxUploadReminders (Task-92).
 *
 * Pins the reminder windows + idempotency contract:
 *   1. Order < 48h since sent_at → no reminder.
 *   2. Order ≥ 48h since sent_at, not yet reminded → first reminder fires,
 *      `reminder_sent_at` flips, audit logged.
 *   3. Re-running the sweep after a first reminder is a no-op (idempotent).
 *   4. Order within 24h of expires_at → final reminder fires,
 *      `final_reminder_sent_at` flips.
 *   5. Orders that already received an upload (consumed_at or px_upload set)
 *      are skipped, regardless of timing.
 *   6. Already-expired links are skipped (a separate job retires them).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Order } from '../../types';

vi.mock('../../constants', async () => {
  const actual = await vi.importActual<typeof import('../../constants')>('../../constants');
  return { ...actual, NOW: '2026-05-11T08:00:00Z' };
});

import { sendPxUploadReminders } from '../sendPxUploadReminders';
import { MOCK_ORDERS } from '../../fixtures/orders';
import { MOCK_PATIENTS } from '../../fixtures/patients';

const CLINIC = 'feeltru' as const;
const NOW_MS = new Date('2026-05-11T08:00:00Z').getTime();
const HOUR = 60 * 60 * 1000;

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
    px_upload_link: {
      token: `tok-${opts.id}`,
      expires_at: new Date(NOW_MS + opts.expiresInHours * HOUR).toISOString(),
      sent_at: opts.sentHoursAgo == null ? null : new Date(NOW_MS - opts.sentHoursAgo * HOUR).toISOString(),
      consumed_at: opts.consumed ? '2026-05-10T08:00:00Z' : null,
      email_message_id: 'mock-id',
      to_email: 'patient@example.com',
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

describe('sendPxUploadReminders', () => {
  beforeEach(() => {
    snapshotOrders();
    // wipe orders for a clean slate — restored in afterEach.
    MOCK_ORDERS.splice(0, MOCK_ORDERS.length);
  });

  afterEach(() => {
    restoreOrders();
  });

  it('skips orders < 48h since sent_at', async () => {
    seedOrder({ id: 'ORD-A', sentHoursAgo: 12, expiresInHours: 13 * 24 });
    const result = await sendPxUploadReminders(CLINIC);
    expect(result.considered).toBe(0);
    expect(result.sent).toHaveLength(0);
    const link = MOCK_ORDERS[0]!.px_upload_link!;
    expect(link.reminder_sent_at ?? null).toBeNull();
  });

  it('sends first reminder ≥48h after sent_at and flips reminder_sent_at', async () => {
    seedOrder({ id: 'ORD-B', sentHoursAgo: 49, expiresInHours: 13 * 24 });
    const result = await sendPxUploadReminders(CLINIC);
    expect(result.considered).toBe(1);
    expect(result.sent).toHaveLength(1);
    expect(result.sent[0]!.kind).toBe('first');
    expect(MOCK_ORDERS[0]!.px_upload_link!.reminder_sent_at).toBe('2026-05-11T08:00:00Z');
  });

  it('is idempotent — second sweep does not re-send the first reminder', async () => {
    seedOrder({ id: 'ORD-C', sentHoursAgo: 49, expiresInHours: 13 * 24 });
    await sendPxUploadReminders(CLINIC);
    const second = await sendPxUploadReminders(CLINIC);
    expect(second.considered).toBe(0);
    expect(second.sent).toHaveLength(0);
  });

  it('sends final reminder within 24h of expires_at and flips final_reminder_sent_at', async () => {
    seedOrder({
      id: 'ORD-D',
      sentHoursAgo: 13 * 24,
      expiresInHours: 20,             // <24h to expiry
      reminderFlag: '2026-05-09T08:00:00Z', // first already sent
    });
    const result = await sendPxUploadReminders(CLINIC);
    expect(result.sent).toHaveLength(1);
    expect(result.sent[0]!.kind).toBe('final');
    expect(MOCK_ORDERS[0]!.px_upload_link!.final_reminder_sent_at).toBe('2026-05-11T08:00:00Z');
  });

  it('skips orders that already received an upload', async () => {
    seedOrder({ id: 'ORD-E', sentHoursAgo: 72, expiresInHours: 10 * 24, uploaded: true });
    seedOrder({ id: 'ORD-F', sentHoursAgo: 72, expiresInHours: 10 * 24, consumed: true });
    const result = await sendPxUploadReminders(CLINIC);
    expect(result.considered).toBe(0);
    expect(result.sent).toHaveLength(0);
  });

  it('skips already-expired links', async () => {
    seedOrder({ id: 'ORD-G', sentHoursAgo: 15 * 24, expiresInHours: -1 });
    const result = await sendPxUploadReminders(CLINIC);
    expect(result.considered).toBe(0);
    expect(result.sent).toHaveLength(0);
  });

  it('skips orders whose initial email never landed (sent_at null)', async () => {
    seedOrder({ id: 'ORD-H', sentHoursAgo: null, expiresInHours: 13 * 24 });
    const result = await sendPxUploadReminders(CLINIC);
    expect(result.considered).toBe(0);
  });
});
