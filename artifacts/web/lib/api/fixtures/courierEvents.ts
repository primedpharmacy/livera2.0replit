/**
 * Courier event fixtures — BLD-11.1 (Royal Mail webhook events).
 *
 * 5 event types mirror Royal Mail's real webhook payload:
 *   accepted → collected → in_transit → out_for_delivery → delivered | exception
 *
 * BLD-11.3: each event triggers a Postmark template (recorded in postmark_triggered).
 * BLD-11.4: events feed the Order Detail activity log.
 * BLD-11.5: is_exception=true events power the dashboard "Delivery exceptions" stat.
 *
 * Seeded data: ORD-00447 (Emma Whitfield, FeelTru, dispatched)
 *   Scenario: parcel reached out-for-delivery, then "NOT_HOME" exception.
 *   Patient notified; redelivery scheduled.
 */

import type { ClinicId, CourierEvent } from '../types';
import { delay, scopedToClinic } from '../constants';

export const MOCK_COURIER_EVENTS: CourierEvent[] = [
  // ── ORD-00447 · Emma Whitfield · Wegovy 1.0mg (dispatched) ───────────────
  {
    id: 'CE-001',
    clinic_id: 'feeltru',
    order_id: 'ORD-00447',
    event_type: 'accepted',
    occurred_at: '2026-05-07T09:15:00Z',
    location: 'Harrogate Logistics Hub',
    description: 'Parcel accepted by Royal Mail at pharmacy handover point.',
    is_exception: false,
    exception_code: null,
    postmark_triggered: true,
  },
  {
    id: 'CE-002',
    clinic_id: 'feeltru',
    order_id: 'ORD-00447',
    event_type: 'collected',
    occurred_at: '2026-05-07T14:30:00Z',
    location: 'Harrogate Logistics Hub',
    description: 'Parcel collected by Royal Mail driver for onward transit.',
    is_exception: false,
    exception_code: null,
    postmark_triggered: true,
  },
  {
    id: 'CE-003',
    clinic_id: 'feeltru',
    order_id: 'ORD-00447',
    event_type: 'in_transit',
    occurred_at: '2026-05-08T05:45:00Z',
    location: 'Manchester North Delivery Office',
    description: 'Parcel arrived at local delivery office and prepared for delivery.',
    is_exception: false,
    exception_code: null,
    postmark_triggered: false,
  },
  {
    id: 'CE-004',
    clinic_id: 'feeltru',
    order_id: 'ORD-00447',
    event_type: 'out_for_delivery',
    occurred_at: '2026-05-08T08:20:00Z',
    location: 'Manchester North Delivery Office',
    description: 'Parcel loaded onto delivery vehicle. Expected delivery today.',
    is_exception: false,
    exception_code: null,
    postmark_triggered: true,
  },
  {
    id: 'CE-005',
    clinic_id: 'feeltru',
    order_id: 'ORD-00447',
    event_type: 'exception',
    occurred_at: '2026-05-08T13:55:00Z',
    location: 'Manchester, M14 5QH',
    description: 'Delivery attempted — no one available to receive the parcel. Calling card left. Parcel returned to depot for redelivery or collection.',
    is_exception: true,
    exception_code: 'NOT_HOME',
    postmark_triggered: true,
  },
];

// ── API functions ──────────────────────────────────────────────────────────────

export async function listCourierEvents(
  clinicId: ClinicId,
  filter?: { order_id?: string; patient_id?: string; is_exception?: boolean },
): Promise<CourierEvent[]> {
  await delay(80);
  let events = scopedToClinic(MOCK_COURIER_EVENTS, clinicId);
  if (filter?.order_id) {
    events = events.filter((e) => e.order_id === filter.order_id);
  }
  if (filter?.is_exception !== undefined) {
    events = events.filter((e) => e.is_exception === filter.is_exception);
  }
  return [...events].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
}

export async function listDeliveryExceptions(clinicId: ClinicId): Promise<CourierEvent[]> {
  return listCourierEvents(clinicId, { is_exception: true });
}

/**
 * BLD-11.1 — Simulate Royal Mail webhook event receipt.
 * In production: this is called by the `/api/webhooks/royal-mail` route.
 * Returns the created event (in-memory only for mock).
 */
export async function receiveRoyalMailWebhook(
  clinicId: ClinicId,
  orderId: string,
  eventType: CourierEvent['event_type'],
  payload: { location?: string; description: string; exception_code?: string },
): Promise<CourierEvent> {
  await delay(50);
  const event: CourierEvent = {
    id: `CE-WH-${Date.now()}`,
    clinic_id: clinicId,
    order_id: orderId,
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    location: payload.location ?? null,
    description: payload.description,
    is_exception: eventType === 'exception',
    exception_code: payload.exception_code ?? null,
    postmark_triggered: false,
  };
  MOCK_COURIER_EVENTS.push(event);
  console.info('[ROYAL_MAIL] Webhook received', { clinic_id: clinicId, order_id: orderId, event_type: eventType });
  return event;
}
