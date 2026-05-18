/**
 * Unit tests — autoChaseExpiringPxUploadLinks (Task-175).
 *
 * Pins the auto-chase contract:
 *   1. Orders whose link is still in-window (expires_at > NOW) are
 *      skipped — the reminder job owns the pre-expiry nudge using the
 *      existing token, and rotating mid-window would invalidate that
 *      reminder email's link.
 *   2. Orders whose link is already expired AND have "Px upload pending"
 *      + no upload trigger one token rotation per sweep, recorded on
 *      `auto_resends[]`.
 *   3. After MAX_AUTO_RESENDS attempts, the order is escalated
 *      (`auto_chase_escalated_at` set, "Px upload chase escalated" flag
 *      added) and no further emails are sent on subsequent sweeps.
 *   4. Already-uploaded orders (px_upload set OR consumed_at set) are
 *      always skipped, regardless of expiry.
 *   5. Orders without the "Px upload pending" flag are skipped (the order
 *      doesn't actually need a patient upload).
 *   6. A failed delivery records the attempt and still counts toward the
 *      cap, so the job doesn't loop forever on bounced addresses.
 *
 * We don't try to spy on `autoResendPxUploadLink` itself — the mock
 * Postmark backend short-circuits to a synthetic message id, so the real
 * helper runs end-to-end against in-memory fixtures. For the failure
 * case we mock `sendPatientEmail` to return Failed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Order } from '../../types';

vi.mock('../../constants', async () => {
  const actual = await vi.importActual<typeof import('../../constants')>('../../constants');
  return { ...actual, NOW: '2026-05-18T08:00:00Z' };
});

import {
  autoChaseExpiringPxUploadLinks,
  MAX_AUTO_RESENDS,
} from '../autoChaseExpiringPxUploadLinks';
import { MOCK_ORDERS } from '../../fixtures/orders';
import { MOCK_PATIENTS } from '../../fixtures/patients';
import * as postmark from '../../../integrations/postmark';

const CLINIC = 'feeltru' as const;
const NOW_MS = new Date('2026-05-18T08:00:00Z').getTime();
const HOUR   = 60 * 60 * 1000;

let ordersSnapshot: Order[];

function snapshotOrders() {
  ordersSnapshot = MOCK_ORDERS.map((o) => structuredClone(o));
}
function restoreOrders() {
  MOCK_ORDERS.splice(0, MOCK_ORDERS.length, ...ordersSnapshot.map((o) => structuredClone(o)));
}

function seedOrder(opts: {
  id: string;
  expiresInHours: number;
  uploaded?: boolean;
  consumed?: boolean;
  pendingFlag?: boolean;
  autoResends?: number;
  escalated?: boolean;
}): Order {
  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === CLINIC)!;
  const expiresAt = new Date(NOW_MS + opts.expiresInHours * HOUR).toISOString();
  const autoResends = Array.from({ length: opts.autoResends ?? 0 }, (_, i) => ({
    sent_at:          new Date(NOW_MS - (i + 1) * 24 * HOUR).toISOString(),
    to_email:         patient.contact.email,
    expires_at:       expiresAt,
    previous_expired: true,
    status:           'Delivered' as const,
    error_message:    null,
  }));
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
    contextual_flags: opts.pendingFlag === false ? [] : ['Px upload pending'],
    intervention_raised_at: null,
    px_upload: opts.uploaded
      ? { filename: 'rx.pdf', size: 1000, content_type: 'application/pdf', uploaded_at: '2026-05-17T08:00:00Z', object_path: '/x' }
      : null,
    px_upload_link: {
      token: `tok-${opts.id}`,
      expires_at: expiresAt,
      sent_at: '2026-05-04T08:00:00Z',
      consumed_at: opts.consumed ? '2026-05-17T08:00:00Z' : null,
      email_message_id: 'mock-id',
      to_email: patient.contact.email,
      auto_resends: autoResends.length > 0 ? autoResends : undefined,
      auto_chase_escalated_at: opts.escalated ? '2026-05-17T08:00:00Z' : null,
    },
    expired_at: null,
    created_at: '2026-05-04T08:00:00Z',
    updated_at: '2026-05-04T08:00:00Z',
  };
  MOCK_ORDERS.push(order);
  return order;
}

describe('autoChaseExpiringPxUploadLinks', () => {
  beforeEach(() => {
    snapshotOrders();
    MOCK_ORDERS.splice(0, MOCK_ORDERS.length);
  });

  afterEach(() => {
    restoreOrders();
    vi.restoreAllMocks();
  });

  it('skips orders whose link is still within TTL (not yet expired)', async () => {
    seedOrder({ id: 'ORD-A', expiresInHours: 48 });
    const result = await autoChaseExpiringPxUploadLinks(CLINIC);
    expect(result.considered).toBe(0);
    expect(MOCK_ORDERS[0]!.px_upload_link!.auto_resends ?? []).toHaveLength(0);
  });

  it('auto-resends an expired link and records the attempt on auto_resends[]', async () => {
    seedOrder({ id: 'ORD-B', expiresInHours: -2 });
    const result = await autoChaseExpiringPxUploadLinks(CLINIC);
    expect(result.considered).toBe(1);
    expect(result.resent).toHaveLength(1);
    const link = MOCK_ORDERS[0]!.px_upload_link!;
    expect(link.auto_resends).toHaveLength(1);
    expect(link.auto_resends![0]!.status).toBe('Delivered');
    expect(link.auto_resends![0]!.previous_expired).toBe(true);
    // Token rotated → new TTL well beyond the old one.
    expect(new Date(link.expires_at).getTime()).toBeGreaterThan(NOW_MS);
  });

  it('does NOT touch a link still within the 24h pre-expiry window (reminder job owns it)', async () => {
    seedOrder({ id: 'ORD-C', expiresInHours: 12 });
    const result = await autoChaseExpiringPxUploadLinks(CLINIC);
    expect(result.considered).toBe(0);
    expect(result.resent).toHaveLength(0);
    expect(MOCK_ORDERS[0]!.px_upload_link!.auto_resends ?? []).toHaveLength(0);
  });

  it(`escalates after ${MAX_AUTO_RESENDS} auto-resends instead of mailing again`, async () => {
    seedOrder({ id: 'ORD-D', expiresInHours: -1, autoResends: MAX_AUTO_RESENDS });
    const tokenBefore = MOCK_ORDERS[0]!.px_upload_link!.token;
    const result = await autoChaseExpiringPxUploadLinks(CLINIC);
    expect(result.escalated).toHaveLength(1);
    expect(result.resent).toHaveLength(0);
    const order = MOCK_ORDERS[0]!;
    expect(order.px_upload_link!.auto_chase_escalated_at).toBe('2026-05-18T08:00:00Z');
    expect(order.contextual_flags).toContain('Px upload chase escalated');
    // No new token minted — escalation does not email the patient.
    expect(order.px_upload_link!.token).toBe(tokenBefore);
    // Existing auto_resends count is preserved (not incremented).
    expect(order.px_upload_link!.auto_resends).toHaveLength(MAX_AUTO_RESENDS);
  });

  it('skips orders that have already been escalated', async () => {
    seedOrder({
      id: 'ORD-E',
      expiresInHours: -5,
      autoResends: MAX_AUTO_RESENDS,
      escalated: true,
    });
    const result = await autoChaseExpiringPxUploadLinks(CLINIC);
    expect(result.considered).toBe(0);
    expect(result.escalated).toHaveLength(0);
  });

  it('skips orders that have already received an upload', async () => {
    seedOrder({ id: 'ORD-F', expiresInHours: -10, uploaded: true });
    seedOrder({ id: 'ORD-G', expiresInHours: -10, consumed: true });
    const result = await autoChaseExpiringPxUploadLinks(CLINIC);
    expect(result.considered).toBe(0);
  });

  it('skips orders without the "Px upload pending" flag', async () => {
    seedOrder({ id: 'ORD-H', expiresInHours: -10, pendingFlag: false });
    const result = await autoChaseExpiringPxUploadLinks(CLINIC);
    expect(result.considered).toBe(0);
  });

  it('records a failed delivery and still counts toward the cap', async () => {
    vi.spyOn(postmark, 'sendPatientEmail').mockResolvedValueOnce({
      message_id:    null,
      status:        'Failed',
      error_message: 'Postmark 422: InactiveRecipient',
    });
    seedOrder({ id: 'ORD-I', expiresInHours: -1 });
    const result = await autoChaseExpiringPxUploadLinks(CLINIC);
    expect(result.failed).toHaveLength(1);
    expect(result.resent).toHaveLength(0);
    const link = MOCK_ORDERS[0]!.px_upload_link!;
    expect(link.auto_resends).toHaveLength(1);
    expect(link.auto_resends![0]!.status).toBe('Failed');
  });

  it('is idempotent for escalation — re-running after escalation is a no-op', async () => {
    seedOrder({ id: 'ORD-J', expiresInHours: -1, autoResends: MAX_AUTO_RESENDS });
    await autoChaseExpiringPxUploadLinks(CLINIC);
    const second = await autoChaseExpiringPxUploadLinks(CLINIC);
    expect(second.considered).toBe(0);
    expect(second.escalated).toHaveLength(0);
  });
});
