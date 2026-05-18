/**
 * Patient mutation helpers — task-288.
 *
 * Split out of `./patients.ts` so the fixture *data* file (MOCK_PATIENTS,
 * the change-log arrays, types, constants, read-only queries) no longer
 * has a static import of `../audit` and therefore no longer drags the
 * `@workspace/db` driver into the client bundle when a client component
 * pulls in patient data (e.g. `GlobalFABSpeedDial` → `MOCK_PATIENTS`).
 *
 * Anything in this file is a write/mutation. It is allowed to call
 * `recordAudit` because audit persistence is the explicit purpose of
 * these helpers. Read-only projections (`listPatientFlagChanges`,
 * `listPatientPreferredChannelChanges`, `listPatientWeightCheckIns`)
 * remain in `./patients.ts`.
 */

import type { ClinicId, Patient } from '../types';
import {
  APIError,
  CURRENT_USER,
  NOW,
  USERS_REGISTRY,
  delay,
} from '../constants';
import { can } from '@/lib/permissions';
import { recordAudit } from '../audit'; // Task-167 — durable spine
import {
  isValidEmail,
  isValidUkMobile,
  isValidUkPostcode,
  normaliseEmail,
  normalisePostcode,
  normaliseUkMobile,
} from '@/lib/validation/intake';
import {
  MOCK_PATIENTS,
  PATIENT_FLAG_CHANGES,
  PATIENT_WEIGHT_CHECKINS,
  PREFERRED_CHANNEL_CHANGES,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
  type PatientFlagChange,
  type WeightCheckInSource,
  type PatientWeightCheckIn,
} from './patients';

// ── Task-72 — updatePatientPreferredChannel ──────────────────────────────────
// Lets an authorised admin/owner change patient.contact.preferred_channel so
// downstream refund + cancellation notifications (Task-65 dispatcher) route to
// the right channel. 3-layer safety chain mirrors the AdminNote pattern:
//   Layer 1 (UI gate): editor only renders if can(actor, 'write', 'patients').
//   Layer 2 (server gate): can() check here; throws SAFETY_VIOLATION on denial.
//   Layer 3 (audit log): [AUDIT] entry per mutation (success + denial).
export async function updatePatientPreferredChannel(
  clinic_id: ClinicId,
  patient_id: string,
  preferred_channel: 'email' | 'sms' | 'phone',
  actor = CURRENT_USER,
): Promise<Patient> {
  await delay(250);

  if (!can(actor, 'write', 'patients')) {
    console.log('[AUDIT]', {
      event_type: 'patient_preferred_channel_updated',
      outcome: 'safety_violation',
      actor_id: actor.id,
      clinic_id,
      patient_id,
      attempted_channel: preferred_channel,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Insufficient permissions to update patient contact preferences');
  }

  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === patient_id);
  if (!patient) throw new APIError('NOT_FOUND', `Patient ${patient_id} not found in ${clinic_id}`);

  const previous_channel = patient.contact.preferred_channel;
  patient.contact = { ...patient.contact, preferred_channel };
  patient.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'patient_preferred_channel_updated',
    outcome: 'success',
    actor_id: actor.id,
    clinic_id,
    patient_id,
    previous_channel,
    new_channel: preferred_channel,
    phone_on_file: !!patient.contact.phone,
    timestamp: NOW,
  });
  void recordAudit({
    clinic_id,
    actor,
    entity: { type: 'patient', id: patient_id },
    event_type: 'patient_preferred_channel_updated',
    summary: `Preferred channel for ${patient_id} changed from ${previous_channel} to ${preferred_channel}.`,
    before: { preferred_channel: previous_channel },
    after: { preferred_channel },
  });

  // Task-103 — project the same success record into the in-memory change log
  // so the per-patient Notification log can show an inline breadcrumb. This
  // is NOT a new audit event — it is the same event already emitted above,
  // captured in a form the UI can read.
  if (previous_channel !== preferred_channel) {
    const seq = String(PREFERRED_CHANNEL_CHANGES.length + 1).padStart(3, '0');
    const registryActor = USERS_REGISTRY[actor.id];
    PREFERRED_CHANNEL_CHANGES.push({
      id: `PCC-${seq}`,
      clinic_id,
      patient_id,
      previous_channel,
      new_channel: preferred_channel,
      actor_id: actor.id,
      actor_name: registryActor?.full_name ?? actor.full_name ?? actor.id,
      changed_at: NOW,
    });
  }

  return patient;
}

