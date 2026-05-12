/**
 * detectSlaBreaches — BLD-3.2 (Wave 3) + BLD-4.6.2 (Wave 4).
 *
 * Wave 3: Scans orders in `clinical_check` status against approval_breach_hours.
 * Wave 4 (BLD-4.6.2): Also scans GP letters in `owed` lifecycle for gp_letter_send_hours.
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
import { MOCK_GP_LETTERS } from '../fixtures/gpLetters';
import { writeSlaBreach } from '@/lib/integrations/monday';

export async function detectSlaBreaches(clinicId: ClinicId): Promise<SlaBreach[]> {
  const clinic = getClinicSync(clinicId);
  const nowMs = new Date(NOW).getTime();
  const newBreaches: SlaBreach[] = [];

  // ── Order approval breaches (Wave 3) ──────────────────────────────────────
  const clinicOrders = MOCK_ORDERS.filter(
    (o) => o.clinic_id === clinicId && o.status === 'clinical_check',
  );

  for (const order of clinicOrders) {
    const breachAt = new Date(order.sla_breach_at).getTime();
    if (nowMs <= breachAt) continue;

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

    writeSlaBreach({ breach, clinicConfig: clinic.config }).catch((err) => {
      console.error('[MONDAY] writeSlaBreach failed:', err);
    });
  }

  // ── GP letter send SLA breaches (BLD-4.6.2 — Wave 4) ─────────────────────
  // SLA: gp_letter_send_hours from clinic.config (default 48h from created_at when status='owed')
  const gpLetterSlaHours = clinic.config.default_slas.gp_letter_send_hours;
  const clinicGPLetters = MOCK_GP_LETTERS.filter(
    (l) => l.clinic_id === clinicId && l.lifecycle_status === 'owed',
  );

  for (const letter of clinicGPLetters) {
    const createdMs = new Date(letter.created_at).getTime();
    const slaBreachMs = createdMs + gpLetterSlaHours * 60 * 60 * 1000;
    if (nowMs <= slaBreachMs) continue;

    const alreadyRecorded = MOCK_SLA_BREACHES.some(
      (b) =>
        b.clinic_id === clinicId &&
        b.entity_type === 'gp_letter' &&
        b.entity_id === letter.id &&
        b.sla_type === 'gp_letter_send_hours',
    );
    if (alreadyRecorded) continue;

    const breach: SlaBreach = {
      id: `BREACH-GPL-${letter.id}`,
      clinic_id: clinicId,
      entity_type: 'gp_letter',
      entity_id: letter.id,
      sla_type: 'gp_letter_send_hours',
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

    writeSlaBreach({ breach, clinicConfig: clinic.config }).catch((err) => {
      console.error('[MONDAY] writeSlaBreach failed:', err);
    });
  }

  return newBreaches;
}
