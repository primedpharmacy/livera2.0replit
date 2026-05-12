/**
 * Livera SLA breach fixtures — BLD-3.2, BLD-3.5 (Wave 3).
 *
 * SlaBreach entities are created by detectSlaBreaches (lib/api/jobs/detectSlaBreaches.ts).
 * Acknowledged via acknowledgeSlaBreachRecord.
 * Synced to Monday.com via lib/integrations/monday.ts writeSlaBreach.
 *
 * 3-layer safety chain on acknowledgeSlaBreachRecord:
 *   Layer 1 (UI): Admin/Owner/Prescriber role gate in dashboard banner
 *   Layer 2 (server): role checked here, throws PERMISSION_DENIED
 *   Layer 3 (audit): [AUDIT] entry on every acknowledgement
 */

import type { ClinicId, SlaBreach } from '../types';
import { delay, APIError, scopedToClinic, CURRENT_USER, NOW } from '../constants';
import { can } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Seeds — 5 breaches (3 open, 2 acknowledged)
// ---------------------------------------------------------------------------

export const MOCK_SLA_BREACHES: SlaBreach[] = [
  // Open breaches — will appear in dashboard banner (BLD-3.3)
  {
    id: 'BREACH-00001',
    clinic_id: 'feeltru',
    entity_type: 'order',
    entity_id: 'ORD-00441',
    sla_type: 'approval_breach_hours',
    breach_detected_at: '2026-05-12T09:00:00Z',
    acknowledged_at: null,
    acknowledged_by_user_id: null,
    notes: null,
    monday_item_id: null,
  },
  {
    id: 'BREACH-00002',
    clinic_id: 'vsc',
    entity_type: 'order',
    entity_id: 'ORD-00422',
    sla_type: 'approval_breach_hours',
    breach_detected_at: '2026-05-11T12:30:00Z',
    acknowledged_at: null,
    acknowledged_by_user_id: null,
    notes: null,
    monday_item_id: null,
  },
  {
    id: 'BREACH-00003',
    clinic_id: 'feeltru',
    entity_type: 'coaching_escalation',
    entity_id: 'FLAG-001',
    sla_type: 'coach_escalation_response_wh',
    breach_detected_at: '2026-05-10T16:00:00Z',
    acknowledged_at: null,
    acknowledged_by_user_id: null,
    notes: null,
    monday_item_id: null,
  },

  // Acknowledged breaches — historical record
  {
    id: 'BREACH-00004',
    clinic_id: 'vsc',
    entity_type: 'gp_letter',
    entity_id: 'GPL-00003',
    sla_type: 'gp_letter_send_hours',
    breach_detected_at: '2026-04-20T10:00:00Z',
    acknowledged_at: '2026-04-20T14:00:00Z',
    acknowledged_by_user_id: 'user_qadir',
    notes: 'Delay caused by Monday.com outage. GP letter sent manually.',
    monday_item_id: '18402056777',
  },
  {
    id: 'BREACH-00005',
    clinic_id: 'vsc',
    entity_type: 'order',
    entity_id: 'ORD-00380',
    sla_type: 'approval_breach_hours',
    breach_detected_at: '2026-04-15T08:00:00Z',
    acknowledged_at: '2026-04-15T09:30:00Z',
    acknowledged_by_user_id: 'user_claire',
    notes: 'High volume period. Approval completed shortly after breach detection.',
    monday_item_id: '18402056812',
  },
];

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function listSlaBreaches(
  clinicId: ClinicId,
  filters?: { status?: 'open' | 'acknowledged'; entity_type?: SlaBreach['entity_type'] },
): Promise<SlaBreach[]> {
  await delay();
  let breaches = MOCK_SLA_BREACHES.filter((b) => b.clinic_id === clinicId);
  if (filters?.status === 'open')         breaches = breaches.filter((b) => !b.acknowledged_at);
  if (filters?.status === 'acknowledged') breaches = breaches.filter((b) =>  b.acknowledged_at);
  if (filters?.entity_type)               breaches = breaches.filter((b) =>  b.entity_type === filters.entity_type);
  return breaches.sort((a, b) => b.breach_detected_at.localeCompare(a.breach_detected_at));
}

/**
 * acknowledgeSlaBreachRecord — BLD-3.3
 * 3-layer chain: UI gate → server gate → [AUDIT]
 */
export async function acknowledgeSlaBreachRecord(
  clinicId: ClinicId,
  breachId: string,
  notes?: string,
): Promise<SlaBreach> {
  await delay();

  // Layer 2 — role gate
  if (!can(CURRENT_USER, 'acknowledge', 'sla_breaches')) {
    console.log('[AUDIT]', { event_type: 'sla_breach_ack_blocked', outcome: 'PERMISSION_DENIED', actor_id: CURRENT_USER.id, breach_id: breachId });
    throw new APIError('PERMISSION_DENIED', 'Only Prescribers, Admins, or Owners may acknowledge SLA breaches');
  }

  const idx = MOCK_SLA_BREACHES.findIndex((b) => b.id === breachId && b.clinic_id === clinicId);
  if (idx === -1) throw new APIError('NOT_FOUND', `SLA breach '${breachId}' not found`);

  const breach = MOCK_SLA_BREACHES[idx]!;
  if (breach.acknowledged_at) throw new APIError('CONFLICT', 'Breach already acknowledged');

  const updated: SlaBreach = {
    ...breach,
    acknowledged_at: NOW,
    acknowledged_by_user_id: CURRENT_USER.id,
    notes: notes ?? null,
  };

  MOCK_SLA_BREACHES[idx] = updated;

  // Layer 3 — audit
  console.log('[AUDIT]', {
    event_type: 'sla_breach_acknowledged',
    outcome:    'success',
    actor_id:   CURRENT_USER.id,
    breach_id:  breachId,
    entity_type: updated.entity_type,
    entity_id:   updated.entity_id,
    clinic_id:   clinicId,
    timestamp:   NOW,
  });

  return updated;
}
