/**
 * detectOrderExpiry — BLD-4.6.3 (Wave 4).
 *
 * Scans orders against NOW for 6-calendar-day expiry (DEC-15).
 * On expiry: transitions status, releases Ryft auth (non-blocking),
 * fires Omnisend "order_expired" template, writes activity_log entry.
 *
 * Expiry = 6 CALENDAR days from order.created_at (not working days).
 * Payment copy rule: NEVER say "refund" — use "order released / no charge taken".
 *
 * Eligible statuses for expiry: clinical_check, on_hold, received.
 * Orders in approved / in_dispensing / dispatched / delivered are NOT expired
 * (they are past the clinical decision point).
 *
 * Designed to run server-side (RSC / cron-compatible).
 */

import type { ClinicId, Order } from '../types';
import { NOW } from '../constants';
import { MOCK_ORDERS, expireOrderMutation } from '../fixtures/orders';
import { MOCK_PATIENTS } from '../fixtures/patients';
import { releaseAuth } from '@/lib/integrations/ryft';
import { sendTemplate } from '@/lib/integrations/omnisend';

const EXPIRY_ELIGIBLE_STATUSES: Order['status'][] = ['received', 'clinical_check', 'on_hold'];
const CALENDAR_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

export async function detectOrderExpiry(clinicId: ClinicId): Promise<Order[]> {
  const nowMs = new Date(NOW).getTime();
  const expired: Order[] = [];

  const eligibleOrders = MOCK_ORDERS.filter(
    (o) => o.clinic_id === clinicId && EXPIRY_ELIGIBLE_STATUSES.includes(o.status),
  );

  for (const order of eligibleOrders) {
    const expiryMs = new Date(order.created_at).getTime() + CALENDAR_DAYS_MS;
    if (nowMs < expiryMs) continue;  // not yet expired

    // Transition order to 'expired'
    expireOrderMutation(order);
    expired.push(order);

    // Fire-and-forget effects — failures are logged but do NOT block expiry
    const patient = MOCK_PATIENTS.find(
      (p) => p.clinic_id === clinicId && p.id === order.patient_id,
    );

    // BLD-4.6.5 — (1) Release Ryft authorisation
    if (order.ryft_authorisation_id) {
      releaseAuth(order.ryft_authorisation_id, order.id).catch((err) => {
        console.error('[RYFT] releaseAuth failed for order', order.id, err);
      });
    }

    // BLD-4.6.5 — (2) Omnisend "order expired" template
    // Payment copy rule: template body says "order released — no charge taken" (never "refund")
    if (patient?.contact.email) {
      sendTemplate('order_expired', patient.contact.email, order.id).catch((err) => {
        console.error('[OMNISEND] sendTemplate failed for order', order.id, err);
      });
    }

    // BLD-4.6.5 — (3) Activity log entry (in-memory — real backend writes to DB)
    console.log('[ACTIVITY]', {
      event_type:    'order_expired',
      order_id:      order.id,
      clinic_id:     clinicId,
      patient_id:    order.patient_id,
      expired_at:    NOW,
      reason:        '6-day-timeout',
      ryft_auth_id:  order.ryft_authorisation_id,
      payment_note:  'order released — no charge taken',
      timestamp:     NOW,
    });
  }

  return expired;
}
