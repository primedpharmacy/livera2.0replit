/**
 * Timeline adapter — Order → TimelineEntry (BLD-4.3, Wave 3).
 *
 * badge_color: blue
 * Generates entries per order:
 *   - creation event
 *   - current clinical decision (if present)
 *   - one "Decision reversed" entry per `reversal_log` record (Task-234)
 *     so the patient-level timeline mirrors the order-detail Activity log
 *     and clinicians can see when a decision was later undone without
 *     drilling into each order.
 * link_url: /<clinicId>/orders/<orderId>
 */

import type { Order, ClinicId } from '@/lib/api/types';
import type { TimelineEntry } from '../types';

export function adaptOrderEvent(
  order: Order,
  clinicId: ClinicId,
  prescriberName?: string,
  reverserNames: Record<string, string> = {},
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  // Order creation event
  entries.push({
    id:           `${order.id}_created`,
    type:         'order_event',
    patient_id:   order.patient_id,
    occurred_at:  order.created_at,
    author_label: 'System',
    summary:      `Order ${order.id} received — ${order.product.medication} ${order.product.dose} (${order.type})`,
    badge_color:  'blue',
    link_url:     `/${clinicId}/orders/${order.id}`,
  });

  // Clinical decision event (if present)
  if (order.clinical_decision) {
    const { decision, decided_at, prescriber_user_id, rationale } = order.clinical_decision;
    const label = prescriberName ? `${prescriberName} (Prescriber)` : `${prescriber_user_id} (Prescriber)`;
    const actionLabel =
      decision === 'approved' ? 'Approved' :
      decision === 'declined' ? 'Declined' : 'Queried';

    entries.push({
      id:           `${order.id}_decision`,
      type:         'order_event',
      patient_id:   order.patient_id,
      occurred_at:  decided_at,
      author_label: label,
      summary:      `${actionLabel} — ${rationale.length > 80 ? `${rationale.slice(0, 77)}…` : rationale}`,
      badge_color:  'blue',
      link_url:     `/${clinicId}/orders/${order.id}`,
    });
  }

  // Task-234 — Reversal log entries. Mirrors the wording used by the
  // order-detail Activity log (OrderActivityTimeline) so the patient
  // timeline surfaces undone decisions across all of a patient's orders.
  for (let i = 0; i < (order.reversal_log?.length ?? 0); i++) {
    const rev = order.reversal_log![i];
    const reverser = reverserNames[rev.reversed_by_user_id] ?? rev.reversed_by_user_id;
    entries.push({
      id:           `${order.id}_reversal_${i}`,
      type:         'order_event',
      patient_id:   order.patient_id,
      occurred_at:  rev.reversed_at,
      author_label: reverser,
      summary:      `Decision reversed — was ${rev.prior_decision}`,
      badge_color:  'blue',
      link_url:     `/${clinicId}/orders/${order.id}`,
    });
  }

  return entries;
}
