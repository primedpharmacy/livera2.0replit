/**
 * Timeline adapter — Order → TimelineEntry (BLD-4.3, Wave 3).
 *
 * badge_color: blue
 * Generates a single entry per order (creation event + decision if present).
 * link_url: /<clinicId>/orders/<orderId>
 */

import type { Order, ClinicId } from '@/lib/api/types';
import type { TimelineEntry } from '../types';

export function adaptOrderEvent(
  order: Order,
  clinicId: ClinicId,
  prescriberName?: string,
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

  return entries;
}