// ── Task-244 — acknowledge patient-submitted weight check-in ─────────────────
export async function acknowledgePatientWeightCheckIn(
  clinic_id: ClinicId,
  checkin_id: string,
  actor = CURRENT_USER,
): Promise<PatientWeightCheckIn> {
  await delay(150);
  if (!can(actor, 'write', 'patients')) {
    throw new APIError(
      'SAFETY_VIOLATION',
      'Insufficient permissions to acknowledge weight check-in',
    );
  }
  const row = PATIENT_WEIGHT_CHECKINS.find(
    (c) => c.clinic_id === clinic_id && c.id === checkin_id,
  );
  if (!row) throw new APIError('NOT_FOUND', `Check-in ${checkin_id} not found`);
  if (row.coach_acknowledged_at === null) {
    row.coach_acknowledged_at = NOW;
    row.coach_acknowledged_by = actor.id;
    console.log('[AUDIT]', {
      event_type: 'patient_weight_checkin_acknowledged',
      outcome: 'success',
      actor_id: actor.id,
      clinic_id,
      patient_id: row.patient_id,
      checkin_id,
      source: row.source,
      timestamp: NOW,
    });
  }
  return row;
}

// ── Task-162 — recordPatientWeight — log a fresh weight check-in ─────────────
export async function recordPatientWeight(
  clinic_id: ClinicId,
  patient_id: string,
  weight_kg: number,
  actor = CURRENT_USER,
  opts: { source?: WeightCheckInSource } = {},
): Promise<Patient> {
  await delay(250);

  const source: WeightCheckInSource = opts.source ?? 'staff';

  if (source === 'staff' && !can(actor, 'write', 'patients')) {
    console.log('[AUDIT]', {
      event_type: 'patient_weight_recorded',
      outcome: 'safety_violation',
      actor_id: actor.id,
      clinic_id,
      patient_id,
      source,
      attempted_weight_kg: weight_kg,
      timestamp: NOW,
    });
    throw new APIError(
      'SAFETY_VIOLATION',
      'Insufficient permissions to record patient weight',
    );
  }

  if (
    typeof weight_kg !== 'number' ||
    !Number.isFinite(weight_kg) ||
    weight_kg < WEIGHT_MIN_KG ||
    weight_kg > WEIGHT_MAX_KG
  ) {
    throw new APIError(
      'VALIDATION',
      `Weight must be between ${WEIGHT_MIN_KG} and ${WEIGHT_MAX_KG} kg`,
    );
  }

  const patient = MOCK_PATIENTS.find(
    (p) => p.clinic_id === clinic_id && p.id === patient_id,
  );
  if (!patient) {
    throw new APIError('NOT_FOUND', `Patient ${patient_id} not found in ${clinic_id}`);
  }

  const heightM = patient.baseline.height_cm / 100;
  const roundedWeight = Math.round(weight_kg * 10) / 10;
  const bmi = Math.round((roundedWeight / (heightM * heightM)) * 10) / 10;
  const previousWeight = patient.latest.weight_kg;
  const delta = Math.round((roundedWeight - patient.baseline.baseline_weight_kg) * 10) / 10;

  patient.latest = { weight_kg: roundedWeight, bmi, recorded_at: NOW };
  patient.updated_at = NOW;

  const seq = String(PATIENT_WEIGHT_CHECKINS.length + 1).padStart(3, '0');
  const registryActor = USERS_REGISTRY[actor.id];
  const actorId = source === 'patient' ? patient.id : actor.id;
  const actorName =
    source === 'patient'
      ? `${patient.demographic.full_name} (patient self-report)`
      : (registryActor?.full_name ?? actor.full_name ?? actor.id);
  PATIENT_WEIGHT_CHECKINS.push({
    id: `PWC-${seq}`,
    clinic_id,
    patient_id,
    weight_kg: roundedWeight,
    bmi,
    previous_weight_kg: previousWeight,
    delta_vs_baseline_kg: delta,
    actor_id: actorId,
    actor_name: actorName,
    recorded_at: NOW,
    source,
    coach_acknowledged_at: source === 'patient' ? null : NOW,
    coach_acknowledged_by: source === 'patient' ? null : actor.id,
  });

  console.log('[AUDIT]', {
    event_type: 'patient_weight_recorded',
    outcome: 'success',
    actor_id: actorId,
    source,
    clinic_id,
    patient_id,
    previous_weight_kg: previousWeight,
    new_weight_kg: roundedWeight,
    new_bmi: bmi,
    delta_vs_baseline_kg: delta,
    timestamp: NOW,
  });

  return patient;
}

