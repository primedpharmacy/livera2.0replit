/**
 * Livera coaching log fixtures — BLD-2.4 locked schema (16+1 fields).
 *
 * entry_type: 'initial_call' | 'check_in' | 'escalation' | 'note'
 * status:     'scheduled' | 'completed' | 'no_show' | 'cancelled'
 *
 * 3-layer safety chain on addCoachingLog:
 *   1. Role: caller must have Coach role
 *   2. Clinic: coaching_enabled must be true
 *   3. Ownership: patient.coach_id === caller.id  (canCoachAccessPatient)
 */

import type { ClinicId, CoachingLog } from '../types';
import { delay, scopedToClinic, CURRENT_USER, NOW } from '../constants';
import { getClinicSync } from './clinics';
import { getPatient } from './patients';
import { can } from '@/lib/permissions';

export const MOCK_COACHING_LOGS: CoachingLog[] = [
  // ── Sarah Cookland (PT-00198) ─────────────────────────────────────────────
  {
    id: 'LOG-001',
    patient_id: 'PT-00198',
    coach_id: 'user_olwyn',
    clinic_id: 'feeltru',
    entry_type: 'initial_call',
    entry_date: '2026-01-20T10:00:00Z',
    scheduled_date: '2026-01-20T10:00:00Z',
    duration_minutes: 45,
    modality: 'phone',
    summary: 'Initial coaching call with Sarah. Reviewed programme expectations, discussed GLP-1 mechanism and weight-loss timeline. Patient motivated and engaged. Goal-setting completed — target -15 kg over 6 months.',
    next_action: 'Schedule first check-in for 3 weeks. Sarah to start food diary.',
    status: 'completed',
    clinical_escalation_flag_id: null,
    consultation_id: null,
    created_at: '2026-01-20T10:50:00Z',
    updated_at: '2026-01-20T10:50:00Z',
    structured_observations: { mood: '4', adherence: 'excellent', weight_self_reported_kg: 92.5 },
  },
  {
    id: 'LOG-002',
    patient_id: 'PT-00198',
    coach_id: 'user_olwyn',
    clinic_id: 'feeltru',
    entry_type: 'check_in',
    entry_date: '2026-02-10T14:00:00Z',
    scheduled_date: '2026-02-10T14:00:00Z',
    duration_minutes: 30,
    modality: 'phone',
    summary: 'Good session. Sarah has lost 2.1 kg since start. Mild nausea first 2 weeks, now resolved. Food diary shows improved portion control. Energy levels improving.',
    next_action: 'Follow up in 3 weeks. Introduce light exercise plan.',
    status: 'completed',
    clinical_escalation_flag_id: null,
    consultation_id: null,
    created_at: '2026-02-10T14:35:00Z',
    updated_at: '2026-02-10T14:35:00Z',
    structured_observations: { mood: '4', adherence: 'good', weight_self_reported_kg: 90.4 },
  },
  {
    id: 'LOG-003',
    patient_id: 'PT-00198',
    coach_id: 'user_olwyn',
    clinic_id: 'feeltru',
    entry_type: 'check_in',
    entry_date: '2026-03-04T10:30:00Z',
    scheduled_date: '2026-03-04T10:30:00Z',
    duration_minutes: 28,
    modality: 'phone',
    summary: 'Sarah reporting a short plateau — weight unchanged for 10 days. Reassured on normal GLP-1 response curve. Reviewed food diary — slight caloric creep on weekends. Discussed strategies for social dining.',
    next_action: 'Review portion strategies at next session. Reorder due next week.',
    status: 'completed',
    clinical_escalation_flag_id: null,
    consultation_id: null,
    created_at: '2026-03-04T11:00:00Z',
    updated_at: '2026-03-04T11:00:00Z',
    structured_observations: { mood: '3', adherence: 'good', weight_self_reported_kg: 88.0 },
  },
  {
    id: 'LOG-004',
    patient_id: 'PT-00198',
    coach_id: 'user_olwyn',
    clinic_id: 'feeltru',
    entry_type: 'check_in',
    entry_date: '2026-04-28T14:00:00Z',
    scheduled_date: '2026-04-28T14:00:00Z',
    duration_minutes: 30,
    modality: 'phone',
    summary: 'Excellent progress session. Sarah now at 84.2 kg — 8.3 kg total loss. Discussing dose escalation query for next clinical consult on 12 May. Patient highly motivated.',
    next_action: 'Clinical consult booked 12 May re dose escalation. Next coaching in 2 weeks.',
    status: 'completed',
    clinical_escalation_flag_id: null,
    consultation_id: null,
    created_at: '2026-04-28T14:35:00Z',
    updated_at: '2026-04-28T14:35:00Z',
    structured_observations: { mood: '5', adherence: 'excellent', weight_self_reported_kg: 84.2 },
  },

  // ── Emma Whitfield (PT-00412) ─────────────────────────────────────────────
  {
    id: 'LOG-005',
    patient_id: 'PT-00412',
    coach_id: 'user_olwyn',
    clinic_id: 'feeltru',
    entry_type: 'initial_call',
    entry_date: '2026-01-08T09:00:00Z',
    scheduled_date: '2026-01-08T09:00:00Z',
    duration_minutes: 45,
    modality: 'video',
    summary: 'Initial call with Emma. Programme expectations set. Emma has a history of yo-yo dieting and is cautious but optimistic. Agreed weekly check-ins initially. BMI 34.1 at baseline.',
    next_action: 'Weekly check-in for first month. Emma to complete mood tracker.',
    status: 'completed',
    clinical_escalation_flag_id: null,
    consultation_id: null,
    created_at: '2026-01-08T09:50:00Z',
    updated_at: '2026-01-08T09:50:00Z',
  },
  {
    id: 'LOG-006',
    patient_id: 'PT-00412',
    coach_id: 'user_olwyn',
    clinic_id: 'feeltru',
    entry_type: 'check_in',
    entry_date: '2026-04-28T11:00:00Z',
    scheduled_date: '2026-04-28T11:00:00Z',
    duration_minutes: 30,
    modality: 'video',
    summary: 'Positive session. Emma reporting significant improvement in energy and confidence. Total weight loss 7.7 kg since start. Discussing sustainable meal planning and habit formation. No side effects reported.',
    next_action: 'Follow up in 2 weeks; review meal plan adherence.',
    status: 'completed',
    clinical_escalation_flag_id: null,
    consultation_id: null,
    created_at: '2026-04-28T11:35:00Z',
    updated_at: '2026-04-28T11:35:00Z',
    structured_observations: { mood: '5', adherence: 'excellent', weight_self_reported_kg: 87.3 },
  },
  {
    id: 'LOG-007',
    patient_id: 'PT-00412',
    coach_id: 'user_olwyn',
    clinic_id: 'feeltru',
    entry_type: 'escalation',
    entry_date: '2026-04-15T10:00:00Z',
    scheduled_date: null,
    duration_minutes: null,
    modality: null,
    summary: 'Emma reported chest tightness and shortness of breath at rest over 48 hrs. Advised to seek urgent GP review. Flag raised for prescriber awareness. Emma confirmed she is contacting her GP today.',
    next_action: 'Await GP feedback. Prescriber to review and advise on continuation of treatment.',
    status: 'completed',
    clinical_escalation_flag_id: 'FLAG-002',
    consultation_id: null,
    created_at: '2026-04-15T10:15:00Z',
    updated_at: '2026-04-15T10:15:00Z',
  },

  // ── Fiona MacLeod (PT-00445) ──────────────────────────────────────────────
  {
    id: 'LOG-008',
    patient_id: 'PT-00445',
    coach_id: 'user_olwyn',
    clinic_id: 'feeltru',
    entry_type: 'initial_call',
    entry_date: '2026-01-28T13:00:00Z',
    scheduled_date: '2026-01-28T13:00:00Z',
    duration_minutes: 45,
    modality: 'phone',
    summary: 'Initial call with Fiona. BMI 39.5 at baseline — high clinical priority. Fiona has tried multiple weight-loss programmes before. Discussed realistic expectations and importance of consistent engagement. Identified work stress as a trigger for emotional eating.',
    next_action: 'Monthly check-ins. Refer to mindful-eating resource pack.',
    status: 'completed',
    clinical_escalation_flag_id: null,
    consultation_id: null,
    created_at: '2026-01-28T13:50:00Z',
    updated_at: '2026-01-28T13:50:00Z',
    structured_observations: { mood: '3', adherence: 'good' },
  },
  {
    id: 'LOG-009',
    patient_id: 'PT-00445',
    coach_id: 'user_olwyn',
    clinic_id: 'feeltru',
    entry_type: 'check_in',
    entry_date: '2026-04-30T13:00:00Z',
    scheduled_date: '2026-04-30T13:00:00Z',
    duration_minutes: 28,
    modality: 'phone',
    summary: 'Fiona expressing frustration with slower progress over the last 2 weeks. Discussed normal GLP-1 plateau phase. Side effects noted: persistent fatigue and reduced appetite beyond expected level. Weight self-reported at 97.8 kg.',
    next_action: 'Flag to prescriber for side-effect review. Fiona to contact clinic if symptoms worsen.',
    status: 'completed',
    clinical_escalation_flag_id: null,
    consultation_id: null,
    created_at: '2026-04-30T13:30:00Z',
    updated_at: '2026-04-30T13:30:00Z',
    structured_observations: { mood: '2', adherence: 'good', weight_self_reported_kg: 97.8 },
  },
  {
    id: 'LOG-010',
    patient_id: 'PT-00445',
    coach_id: 'user_olwyn',
    clinic_id: 'feeltru',
    entry_type: 'escalation',
    entry_date: '2026-05-02T09:00:00Z',
    scheduled_date: null,
    duration_minutes: null,
    modality: null,
    summary: 'Follow-up note: Fiona reported worsening fatigue and heart palpitations overnight. Advised to seek same-day GP or A&E review if symptoms escalate. Clinical escalation flag raised for prescriber.',
    next_action: 'Prescriber to review urgently. Pause coaching calls until medical review complete.',
    status: 'completed',
    clinical_escalation_flag_id: 'FLAG-001',
    consultation_id: null,
    created_at: '2026-05-02T09:10:00Z',
    updated_at: '2026-05-02T09:10:00Z',
  },

  // ── Zara Ahmed (PT-00378) ─────────────────────────────────────────────────
  {
    id: 'LOG-011',
    patient_id: 'PT-00378',
    coach_id: 'user_olwyn',
    clinic_id: 'feeltru',
    entry_type: 'initial_call',
    entry_date: '2026-05-09T10:00:00Z',
    scheduled_date: '2026-05-09T10:00:00Z',
    duration_minutes: null,
    modality: 'phone',
    summary: 'Attempted initial call — no answer. Left voicemail. Patient registered 7 May; first dispatch pending clinical check.',
    next_action: 'Retry initial call on 13 May.',
    status: 'no_show',
    clinical_escalation_flag_id: null,
    consultation_id: null,
    created_at: '2026-05-09T10:05:00Z',
    updated_at: '2026-05-09T10:05:00Z',
  },
  {
    id: 'LOG-012',
    patient_id: 'PT-00378',
    coach_id: 'user_olwyn',
    clinic_id: 'feeltru',
    entry_type: 'note',
    entry_date: '2026-05-10T09:30:00Z',
    scheduled_date: null,
    duration_minutes: null,
    modality: null,
    summary: 'Zara responded to voicemail via text — apologised for missing the call, asked to rebook for next week. Replied via Intercom confirming Tue 13 May at 10:00.',
    next_action: 'Initial call rescheduled to 2026-05-13T10:00:00Z.',
    status: 'completed',
    clinical_escalation_flag_id: null,
    consultation_id: null,
    created_at: '2026-05-10T09:35:00Z',
    updated_at: '2026-05-10T09:35:00Z',
  },
];

