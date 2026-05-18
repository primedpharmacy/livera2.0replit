/**
 * Unit tests — retryFailedPxUploadReminder (Task-179).
 *
 * The retry helper is the staff-driven counterpart to the daily cron's
 * failure-recording path (Task-129). Where the cron blindly retries a
 * Bounced/Failed reminder on the same address day after day, this helper
 * lets staff supply a corrected recipient and resend immediately, then:
 *
 *   - on Delivered → flip the matching idempotency flag (reminder_sent_at
 *     or final_reminder_sent_at) so the cron skips this order, and persist
 *     the corrected `to_email` on the link so future sweeps target it too;
 *   - on Bounced/Failed → append a fresh `reminder_failures` row with the
 *     new error message (no flag flip) so the timeline shows the new
 *     attempt and staff can iterate.
 *
 * Refusal contract:
 *   - no order / no link / consumed / expired
 *   - no prior failure of the requested kind to retry
 *   - the matching idempotency flag is already set
 *   - invalid recipient email
 *
 * These tests pin those behaviours so a future refactor cannot silently
 * regress the manual retry path (which sits outside the cron's coverage).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Order } from '../../types';

vi.mock('../../constants', async () => {
  const actual = await vi.importActual<typeof import('../../constants')>('../../constants');
  return { ...actual, NOW: '2026-05-12T09:00:00Z' };
});

import { retryFailedPxUploadReminder, MOCK_ORDERS } from '../orders';
import * as postmark from '../../../integrations/postmark';

const CLINIC = 'feeltru' as const;
const NOW_MS = new Date('2026-05-12T09:00:00Z').getTime();
const HOUR = 60 * 60 * 1000;
const ORDER_ID = 'ORD-RETRY-TEST';

let ordersSnapshot: Order[];

function snapshotOrders() {
  ordersSnapshot = MOCK_ORDERS.map((o) => structuredClone(o));
}
function restoreOrders() {
  MOCK_ORDERS.splice(0, MOCK_ORDERS.length, ...ordersSnapshot.map((o) => structuredClone(o)));
}

type SeedOpts = {
  expiresInHours?: number;
  consumed?: boolean;
  uploaded?: boolean;
  reminderSentAt?: string | null;
  finalReminderSentAt?: string | null;
  failures?: Array<{ kind: 'first' | 'final'; to_email?: string; status?: 'Bounced' | 'Failed' }>;
};

function seedOrder(opts: SeedOpts = {}): Order {
  const failures = (opts.failures ?? [{ kind: 'first' as const }]).map((f) => ({
    kind: f.kind,
    attempted_at: '2026-05-11T08:00:00Z',
    to_email: f.to_email ?? 'wrong@example.com',
    status: f.status ?? ('Bounced' as const),
    error_message: 'Postmark hard-bounce: mailbox does not exist',
  }));
  // Pick a real fixture patient so the helper's MOCK_PATIENTS lookup succeeds.
  const patient_id = 'PT-00198';
  const order: Order = {
    id: ORDER_ID,
    clinic_id: CLINIC,
    patient_id,
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
    sla_warn_at: '2026-05-13T08:00:00Z',
    sla_breach_at: '2026-05-14T08:00:00Z',
    g6_flags: [],
    contextual_flags: ['Px upload pending'],
    intervention_raised_at: null,
    px_upload: opts.uploaded
      ? {
          filename: 'rx.pdf',
          size: 1000,
          content_type: 'application/pdf',
          uploaded_at: '2026-05-10T08:00:00Z',
          object_path: '/x',
        }
      : null,
    px_upload_link: {
      token: `tok-${ORDER_ID}`,
      expires_at: new Date(NOW_MS + (opts.expiresInHours ?? 48) * HOUR).toISOString(),
      sent_at: '2026-05-05T08:00:00Z',
      consumed_at: opts.consumed ? '2026-05-10T08:00:00Z' : null,
      email_message_id: 'mock-id',
      to_email: 'wrong@example.com',
      reminder_sent_at: opts.reminderSentAt ?? null,
      final_reminder_sent_at: opts.finalReminderSentAt ?? null,
      reminder_failures: failures,
    },
    expired_at: null,
    created_at: '2026-05-01T08:00:00Z',
    updated_at: '2026-05-05T08:00:00Z',
  };
  MOCK_ORDERS.push(order);
  return order;
}

describe('retryFailedPxUploadReminder', () => {
  beforeEach(() => {
    snapshotOrders();
    MOCK_ORDERS.splice(0, MOCK_ORDERS.length);
  });

  afterEach(() => {
    restoreOrders();
    vi.restoreAllMocks();
  });

  it('on success flips reminder_sent_at, updates link.to_email, and bumps updated_at', async () => {
    seedOrder();
    const result = await retryFailedPxUploadReminder(
      CLINIC,
      ORDER_ID,
      { kind: 'first', to_email: 'fixed@example.com' },
      { user_id: 'user_qadir' },
    );

    expect(result.status).toBe('Delivered');
    expect(result.kind).toBe('first');
    expect(result.message_id).toBeTruthy();

    const link = MOCK_ORDERS[0]!.px_upload_link!;
    expect(link.reminder_sent_at).toBe('2026-05-12T09:00:00Z');
    expect(link.to_email).toBe('fixed@example.com');
    // No new failure row appended on success.
    expect(link.reminder_failures).toHaveLength(1);
    expect(MOCK_ORDERS[0]!.updated_at).toBe('2026-05-12T09:00:00Z');
  });

  it('flips final_reminder_sent_at when kind=final', async () => {
    seedOrder({ failures: [{ kind: 'final' }] });
    const result = await retryFailedPxUploadReminder(
      CLINIC,
      ORDER_ID,
      { kind: 'final', to_email: 'fixed@example.com' },
      { user_id: 'user_qadir' },
    );

    expect(result.status).toBe('Delivered');
    const link = MOCK_ORDERS[0]!.px_upload_link!;
    expect(link.final_reminder_sent_at).toBe('2026-05-12T09:00:00Z');
    expect(link.reminder_sent_at ?? null).toBeNull();
  });

  it('on a fresh failure appends a new reminder_failures row and leaves the flag unset', async () => {
    seedOrder();
    const spy = vi
      .spyOn(postmark, 'sendPatientEmail')
      .mockResolvedValue({
        status: 'Failed',
        message_id: null,
        error_message: 'Postmark 422: InactiveRecipient',
      });

    const result = await retryFailedPxUploadReminder(
      CLINIC,
      ORDER_ID,
      { kind: 'first', to_email: 'still-bad@example.com' },
      { user_id: 'user_qadir' },
    );

    expect(result.status).toBe('Failed');
    const link = MOCK_ORDERS[0]!.px_upload_link!;
    expect(link.reminder_sent_at ?? null).toBeNull();
    expect(link.reminder_failures).toHaveLength(2);
    expect(link.reminder_failures![1]).toMatchObject({
      kind: 'first',
      attempted_at: '2026-05-12T09:00:00Z',
      to_email: 'still-bad@example.com',
      status: 'Failed',
      error_message: 'Postmark 422: InactiveRecipient',
    });
    // The corrected address is still persisted even on a fresh failure so
    // future cron sweeps target it instead of the original bad address.
    expect(link.to_email).toBe('still-bad@example.com');
    spy.mockRestore();
  });

  it('rejects when the link has already been consumed', async () => {
    seedOrder({ consumed: true });
    await expect(
      retryFailedPxUploadReminder(CLINIC, ORDER_ID, {
        kind: 'first',
        to_email: 'fixed@example.com',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_STATE',
      message: expect.stringContaining('already been uploaded'),
    });
  });

  it('rejects when the link has already expired', async () => {
    seedOrder({ expiresInHours: -1 });
    await expect(
      retryFailedPxUploadReminder(CLINIC, ORDER_ID, {
        kind: 'first',
        to_email: 'fixed@example.com',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_STATE',
      message: expect.stringContaining('expired'),
    });
  });

  it('rejects when there is no prior failure of the requested kind to retry', async () => {
    seedOrder({ failures: [{ kind: 'first' }] });
    await expect(
      retryFailedPxUploadReminder(CLINIC, ORDER_ID, {
        kind: 'final', // no `final` failure recorded
        to_email: 'fixed@example.com',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_STATE',
      message: expect.stringContaining('No failed final reminder'),
    });
  });

  it('rejects when the matching idempotency flag is already set', async () => {
    seedOrder({ reminderSentAt: '2026-05-11T10:00:00Z' });
    await expect(
      retryFailedPxUploadReminder(CLINIC, ORDER_ID, {
        kind: 'first',
        to_email: 'fixed@example.com',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_STATE',
      message: expect.stringContaining('already been delivered'),
    });
  });

  it('rejects an obviously malformed recipient email', async () => {
    seedOrder();
    await expect(
      retryFailedPxUploadReminder(CLINIC, ORDER_ID, {
        kind: 'first',
        to_email: 'not-an-email',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_STATE',
      message: expect.stringContaining('valid recipient email'),
    });
  });

  it('rejects an empty recipient email', async () => {
    seedOrder();
    await expect(
      retryFailedPxUploadReminder(CLINIC, ORDER_ID, {
        kind: 'first',
        to_email: '   ',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_STATE',
      message: expect.stringContaining('valid recipient email'),
    });
  });

  it('rejects when the order does not exist', async () => {
    await expect(
      retryFailedPxUploadReminder(CLINIC, 'ORD-DOES-NOT-EXIST', {
        kind: 'first',
        to_email: 'fixed@example.com',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