// ── BLD-10.4 — purgePatientData — UK GDPR Art 5(1)(c) data minimisation ──────
export async function purgePatientData(
  clinic_id: ClinicId,
  patient_id: string,
  actor = CURRENT_USER
): Promise<void> {
  await delay(500);

  if (!actor.roles.includes('Owner')) {
    throw new APIError('PERMISSION_DENIED', `User ${actor.id} cannot purge patient data`);
  }

  const idx = MOCK_PATIENTS.findIndex((p) => p.clinic_id === clinic_id && p.id === patient_id);
  if (idx === -1) throw new APIError('NOT_FOUND', `Patient ${patient_id} not found in ${clinic_id}`);

  const patient = MOCK_PATIENTS[idx];

  MOCK_PATIENTS.splice(idx, 1);

  console.log('[AUDIT]', {
    event_type: 'patient_data_purged',
    outcome: 'success',
    actor_id: actor.id,
    clinic_id,
    patient_id,
    patient_name_hash: patient.demographic.full_name.length,
    legal_basis: 'UK GDPR Art 5(1)(c) — data minimisation — gender eligibility mismatch (DEC-16)',
    legal_gateway: 'UK Equality Act 2010 Sch 3 Para 27',
    primed_api_purge: 'PENDING — V1.2 concern (requires Yohan backend wiring)',
    timestamp: NOW,
  });
  void recordAudit({
    clinic_id,
    actor,
    entity: { type: 'patient', id: patient_id },
    event_type: 'patient_data_purged',
    summary: `Patient ${patient_id} data purged from Livera mirror by ${actor.full_name} (GDPR Art 5(1)(c)).`,
    after: {
      patient_name_hash: patient.demographic.full_name.length,
      legal_basis: 'UK GDPR Art 5(1)(c)',
      legal_gateway: 'UK Equality Act 2010 Sch 3 Para 27',
      primed_api_purge: 'PENDING',
    },
  });
}

// ── Task-225 — updatePatientVip / updatePatientStatus / updatePatientCoach ──
function pushFlagChange(row: Omit<PatientFlagChange, 'id'>): void {
  const seq = String(PATIENT_FLAG_CHANGES.length + 1).padStart(3, '0');
  PATIENT_FLAG_CHANGES.push({ id: `PFC-${seq}`, ...row });
}

export async function updatePatientVip(
  clinic_id: ClinicId,
  patient_id: string,
  vip: boolean,
  actor = CURRENT_USER,
): Promise<Patient> {
  await delay(250);

  if (!can(actor, 'write', 'patients')) {
    console.log('[AUDIT]', {
      event_type: 'patient_vip_updated',
      outcome: 'safety_violation',
      actor_id: actor.id,
      clinic_id,
      patient_id,
      attempted_vip: vip,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Insufficient permissions to update patient VIP flag');
  }

  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === patient_id);
  if (!patient) throw new APIError('NOT_FOUND', `Patient ${patient_id} not found in ${clinic_id}`);

  const previous = patient.vip;
  if (previous === vip) return patient;

  patient.vip = vip;
  patient.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'patient_vip_updated',
    outcome: 'success',
    actor_id: actor.id,
    clinic_id,
    patient_id,
    previous_vip: previous,
    new_vip: vip,
    timestamp: NOW,
  });
  void recordAudit({
    clinic_id,
    actor,
    entity: { type: 'patient', id: patient_id },
    event_type: 'patient_vip_updated',
    summary: `VIP flag for ${patient_id} ${vip ? 'set' : 'cleared'} by ${actor.full_name}.`,
    before: { vip: previous },
    after: { vip },
  });

  const registryActor = USERS_REGISTRY[actor.id];
  pushFlagChange({
    clinic_id,
    patient_id,
    kind: 'vip',
    previous_value: String(previous),
    new_value: String(vip),
    previous_display: previous ? 'Yes' : 'No',
    new_display: vip ? 'Yes' : 'No',
    actor_id: actor.id,
    actor_name: registryActor?.full_name ?? actor.full_name ?? actor.id,
    changed_at: NOW,
  });

  return patient;
}

