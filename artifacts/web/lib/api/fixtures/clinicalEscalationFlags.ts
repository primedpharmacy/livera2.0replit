/**
 * Clinical escalation flag fixtures — BLD-2.7.
 *
 * Coach-raised flags (manual; no rule_version_id per DEC-27).
 * SLA: 24 working hours from raised_at.
 *
 * 3-layer safety chain on raiseClinicalEscalation:
 *   1. Role: caller must have Coach role
 *   2. Clinic: coaching_enabled must be true
 *   3. Ownership: patient.coach_id === caller.id
 *
 * FCM stub: console.info('[FCM]', userIds, payload)
 */

import type { ClinicId, ClinicalEscalationFlag } from '../types';
import { delay, scopedToClinic, CURRENT_USER, NOW } from '../constants';
import { getClinicSync } from './clinics';
import { getPatient } from './patients';
import { addWorkingHours } from '@/lib/utils/workingHours';
import { can } from '@/lib/permissions';

export const MOCK_ESCALATION_FLAGS: ClinicalEscalationFlag[] = [
  {
    id: 'FLAG-001',
    patient_id: 'PT-00445',
    clinic_id: 'feeltru',
    raised_by_coach_id: 'user_olwyn',
    raised_at: '2026-05-02T09:00:00Z',
    coaching_log_id: 'LOG-010',
    severity: 'medium',
    description: 'Fiona MacLeod reporting persistent fatigue and heart palpitations. Worsening overnight. Coach advised same-day GP or A&E review. Prescriber awareness required.',
    status: 'open',
    acknowledged_by_user_id: null,
    acknowledged_at: null,
    resolved_by_user_id: null,
    resolved_at: null,
    resolution_notes: null,
    sla_deadline: '2026-05-05T09:00:00Z', // raised_at + 24 working hours
  },
  {
    id: 'FLAG-002',
    patient_id: 'PT-00412',
    clinic_id: 'feeltru',
    raised_by_coach_id: 'user_olwyn',
    raised_at: '2026-04-15T10:00:00Z',
    coaching_log_id: 'LOG-007',
    severity: 'low',
    description: 'Emma Whitfield reported chest tightness and shortness of breath at rest. Coach advised urgent GP review. Emma confirmed she is contacting her GP today.',
    status: 'resolved',
    acknowledged_by_user_id: 'user_qadir',
    acknowledged_at: '2026-04-15T11:30:00Z',
    resolved_by_user_id: 'user_qadir',
    resolved_at: '2026-04-16T14:00:00Z',
    resolution_notes: 'GP reviewed. Symptoms attributed to musculoskeletal cause. Treatment safe to continue. Emma cleared to resume programme.',
    sla_deadline: '2026-04-17T10:00:00Z',
  },
];

export async function listClinicalEscalationFlags(
  clinic_id: ClinicId,
  opts?: { patient_id?: string; status?: ClinicalEscalationFlag['status'] }
): Promise<ClinicalEscalationFlag[]> {
  await delay();
  let results = scopedToClinic(MOCK_ESCALATION_FLAGS, clinic_id);
  if (opts?.patient_id) results = results.filter((f) => f.patient_id === opts.patient_id);
  if (opts?.status)     results = results.filter((f) => f.status     === opts.status);
  return results;
}

export async function getClinicalEscalationFlag(
  clinic_id: ClinicId,
  id: string
): Promise<ClinicalEscalationFlag> {
  await delay();
  const flag = MOCK_ESCALATION_FLAGS.find(
    (f) => f.clinic_id === clinic_id && f.id === id
  );
  if (!flag) throw new Error('NOT_FOUND: escalation flag not found');
  return flag;
}