export async function listCoachingLogs(
  clinic_id: ClinicId,
  opts?: { patient_id?: string; coach_id?: string }
): Promise<CoachingLog[]> {
  await delay();
  let results = scopedToClinic(MOCK_COACHING_LOGS, clinic_id);
  if (opts?.patient_id) results = results.filter((l) => l.patient_id === opts.patient_id);
  if (opts?.coach_id)   results = results.filter((l) => l.coach_id   === opts.coach_id);
  return results;
}

export async function addCoachingLog(
  clinic_id: ClinicId,
  data: Omit<CoachingLog, 'id' | 'clinic_id' | 'created_at' | 'updated_at'>
): Promise<CoachingLog> {
  await delay(400);

  // ── Layer 1: role check ──────────────────────────────────────────────────
  if (!can(CURRENT_USER, 'write', 'coaching_log')) {
    throw new Error('FORBIDDEN: only Coach role may write coaching logs');
  }

  // ── Layer 2: coaching_enabled gate ──────────────────────────────────────
  const clinic = getClinicSync(clinic_id);
  if (!clinic.config.coaching_enabled) {
    throw new Error('FORBIDDEN: coaching is not enabled for this clinic');
  }

  // ── Layer 3: coach ownership of patient ─────────────────────────────────
  const patient = await getPatient(clinic_id, data.patient_id);
  if (patient.coach_id !== CURRENT_USER.id) {
    throw new Error('FORBIDDEN: patient is not assigned to you');
  }

  const log: CoachingLog = {
    ...data,
    id: `LOG-${String(MOCK_COACHING_LOGS.length + 1).padStart(3, '0')}`,
    clinic_id,
    created_at: NOW,
    updated_at: NOW,
  };

  MOCK_COACHING_LOGS.push(log);

  console.info('[AUDIT]', {
    action: 'coaching_log.created',
    log_id: log.id,
    patient_id: log.patient_id,
    coach_id: log.coach_id,
    clinic_id,
    timestamp: new Date().toISOString(),
  });

  return log;
}