export type PatientStatus = Patient['status'];
const PATIENT_STATUSES: readonly PatientStatus[] = ['new', 'active', 'monitoring', 'suspended'] as const;

export async function updatePatientStatus(
  clinic_id: ClinicId,
  patient_id: string,
  status: PatientStatus,
  actor = CURRENT_USER,
): Promise<Patient> {
  await delay(250);

  if (!can(actor, 'write', 'patients')) {
    console.log('[AUDIT]', {
      event_type: 'patient_status_updated',
      outcome: 'safety_violation',
      actor_id: actor.id,
      clinic_id,
      patient_id,
      attempted_status: status,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Insufficient permissions to update patient status');
  }

  if (!PATIENT_STATUSES.includes(status)) {
    throw new APIError('VALIDATION', `Invalid patient status: ${status}`);
  }

  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === patient_id);
  if (!patient) throw new APIError('NOT_FOUND', `Patient ${patient_id} not found in ${clinic_id}`);

  const previous = patient.status;
  if (previous === status) return patient;

  patient.status = status;
  patient.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'patient_status_updated',
    outcome: 'success',
    actor_id: actor.id,
    clinic_id,
    patient_id,
    previous_status: previous,
    new_status: status,
    timestamp: NOW,
  });
  void recordAudit({
    clinic_id,
    actor,
    entity: { type: 'patient', id: patient_id },
    event_type: 'patient_status_updated',
    summary: `Status for ${patient_id} changed from ${previous} to ${status}.`,
    before: { status: previous },
    after: { status },
  });

  const registryActor = USERS_REGISTRY[actor.id];
  pushFlagChange({
    clinic_id,
    patient_id,
    kind: 'status',
    previous_value: previous,
    new_value: status,
    previous_display: previous,
    new_display: status,
    actor_id: actor.id,
    actor_name: registryActor?.full_name ?? actor.full_name ?? actor.id,
    changed_at: NOW,
  });

  return patient;
}

export async function updatePatientCoach(
  clinic_id: ClinicId,
  patient_id: string,
  coach_id: string | null,
  actor = CURRENT_USER,
): Promise<Patient> {
  await delay(250);

  if (!can(actor, 'write', 'patients')) {
    console.log('[AUDIT]', {
      event_type: 'patient_coach_updated',
      outcome: 'safety_violation',
      actor_id: actor.id,
      clinic_id,
      patient_id,
      attempted_coach_id: coach_id,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Insufficient permissions to update patient coach');
  }

  if (coach_id !== null) {
    const candidate = USERS_REGISTRY[coach_id];
    if (!candidate || !candidate.roles.includes('Coach')) {
      throw new APIError('VALIDATION', `User ${coach_id} is not a coach`);
    }
    if (!candidate.active) {
      throw new APIError('VALIDATION', `Coach ${coach_id} is not active`);
    }
    if (candidate.active_clinic_id !== clinic_id) {
      throw new APIError(
        'VALIDATION',
        `Coach ${coach_id} does not belong to clinic ${clinic_id}`,
      );
    }
  }

  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === patient_id);
  if (!patient) throw new APIError('NOT_FOUND', `Patient ${patient_id} not found in ${clinic_id}`);

  const previous = patient.coach_id ?? null;
  if (previous === coach_id) return patient;

  patient.coach_id = coach_id;
  patient.updated_at = NOW;

  const previousName = previous ? (USERS_REGISTRY[previous]?.full_name ?? previous) : 'Unassigned';
  const newName = coach_id ? (USERS_REGISTRY[coach_id]?.full_name ?? coach_id) : 'Unassigned';

  console.log('[AUDIT]', {
    event_type: 'patient_coach_updated',
    outcome: 'success',
    actor_id: actor.id,
    clinic_id,
    patient_id,
    previous_coach_id: previous,
    new_coach_id: coach_id,
    timestamp: NOW,
  });
  void recordAudit({
    clinic_id,
    actor,
    entity: { type: 'patient', id: patient_id },
    event_type: 'patient_coach_updated',
    summary: `Coach for ${patient_id} changed from ${previousName} to ${newName}.`,
    before: { coach_id: previous },
    after: { coach_id },
  });

  const registryActor = USERS_REGISTRY[actor.id];
  pushFlagChange({
    clinic_id,
    patient_id,
    kind: 'coach',
    previous_value: previous ?? 'unassigned',
    new_value: coach_id ?? 'unassigned',
    previous_display: previousName,
    new_display: newName,
    actor_id: actor.id,
    actor_name: registryActor?.full_name ?? actor.full_name ?? actor.id,
    changed_at: NOW,
  });

  return patient;
}

// ── Task-250 — updatePatientPhone / updatePatientPostcode ───────────────────
export async function updatePatientPhone(
  clinic_id: ClinicId,
  patient_id: string,
  raw_phone: string,
  actor = CURRENT_USER,
): Promise<Patient> {
  await delay(250);

  if (!can(actor, 'write', 'patients')) {
    console.log('[AUDIT]', {
      event_type: 'patient_phone_updated',
      outcome: 'safety_violation',
      actor_id: actor.id,
      clinic_id,
      patient_id,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Insufficient permissions to update patient phone');
  }

  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === patient_id);
  if (!patient) throw new APIError('NOT_FOUND', `Patient ${patient_id} not found in ${clinic_id}`);

  if (!isValidUkMobile(raw_phone)) {
    console.log('[AUDIT]', {
      event_type: 'patient_phone_updated',
      outcome: 'validation_failed',
      actor_id: actor.id,
      clinic_id,
      patient_id,
      attempted_value: raw_phone,
      timestamp: NOW,
    });
    throw new APIError(
      'VALIDATION',
      'Enter a valid UK mobile number (e.g. 07700 900123).',
    );
  }

  const normalised = normaliseUkMobile(raw_phone)!;
  const previous_phone = patient.contact.phone;
  patient.contact = { ...patient.contact, phone: normalised };
  patient.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'patient_phone_updated',
    outcome: 'success',
    actor_id: actor.id,
    clinic_id,
    patient_id,
    previous_phone,
    new_phone: normalised,
    timestamp: NOW,
  });
  void recordAudit({
    clinic_id,
    actor,
    entity: { type: 'patient', id: patient_id },
    event_type: 'patient_phone_updated',
    summary: `Phone for ${patient_id} updated.`,
    before: { phone: previous_phone },
    after: { phone: normalised },
  });

  return patient;
}

