/**
 * Integration test — Task-175.
 *
 * Pins the contract that `sendPxUploadReminders` and
 * `autoChaseExpiringPxUploadLinks` never act on the same order in the
 * same scheduler tick. Reminders own the pre-expiry window (and reuse
 * the existing token); auto-chase owns the post-expiry window (and
 * rotates the token). If both ran against the same order, the rotation
 * would invalidate the link in the reminder email the patient just
 * received minutes earlier.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Order } from '../../types';

vi.mock('../../constants', async () => {
  const actual = await vi.importActual<typeof import('../../constants')>('../../constants');
  return { ...actual, NOW: '2026-05-18T08:00:00Z' };
});

import { autoChaseExpiringPxUploadLinks } from '../autoChaseExpiringPxUploadLinks';
import { sendPxUploadReminders } from '../sendPxUploadReminders';
import { MOCK_ORDERS } from '../../fixtures/orders';
import { MOCK_PATIENTS } from '../../fixtures/patients';

const CLINIC  = 'feeltru' as const;
const NOW_MS  = new Date('2026-05-18T08:00:00Z').getTime();
const HOUR    = 60 * 60 * 1000;

let ordersSnapshot: Order[];

function snapshot() { ordersSnapshot = MOCK_ORDERS.map((o) => structuredClone(o)); }
function restore()  { MOCK_ORDERS.splice(0, MOCK_ORDERS.length, ...ordersSnapshot.map((o) => structuredClone(o))); }

function seed(opts: { id: string; expiresInHours: number; firstReminderSent?: boolean }): Order {
  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === CLINIC)!;
  const expiresAt = new Date(NOW_MS + opts.expiresInHours * HOUR).toISOString();
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
    sla_warn_at: '2026-05-19T08:00:00Z',
    sla_breach_at: '2026-05-20T08:00:00Z',
    g6_flags: [],
    contextual_flags: ['Px upload pending'],
    intervention_raised_at: null,
    px_upload: null,
    px_upload_link: {
      token: `tok-${opts.id}`,
      expires_at: expiresAt,
      sent_at: '2026-05-04T08:00:00Z',
      consumed_at: null,
      email_message_id: 'mock-id',
      to_email: patient.contact.email,
      reminder_sent_at: opts.firstReminderSent ? '2026-05-06T08:00:00Z' : null,
    },
    expired_at: null,
    created_at: '2026-05-04T08:00:00Z',
    updated_at: '2026-05-04T08:00:00Z',
  };
  MOCK_ORDERS.push(order);
  return order;
}

describe('px-upload jobs — no overlap in same scheduler tick', () => {
  beforeEach(() => { snapshot(); MOCK_ORDERS.splice(0, MOCK_ORDERS.length); });
  afterEach(() => { restore(); vi.restoreAllMocks(); });

  it('within the 24h pre-expiry window, only the reminder job acts (token preserved)', async () => {
    seed({ id: 'ORD-PRE', expiresInHours: 12, firstReminderSent: true });
    const tokenBefore = MOCK_ORDERS[0]!.px_upload_link!.token;

    const reminders = await sendPxUploadReminders(CLINIC);
    const chase     = await autoChaseExpiringPxUploadLinks(CLINIC);

    expect(reminders.sent.some((s) => s.order_id === 'ORD-PRE' && s.kind === 'final')).toBe(true);
    expect(chase.considered).toBe(0);
    expect(chase.resent).toHaveLength(0);

    const link = MOCK_ORDERS[0]!.px_upload_link!;
    expect(link.token).toBe(tokenBefore);                 // not rotated
    expect(link.auto_resends ?? []).toHaveLength(0);
    expect(link.final_reminder_sent_at).toBeTruthy();
  });

  it('after expiry, only the auto-chase job acts (reminder skips expired links)', async () => {
    seed({ id: 'ORD-POST', expiresInHours: -2, firstReminderSent: true });
    const tokenBefore = MOCK_ORDERS[0]!.px_upload_link!.token;

    const reminders = await sendPxUploadReminders(CLINIC);
    const chase     = await autoChaseExpiringPxUploadLinks(CLINIC);

    expect(reminders.sent.some((s) => s.order_id === 'ORD-POST')).toBe(false);
    expect(chase.considered).toBe(1);
    expect(chase.resent).toHaveLength(1);

    const link = MOCK_ORDERS[0]!.px_upload_link!;
    expect(link.token).not.toBe(tokenBefore);             // rotated by auto-chase
    expect(link.auto_resends).toHaveLength(1);
  });
});
