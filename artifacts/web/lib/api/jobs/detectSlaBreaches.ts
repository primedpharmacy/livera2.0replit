/**
 * detectSlaBreaches — BLD-3.2 (Wave 3).
 *
 * Scans orders in `clinical_check` status against NOW and the clinic's
 * default_slas thresholds. Creates SlaBreach records for new breaches
 * and pushes to Monday.com via writeSlaBreach.
 *
 * Thresholds: ALL from clinic.config — zero literals in this file.
 * Coach role: excluded from breach detection reads (not a clinical actor).
 *
 * Designed to run server-side (RSC / cron-compatible).
 */

import type { ClinicId, SlaBreach } from '../types';
import { NOW } from '../constants';
import { getClinicSync } from '../fixtures/clinics';
import { MOCK_ORDERS } from '../fixtures/orders';
import { MOCK_SLA_BREACHES } from '../fixtures/slaBreaches';
import { writeSlaBreach } from '@/lib/integrations/monday';

export async function detectSlaBreaches(clinicId: ClinicId): Promise<SlaBreach[]> {
  const clinic = getClinicSync(clinicId);
  const nowMs = new Date(NOW).getTime();
  const newBreaches: SlaBreach[] = [];

  // ── Order approval breaches ──────────────────────────────────────────────
  const clinicOrders = MOCK_ORDERS.filter(
    (o) => o.clinic_id === clinicId && o.status === 'clinical_check',
  );

  for (const order of clinicOrders) {
    const breachAt = new Date(order.sla_breach_at).getTime();
    if (nowMs <= breachAt) continue;  // not yet breached

    const alreadyRecorded = MOCK_SLA_BREACHES.some(
      (b) =>
        b.clinic_id === clinicId &&
        b.entity_type === 'order' &&
        b.entity_id === order.id &&
        b.sla_type === 'approval_breach_hours',
    );
    if (alreadyRecorded) continue;

    const breach: SlaBreach = {
      id: `BREACH-DETECT-${order.id}`,
      clinic_id: clinicId,
      entity_type: 'order',
      entity_id: order.id,
      sla_type: 'approval_breach_hours',
      breach_detected_at: NOW,
      acknowledged_at: null,
      acknowledged_by_user_id: null,
      notes: null,
      monday_item_id: null,
    };

    MOCK_SLA_BREACHES.push(breach);
    newBreaches.push(breach);
    console.log('[AUDIT]', {
      event_type:         'sla_breach_detected',
      outcome:            'success',
      actor_id:           'system',
      entity_type:        breach.entity_type,
      entity_id:          breach.entity_id,
      sla_type:           breach.sla_type,
      breach_detected_at: breach.breach_detected_at,
      timestamp:          NOW,
    });

    // Non-blocking Monday write (BLD-3.5) — fire-and-forget in mock env
    writeSlaBreach({ breach, clinicConfig: clinic.config }).catch((err) => {
      console.error('[MONDAY] writeSlaBreach failed:', err);
    });
  }

  return newBreaches;
}