export async function updatePatientPostcode(
  clinic_id: ClinicId,
  patient_id: string,
  raw_postcode: string,
  actor = CURRENT_USER,
): Promise<Patient> {
  await delay(250);

  if (!can(actor, 'write', 'patients')) {
    console.log('[AUDIT]', {
      event_type: 'patient_postcode_updated',
      outcome: 'safety_violation',
      actor_id: actor.id,
      clinic_id,
      patient_id,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Insufficient permissions to update patient address');
  }

  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === patient_id);
  if (!patient) throw new APIError('NOT_FOUND', `Patient ${patient_id} not found in ${clinic_id}`);

  if (!isValidUkPostcode(raw_postcode)) {
    console.log('[AUDIT]', {
      event_type: 'patient_postcode_updated',
      outcome: 'validation_failed',
      actor_id: actor.id,
      clinic_id,
      patient_id,
      attempted_value: raw_postcode,
      timestamp: NOW,
    });
    throw new APIError(
      'VALIDATION',
      'Enter a valid UK postcode (e.g. M1 2AB).',
    );
  }

  const normalised = normalisePostcode(raw_postcode);
  const previous_postcode = patient.demographic.address?.postcode ?? '';
  patient.demographic = {
    ...patient.demographic,
    address: { ...patient.demographic.address, postcode: normalised },
  };
  patient.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'patient_postcode_updated',
    outcome: 'success',
    actor_id: actor.id,
    clinic_id,
    patient_id,
    previous_postcode,
    new_postcode: normalised,
    timestamp: NOW,
  });
  void recordAudit({
    clinic_id,
    actor,
    entity: { type: 'patient', id: patient_id },
    event_type: 'patient_postcode_updated',
    summary: `Postcode for ${patient_id} updated.`,
    before: { postcode: previous_postcode },
    after: { postcode: normalised },
  });

  return patient;
}