export async function raiseClinicalEscalation(
  clinic_id: ClinicId,
  data: {
    patient_id: string;
    coaching_log_id: string;
    severity: ClinicalEscalationFlag['severity'];
    description: string;
  }
): Promise<ClinicalEscalationFlag> {
  await delay(400);

  // ── Layer 1: role check ──────────────────────────────────────────────────
  if (!can(CURRENT_USER, 'write', 'coaching_log')) {
    throw new Error('FORBIDDEN: only Coach role may raise clinical escalations');
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

  const sla_deadline = addWorkingHours(
    NOW,
    clinic.config.default_slas.coach_escalation_response_wh,
    clinic.config.holiday_calendar
  );

  const flag: ClinicalEscalationFlag = {
    id: `FLAG-${String(MOCK_ESCALATION_FLAGS.length + 1).padStart(3, '0')}`,
    patient_id: data.patient_id,
    clinic_id,
    raised_by_coach_id: CURRENT_USER.id,
    raised_at: NOW,
    coaching_log_id: data.coaching_log_id,
    severity: data.severity,
    description: data.description,
    status: 'open',
    acknowledged_by_user_id: null,
    acknowledged_at: null,
    resolved_by_user_id: null,
    resolved_at: null,
    resolution_notes: null,
    sla_deadline,
  };

  MOCK_ESCALATION_FLAGS.push(flag);

  console.info('[AUDIT]', {
    action: 'clinical_escalation.raised',
    flag_id: flag.id,
    patient_id: flag.patient_id,
    coach_id: flag.raised_by_coach_id,
    severity: flag.severity,
    clinic_id,
    timestamp: new Date().toISOString(),
  });

  // ── FCM stub — notify all Prescribers + Owner at the clinic ─────────────
  const userIds = ['user_qadir']; // placeholder; Wave 11 will query team roster
  const payload = {
    title: `Clinical escalation — ${data.severity.toUpperCase()}`,
    body: `Patient ${data.patient_id}: ${data.description.slice(0, 80)}...`,
    flag_id: flag.id,
  };
  console.info('[FCM]', userIds, payload);

  return flag;
}

export async function acknowledgeClinicalEscalation(
  clinic_id: ClinicId,
  flag_id: string
): Promise<ClinicalEscalationFlag> {
  await delay(300);

  // ── Layer 1: role check (Owner or Prescriber) ────────────────────────────
  const hasRole = CURRENT_USER.roles.some((r) =>
    ['Owner', 'Prescriber', 'Admin', 'RM'].includes(r)
  );
  if (!hasRole) throw new Error('FORBIDDEN: insufficient role to acknowledge escalation');

  // ── Layer 2: coaching_enabled gate ──────────────────────────────────────
  const clinic = getClinicSync(clinic_id);
  if (!clinic.config.coaching_enabled) {
    throw new Error('FORBIDDEN: coaching is not enabled for this clinic');
  }

  const flag = MOCK_ESCALATION_FLAGS.find(
    (f) => f.clinic_id === clinic_id && f.id === flag_id
  );
  if (!flag) throw new Error('NOT_FOUND: escalation flag not found');

  flag.status = 'acknowledged';
  flag.acknowledged_by_user_id = CURRENT_USER.id;
  flag.acknowledged_at = NOW;

  console.info('[AUDIT]', {
    action: 'clinical_escalation.acknowledged',
    flag_id,
    user_id: CURRENT_USER.id,
    clinic_id,
    timestamp: new Date().toISOString(),
  });

  return flag;
}

export async function resolveClinicalEscalation(
  clinic_id: ClinicId,
  flag_id: string,
  resolution_notes: string
): Promise<ClinicalEscalationFlag> {
  await delay(300);

  // ── Layer 1: role check ──────────────────────────────────────────────────
  const hasRole = CURRENT_USER.roles.some((r) =>
    ['Owner', 'Prescriber', 'Admin', 'RM'].includes(r)
  );
  if (!hasRole) throw new Error('FORBIDDEN: insufficient role to resolve escalation');

  // ── Layer 2: coaching_enabled gate ──────────────────────────────────────
  const clinic = getClinicSync(clinic_id);
  if (!clinic.config.coaching_enabled) {
    throw new Error('FORBIDDEN: coaching is not enabled for this clinic');
  }

  const flag = MOCK_ESCALATION_FLAGS.find(
    (f) => f.clinic_id === clinic_id && f.id === flag_id
  );
  if (!flag) throw new Error('NOT_FOUND: escalation flag not found');

  flag.status = 'resolved';
  flag.resolved_by_user_id = CURRENT_USER.id;
  flag.resolved_at = NOW;
  flag.resolution_notes = resolution_notes;

  console.info('[AUDIT]', {
    action: 'clinical_escalation.resolved',
    flag_id,
    user_id: CURRENT_USER.id,
    clinic_id,
    timestamp: new Date().toISOString(),
  });

  return flag;
}
