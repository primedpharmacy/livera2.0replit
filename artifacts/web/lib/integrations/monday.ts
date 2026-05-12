/**
 * Livera Monday.com integration helpers — BLD-3.5 (Wave 3).
 *
 * Feature-flagged by LIVERA_MONDAY_LIVE env var (default: false).
 * When false: stub logs and returns deterministic success.
 * When true:  would invoke real Monday API (out of Wave 3 scope).
 *
 * Every call is audit-logged with [MONDAY] prefix.
 */

import type { SlaBreach, ClinicConfig } from '@/lib/api/types';

const MONDAY_LIVE = process.env['LIVERA_MONDAY_LIVE'] === 'true';

export type WriteSlaBreach = {
  breach: SlaBreach;
  clinicConfig: ClinicConfig;
};

export async function writeSlaBreach({ breach, clinicConfig }: WriteSlaBreach): Promise<{ success: boolean }> {
  const boardId = clinicConfig.monday_incident_board_id;
  const payload = {
    item_name: `SLA Breach — ${breach.entity_type} ${breach.entity_id}`,
    column_values: {
      sla_type:           breach.sla_type,
      entity_type:        breach.entity_type,
      entity_id:          breach.entity_id,
      breach_detected_at: breach.breach_detected_at,
      clinic_id:          breach.clinic_id,
    },
  };

  // [AUDIT] Monday write attempt
  console.log('[AUDIT]', {
    event_type:  'monday_sla_breach_write_attempt',
    board_id:    boardId,
    breach_id:   breach.id,
    entity_type: breach.entity_type,
    entity_id:   breach.entity_id,
    live:        MONDAY_LIVE,
  });

  if (!MONDAY_LIVE) {
    console.info('[MONDAY]', boardId, payload);
    return { success: true };
  }

  // Real API path — wired in future wave
  throw new Error('LIVERA_MONDAY_LIVE=true wiring not yet implemented (Wave 3 scope)');
}