// ── Task-264 — updatePatientEmail ───────────────────────────────────────────
export async function updatePatientEmail(
  clinic_id: ClinicId,
  patient_id: string,
  raw_email: string,
  actor = CURRENT_USER,
): Promise<Patient> {
  await delay(250);

  if (!can(actor, 'write', 'patients')) {
    console.log('[AUDIT]', {
      event_type: 'patient_email_updated',
      outcome: 'safety_violation',
      actor_id: actor.id,
      clinic_id,
      patient_id,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Insufficient permissions to update patient email');
  }

  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === patient_id);
  if (!patient) throw new APIError('NOT_FOUND', `Patient ${patient_id} not found in ${clinic_id}`);

  if (!isValidEmail(raw_email)) {
    console.log('[AUDIT]', {
      event_type: 'patient_email_updated',
      outcome: 'validation_failed',
      actor_id: actor.id,
      clinic_id,
      patient_id,
      attempted_value: raw_email,
      timestamp: NOW,
    });
    throw new APIError(
      'VALIDATION',
      'Enter a valid email address (e.g. name@example.com).',
    );
  }

  const normalised = normaliseEmail(raw_email);
  const previous_email = patient.contact.email;
  if (normalised === previous_email) return patient;

  patient.contact = { ...patient.contact, email: normalised };
  patient.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'patient_email_updated',
    outcome: 'success',
    actor_id: actor.id,
    clinic_id,
    patient_id,
    previous_email,
    new_email: normalised,
    timestamp: NOW,
  });
  void recordAudit({
    clinic_id,
    actor,
    entity: { type: 'patient', id: patient_id },
    event_type: 'patient_email_updated',
    summary: `Email for ${patient_id} updated from ${previous_email} to ${normalised}.`,
    before: { email: previous_email },
    after: { email: normalised },
  });

  return patient;
}

// ── Task-247 — BMI photo evidence review ─────────────────────────────────────
export async function confirmBmiEvidence(
  clinic_id: ClinicId,
  patient_id: string,
  actor = CURRENT_USER,
): Promise<Patient> {
  await delay(250);

  if (!can(actor, 'decide', 'orders')) {
    console.log('[AUDIT]', {
      event_type: 'patient_bmi_evidence_confirmed',
      outcome: 'safety_violation',
      actor_id: actor.id,
      clinic_id,
      patient_id,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Insufficient permissions to confirm BMI evidence');
  }

  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === patient_id);
  if (!patient) throw new APIError('NOT_FOUND', `Patient ${patient_id} not found in ${clinic_id}`);

  const previous = patient.verification.bmi_verified_at;
  patient.verification = { ...patient.verification, bmi_verified_at: NOW };
  patient.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'patient_bmi_evidence_confirmed',
    outcome: 'success',
    actor_id: actor.id,
    clinic_id,
    patient_id,
    previous_bmi_verified_at: previous,
    new_bmi_verified_at: NOW,
    timestamp: NOW,
  });
  void recordAudit({
    clinic_id,
    actor,
    entity: { type: 'patient', id: patient_id },
    event_type: 'patient_bmi_evidence_confirmed',
    summary: `BMI photo evidence for ${patient_id} confirmed by ${actor.full_name}.`,
    before: { bmi_verified_at: previous },
    after: { bmi_verified_at: NOW },
  });

  return patient;
}

export async function rejectBmiEvidence(
  clinic_id: ClinicId,
  patient_id: string,
  actor = CURRENT_USER,
): Promise<Patient> {
  await delay(250);

  if (!can(actor, 'decide', 'orders')) {
    console.log('[AUDIT]', {
      event_type: 'patient_bmi_evidence_rejected',
      outcome: 'safety_violation',
      actor_id: actor.id,
      clinic_id,
      patient_id,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Insufficient permissions to reject BMI evidence');
  }

  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === patient_id);
  if (!patient) throw new APIError('NOT_FOUND', `Patient ${patient_id} not found in ${clinic_id}`);

  const previous = patient.verification.bmi_verified_at;
  patient.verification = { ...patient.verification, bmi_verified_at: null };
  patient.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'patient_bmi_evidence_rejected',
    outcome: 'success',
    actor_id: actor.id,
    clinic_id,
    patient_id,
    previous_bmi_verified_at: previous,
    timestamp: NOW,
  });
  void recordAudit({
    clinic_id,
    actor,
    entity: { type: 'patient', id: patient_id },
    event_type: 'patient_bmi_evidence_rejected',
    summary: `BMI photo evidence for ${patient_id} rejected by ${actor.full_name}.`,
    before: { bmi_verified_at: previous },
    after: { bmi_verified_at: null },
  });

  return patient;
}
