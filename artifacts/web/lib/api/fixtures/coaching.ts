/**
 * Livera coaching log fixtures — extracted from mock.ts (Mini-wave 6a cleanup).
 * Contains: MOCK_COACHING_LOGS, listCoachingLogs, addCoachingLog.
 */

import type { ClinicId, CoachingLog } from '../types';
import { delay, scopedToClinic, CURRENT_USER, NOW } from '../constants';

export const MOCK_COACHING_LOGS: CoachingLog[] = [
  {
    id: 'LOG-001',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',  // Sarah Cookland
    coach_id: 'user_olwyn',
    entry_type: 'routine_check_in',
    status: 'completed',
    entry_date: '2026-04-28T14:00:00Z',
    duration_minutes: 30,
    summary: 'Patient motivated and engaged. Querying dose escalation at next clinical consult. Weight plateau discussed — reassured on expected GLP-1 response curve.',
    structured_observations: {
      mood: '4',
      adherence: 'excellent',
      side_effects_reported: 'Mild nausea, tolerated well',
      weight_self_reported_kg: 85.3,
    },
    next_action: 'Clinical consult booked 12 May re dose escalation',
    next_scheduled_date: '2026-05-11T14:00:00Z',
    clinical_escalation_flag_id: null,
    created_at: '2026-04-28T14:35:00Z',
    updated_at: '2026-04-28T14:35:00Z',
  },
  {
    id: 'LOG-002',
    clinic_id: 'feeltru',
    patient_id: 'PT-00412',  // Emma Whitfield
    coach_id: 'user_olwyn',
    entry_type: 'routine_check_in',
    status: 'completed',
    entry_date: '2026-04-28T11:02:00Z',
    duration_minutes: 30,
    summary: 'Positive session. Emma reporting significant improvement in energy and confidence. Weight loss of 7.7 kg since start. Discussing habit formation and sustainable meal planning.',
    structured_observations: {
      mood: '5',
      adherence: 'excellent',
      side_effects_reported: 'None',
      weight_self_reported_kg: 87.3,
    },
    next_action: 'Follow up in 2 weeks; check in on meal plan adherence',
    next_scheduled_date: '2026-05-11T14:00:00Z',
    clinical_escalation_flag_id: null,
    created_at: '2026-04-28T11:35:00Z',
    updated_at: '2026-04-28T11:35:00Z',
  },
  {
    id: 'LOG-003',
    clinic_id: 'feeltru',
    patient_id: 'PT-00445',  // Fiona MacLeod
    coach_id: 'user_olwyn',
    entry_type: 'routine_check_in',
    status: 'completed',
    entry_date: '2026-04-30T13:00:00Z',
    duration_minutes: 28,
    summary: 'Fiona expressing frustration with slower progress in last 2 weeks. Discussed normal GLP-1 trajectory and expected plateau phase. Side effects (fatigue) noted — flagged to prescriber.',
    structured_observations: {
      mood: '2',
      adherence: 'good',
      side_effects_reported: 'Fatigue, reduced appetite beyond expected',
      weight_self_reported_kg: 97.8,
    },
    next_action: 'Flag to prescriber for side effect review; Fiona to contact clinic if symptoms worsen',
    next_scheduled_date: '2026-05-13T11:00:00Z',
    clinical_escalation_flag_id: null,
    created_at: '2026-04-30T13:30:00Z',
    updated_at: '2026-04-30T13:30:00Z',
  },
];

export async function listCoachingLogs(
  clinic_id: ClinicId,
  opts?: { patient_id?: string; coach_id?: string }
): Promise<CoachingLog[]> {
  await delay();
  let results = scopedToClinic(MOCK_COACHING_LOGS, clinic_id);
  if (opts?.patient_id) results = results.filter((l) => l.patient_id === opts.patient_id);
  if (opts?.coach_id) results = results.filter((l) => l.coach_id === opts.coach_id);
  return results;
}

export async function addCoachingLog(
  clinic_id: ClinicId,
  data: Omit<CoachingLog, 'id' | 'clinic_id' | 'created_at' | 'updated_at'>
): Promise<CoachingLog> {
  await delay(400);
  const log: CoachingLog = {
    ...data,
    id: `LOG-${String(MOCK_COACHING_LOGS.length + 1).padStart(3, '0')}`,
    clinic_id,
    created_at: NOW,
    updated_at: NOW,
  };
  MOCK_COACHING_LOGS.push(log);
  console.log('[AUDIT]', {
    action: 'coaching_log.created',
    log_id: log.id,
    patient_id: log.patient_id,
    coach_id: log.coach_id,
    clinic_id,
    timestamp: new Date().toISOString(),
  });
  return log;
}
