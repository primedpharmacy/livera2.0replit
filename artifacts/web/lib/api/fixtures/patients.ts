/**
 * Livera patient fixtures — server-side mutators.
 *
 * Pure data lives in `./patients.data.ts` (client-safe). This module owns the
 * mutating fixture functions that pull in the audit / db spine. The audit
 * module itself keeps `@workspace/db` out of the client bundle via a
 * webpack-ignored dynamic import — see `lib/api/audit.ts` for the boundary
 * rationale.
 */

import type { ClinicId, Patient } from '../types';
import { delay, APIError, USERS_REGISTRY } from '../constants';

// NOTE (task-288): mutation helpers that call `recordAudit` (and therefore
// transitively pull `@workspace/db` → `pg`) live in `./patientMutations.ts`
// so client components that only need fixture *data* (e.g. MOCK_PATIENTS in
// GlobalFABSpeedDial) do not drag the Postgres driver into the browser
// bundle. Keep this file free of any `../audit` import.

// Re-export the pure data so existing server-side callers keep working
// unchanged (e.g. `import { MOCK_PATIENTS } from '@/lib/api/fixtures/patients'`).
export {
  MOCK_PATIENTS,
  PREFERRED_CHANNEL_CHANGES,
  PATIENT_FLAG_CHANGES,
  PATIENT_WEIGHT_CHECKINS,
  WEIGHT_MIN_KG,
  WEIGHT_MAX_KG,
} from './patients.data';
export type {
  PatientPreferredChannelChange,
  PatientFlagChange,
  PatientFlagChangeKind,
  PatientWeightCheckIn,
  WeightCheckInSource,
} from './patients.data';

import {
  MOCK_PATIENTS,
  PREFERRED_CHANNEL_CHANGES,
  PATIENT_FLAG_CHANGES,
  PATIENT_WEIGHT_CHECKINS,
  WEIGHT_MIN_KG,
  WEIGHT_MAX_KG,
} from './patients.data';
import type {
  PatientPreferredChannelChange,
  PatientFlagChange,
  PatientWeightCheckIn,
  WeightCheckInSource,
} from './patients.data';


export async function listPatientPreferredChannelChanges(
  clinic_id: ClinicId,
  opts?: { patient_id?: string },
): Promise<PatientPreferredChannelChange[]> {
  await delay();
  let results = PREFERRED_CHANNEL_CHANGES.filter((c) => c.clinic_id === clinic_id);
  if (opts?.patient_id) results = results.filter((c) => c.patient_id === opts.patient_id);
  return results;
}

export async function listPatientFlagChanges(
  clinic_id: ClinicId,
  opts?: { patient_id?: string },
): Promise<PatientFlagChange[]> {
  await delay();
  let results = PATIENT_FLAG_CHANGES.filter((c) => c.clinic_id === clinic_id);
  if (opts?.patient_id) results = results.filter((c) => c.patient_id === opts.patient_id);
  return results;
}

export async function listPatients(
  clinic_id: ClinicId,
  opts?: { search?: string; status?: Patient['status']; coach_id?: string }
): Promise<Patient[]> {
  await delay();
  let results = MOCK_PATIENTS.filter((p) => p.clinic_id === clinic_id);
  if (opts?.search) {
    const q = opts.search.toLowerCase();
    results = results.filter(
      (p) =>
        p.demographic.full_name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }
  if (opts?.status)   results = results.filter((p) => p.status     === opts.status);
  if (opts?.coach_id) results = results.filter((p) => p.coach_id   === opts.coach_id);
  return results;
}

export async function getPatient(clinic_id: ClinicId, id: string): Promise<Patient> {
  await delay();
  const p = MOCK_PATIENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!p) throw new APIError('NOT_FOUND', 'Patient not found');
  return p;
}

// ── Task-162 — recordPatientWeight — log a fresh weight check-in ─────────────
// Now that intake captures a real baseline (task-114), staff (and eventually
// patients themselves) need a way to record a new weight reading so trend
// calculations against the baseline keep moving past day one. Today
// patient.latest is only seeded once at intake — this fixture flips that into
// a live, mutable check-in.
//
// 3-layer safety chain mirrors updatePatientPreferredChannel:
//   Layer 1 (UI gate): caller derives canEdit from can(actor, 'write','patients').
//   Layer 2 (server gate): can() check here; SAFETY_VIOLATION on denial.
//   Layer 3 (audit log): [AUDIT] entry per mutation (success + denial).
//
// BMI is recomputed from the existing baseline height (intake-locked); we do
// not allow callers to mutate height here. Valid range matches intake:
// 30–300 kg. Out-of-range inputs throw VALIDATION so the UI can surface them.


export async function listPatientWeightCheckIns(
  clinic_id: ClinicId,
  opts?: { patient_id?: string; source?: WeightCheckInSource; unacknowledgedOnly?: boolean },
): Promise<PatientWeightCheckIn[]> {
  await delay();
  let results = PATIENT_WEIGHT_CHECKINS.filter((c) => c.clinic_id === clinic_id);
  if (opts?.patient_id) results = results.filter((c) => c.patient_id === opts.patient_id);
  if (opts?.source) results = results.filter((c) => c.source === opts.source);
  if (opts?.unacknowledgedOnly) results = results.filter((c) => c.coach_acknowledged_at === null);
  return results;
}


// Helper for the editor: list coach-role users in a clinic. Stays in-fixture
// so the page can compute the option list server-side and pass it down.
export function listCoachOptions(clinic_id: ClinicId): Array<{ id: string; full_name: string }> {
  return Object.values(USERS_REGISTRY)
    .filter((u) => u.active && u.roles.includes('Coach') && u.active_clinic_id === clinic_id)
    .map((u) => ({ id: u.id, full_name: u.full_name }));
}

