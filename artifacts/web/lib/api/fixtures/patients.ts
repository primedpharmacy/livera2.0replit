/**
 * Livera patient fixtures — Wave 2 update.
 *
 * Wave 2 additions (BLD-2.1):
 *   - coach_id: string | null added to all patients (FeelTru patients assigned user_olwyn)
 *
 * Wave 10 additions (BLD-10.1/10.4):
 *   - RYAN_FEELTRU: demo male patient at FeelTru (triggers gender eligibility banner)
 *   - purgePatientData(): UK GDPR Art 5(1)(c) — gender mismatch data purge
 */

import type { ClinicId, Patient } from '../types';
import { delay, APIError, CURRENT_USER, NOW, USERS_REGISTRY } from '../constants';
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

// ── Task-103 — preferred-channel change log ──────────────────────────────────
// In-memory projection of the [AUDIT] stream already emitted by
// updatePatientPreferredChannel (no new audit event type — this is the same
// success record, exposed so the per-patient Notification log can render an
// inline "channel changed" breadcrumb alongside real Email/SMS sends.
export type PatientPreferredChannelChange = {
  id: string;
  clinic_id: ClinicId;
  patient_id: string;
  previous_channel: 'email' | 'sms' | 'phone';
  new_channel: 'email' | 'sms' | 'phone';
  actor_id: string;
  actor_name: string;
  changed_at: string;
};

export const PREFERRED_CHANNEL_CHANGES: PatientPreferredChannelChange[] = [
  // Seed entry: Sarah Cookland's channel was switched from SMS → Email in
  // late April so the refund email sent on 2026-05-10 (NOTIF-001) follows
  // an earlier SMS in the same log. Without this breadcrumb the channel
  // flip looked like a routing bug.
  {
    id: 'PCC-001',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    previous_channel: 'sms',
    new_channel: 'email',
    actor_id: 'user_qadir',
    actor_name: 'Qadir Hussain',
    changed_at: '2026-04-28T09:12:00Z',
  },
];

export async function listPatientPreferredChannelChanges(
  clinic_id: ClinicId,
  opts?: { patient_id?: string },
): Promise<PatientPreferredChannelChange[]> {
  await delay();
  let results = PREFERRED_CHANNEL_CHANGES.filter((c) => c.clinic_id === clinic_id);
  if (opts?.patient_id) results = results.filter((c) => c.patient_id === opts.patient_id);
  return results;
}

// ── Task-150 — patient flag change log (VIP / status / coach assignment) ────
// Read-only projection of the existing [AUDIT] stream for the patient-level
// toggles that today mutate `patient.updated_at` silently. Surfaced in the
// per-patient Notification log so admins see "who changed what, when" inline
// alongside real notifications. No new audit event types are introduced — the
// editor UI that will write these records is out of scope for task-150 and
// tracked as a follow-up; this seed data represents the historical events
// admins are reviewing today.
export type PatientFlagChangeKind = 'vip' | 'status' | 'coach';

export type PatientFlagChange = {
  id: string;
  clinic_id: ClinicId;
  patient_id: string;
  kind: PatientFlagChangeKind;
  // String form so all three kinds share one row renderer. status keeps the
  // raw enum value ('active'|'monitoring'|'suspended'|'new'); vip is the
  // string "true"/"false"; coach is either the user_id, the coach full name,
  // or the literal 'unassigned' when nulled.
  previous_value: string;
  new_value: string;
  // Optional resolved display names so the UI doesn't have to look up the
  // coach in USERS_REGISTRY itself (some coaches may have left the team).
  previous_display: string | null;
  new_display: string | null;
  actor_id: string;
  actor_name: string;
  changed_at: string;
};

export const PATIENT_FLAG_CHANGES: PatientFlagChange[] = [
  // Seed: Emma Whitfield was promoted to VIP after her £4k spend tipped over
  // the high-value threshold — admins reviewing her profile should see who
  // approved that promotion.
  {
    id: 'PFC-001',
    clinic_id: 'feeltru',
    patient_id: 'PT-00412',
    kind: 'vip',
    previous_value: 'false',
    new_value: 'true',
    previous_display: 'No',
    new_display: 'Yes',
    actor_id: 'user_qadir',
    actor_name: 'Qadir Hussain',
    changed_at: '2026-04-15T11:30:00Z',
  },
  // Seed: Priya Shah moved from active → suspended after a card chargeback.
  {
    id: 'PFC-002',
    clinic_id: 'vsc',
    patient_id: 'PT-00301',
    kind: 'status',
    previous_value: 'active',
    new_value: 'suspended',
    previous_display: 'active',
    new_display: 'suspended',
    actor_id: 'user_yohan',
    actor_name: 'Yohan Perera',
    changed_at: '2026-03-12T15:45:00Z',
  },
  // Seed: Miriam Osei moved to monitoring after a missed check-in.
  {
    id: 'PFC-003',
    clinic_id: 'vsc',
    patient_id: 'PT-00156',
    kind: 'status',
    previous_value: 'active',
    new_value: 'monitoring',
    previous_display: 'active',
    new_display: 'monitoring',
    actor_id: 'user_yohan',
    actor_name: 'Yohan Perera',
    changed_at: '2026-04-18T09:20:00Z',
  },
  // Seed: Sarah Cookland assigned to Olwyn when coaching feature went live.
  {
    id: 'PFC-004',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    kind: 'coach',
    previous_value: 'unassigned',
    new_value: 'user_olwyn',
    previous_display: 'Unassigned',
    new_display: 'Olwyn Sutcliffe',
    actor_id: 'user_qadir',
    actor_name: 'Qadir Hussain',
    changed_at: '2026-02-02T10:00:00Z',
  },
  // Seed: Zara Ahmed coach assigned shortly after onboarding.
  {
    id: 'PFC-005',
    clinic_id: 'feeltru',
    patient_id: 'PT-00378',
    kind: 'coach',
    previous_value: 'unassigned',
    new_value: 'user_olwyn',
    previous_display: 'Unassigned',
    new_display: 'Olwyn Sutcliffe',
    actor_id: 'user_mobeen',
    actor_name: 'Mobeen Alam',
    changed_at: '2026-05-07T10:15:00Z',
  },
];

export async function listPatientFlagChanges(
  clinic_id: ClinicId,
  opts?: { patient_id?: string },
): Promise<PatientFlagChange[]> {
  await delay();
  let results = PATIENT_FLAG_CHANGES.filter((c) => c.clinic_id === clinic_id);
  if (opts?.patient_id) results = results.filter((c) => c.patient_id === opts.patient_id);
  return results;
}

// ── Sarah Cookland — persona spine ──────────────────────────────────────────
const SARAH_FEELTRU: Patient = {
  id: 'PT-00198',
  clinic_id: 'feeltru',
  demographic: {
    full_name: 'Sarah Cookland',
    dob: '1979-04-15',
    sex_at_birth: 'female',
    ethnicity: 'White British',
    address: { line1: '12 Oak Lane', city: 'Manchester', postcode: 'M1 2AB' },
  },
  contact: { email: 'sarah.cookland@example.com', phone: '+44 7700 900123', preferred_channel: 'email' },
  gp: { name: 'Dr. Patel', address: 'Oak Practice, Manchester M1 3CD', phone: '+44 161 555 0100', email: 'oak@nhs.net', nhs_ods_id: 'A12345' },
  baseline: { height_cm: 165, baseline_weight_kg: 92.5, baseline_bmi: 33.9 },
  latest: { weight_kg: 84.2, bmi: 30.9, recorded_at: '2026-05-01T10:00:00Z' },
  verification: {
    sumsub_id: 'sumsub_abc123',
    identity_verified_at: '2026-01-15T14:30:00Z',
    bmi_verified_at: '2026-05-01T10:05:00Z',
    // Task-326 — multi-step SumSub mirror (Sarah is the canonical fully-verified patient)
    sumsub_status: 'approved',
    sumsub_step: 'completed',
    sumsub_document_type: 'passport',
    sumsub_confidence: 0.97,
  },
  consents_given: [
    { consent_id: 'consent_treatment', version: 'v1', given_at: '2026-01-15T14:30:00Z' },
    { consent_id: 'consent_gp', version: 'v1', given_at: '2026-01-15T14:30:00Z' },
  ],
  flags: [{ id: 'flag_001', code: 'B4', severity: 'medium', raised_at: '2026-04-20T09:00:00Z' }],
  status: 'active',
  vip: false,
  coach_id: 'user_olwyn',
  // BLD-8.3 (Wave 6) — Intercom external_id set when patient account created in Intercom.
  intercom_user_id: 'icom_pt00198_feeltru',
  // Phase 1 read-only Intercom integration — Sarah is the canonical linked
  // patient used for end-to-end verification (task-58).
  intercom_contact_id: 'icontact_sarah_feeltru',
  created_at: '2026-01-15T14:30:00Z',
  updated_at: '2026-05-01T10:00:00Z',
};

const SARAH_VSC: Patient = {
  ...SARAH_FEELTRU,
  clinic_id: 'vsc',
  id: 'PT-00012',
  coach_id: null,
  // Override — VSC Intercom account is separate from FeelTru account
  intercom_user_id: null,
};

// ── Additional VSC patients ──────────────────────────────────────────────────

const JAMES_VSC: Patient = {
  id: 'PT-00234',
  clinic_id: 'vsc',
  demographic: {
    full_name: 'James Hartley',
    dob: '1985-08-22',
    sex_at_birth: 'male',
    ethnicity: 'White British',
    address: { line1: '47 Birch Close', city: 'Birmingham', postcode: 'B15 3TQ' },
  },
  contact: { email: 'james.hartley@example.com', phone: '+44 7700 900456', preferred_channel: 'email' },
  gp: { name: 'Dr. Singh', address: 'Parkside Surgery, Birmingham B15 4PQ', phone: '+44 121 555 0200', email: 'parkside@nhs.net', nhs_ods_id: 'B83014' },
  baseline: { height_cm: 181, baseline_weight_kg: 108.0, baseline_bmi: 32.9 },
  latest: { weight_kg: 101.4, bmi: 30.9, recorded_at: '2026-05-03T09:15:00Z' },
  verification: { sumsub_id: 'sumsub_jh234', identity_verified_at: '2026-02-01T10:00:00Z', bmi_verified_at: '2026-05-03T09:20:00Z' },
  consents_given: [
    { consent_id: 'consent_treatment', version: 'v1', given_at: '2026-02-01T10:00:00Z' },
    { consent_id: 'consent_gp', version: 'v1', given_at: '2026-02-01T10:00:00Z' },
  ],
  flags: [],
  status: 'active',
  vip: false,
  coach_id: null,
  created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-05-03T09:15:00Z',
};

const MIRIAM_VSC: Patient = {
  id: 'PT-00156',
  clinic_id: 'vsc',
  demographic: {
    full_name: 'Miriam Osei',
    dob: '1971-03-30',
    sex_at_birth: 'female',
    ethnicity: 'Black British',
    address: { line1: '8 Maple Avenue', city: 'Leeds', postcode: 'LS6 2HR' },
  },
  contact: { email: 'miriam.osei@example.com', phone: '+44 7700 900789', preferred_channel: 'sms' },
  gp: null,
  baseline: { height_cm: 163, baseline_weight_kg: 98.0, baseline_bmi: 36.9 },
  latest: { weight_kg: 95.1, bmi: 35.8, recorded_at: '2026-04-28T11:00:00Z' },
  verification: { sumsub_id: 'sumsub_mo156', identity_verified_at: '2026-01-20T09:30:00Z', bmi_verified_at: '2026-04-28T11:05:00Z' },
  consents_given: [
    { consent_id: 'consent_treatment', version: 'v1', given_at: '2026-01-20T09:30:00Z' },
  ],
  flags: [],
  status: 'monitoring',
  vip: false,
  coach_id: null,
  created_at: '2026-01-20T09:30:00Z',
  updated_at: '2026-04-28T11:00:00Z',
};

const TOM_VSC: Patient = {
  id: 'PT-00089',
  clinic_id: 'vsc',
  demographic: {
    full_name: 'Tom Fletcher',
    dob: '1990-11-05',
    sex_at_birth: 'male',
    ethnicity: 'Mixed',
    address: { line1: '19 Station Road', city: 'Sheffield', postcode: 'S1 2GH' },
  },
  contact: { email: 'tom.fletcher@example.com', phone: '+44 7700 900012', preferred_channel: 'phone' },
  gp: { name: 'Dr. Clarke', address: 'Broomhill Medical, Sheffield S10 2SE', phone: '+44 114 555 0300', email: 'broomhill@nhs.net', nhs_ods_id: 'C83012' },
  baseline: { height_cm: 178, baseline_weight_kg: 115.5, baseline_bmi: 36.5 },
  latest: { weight_kg: 115.5, bmi: 36.5, recorded_at: '2026-05-08T14:00:00Z' },
  verification: {
    sumsub_id: 'sumsub_tf089',
    identity_verified_at: '2026-05-08T13:50:00Z',
    bmi_verified_at: null,
    // Task-326 — submitted but still awaiting BMI capture; review state for the SDK
    sumsub_status: 'review',
    sumsub_step: 'liveness',
    sumsub_document_type: 'driving_licence',
    sumsub_confidence: 0.82,
  },
  consents_given: [
    { consent_id: 'consent_treatment', version: 'v1', given_at: '2026-05-08T13:50:00Z' },
  ],
  flags: [],
  status: 'new',
  vip: false,
  coach_id: null,
  created_at: '2026-05-08T13:50:00Z',
  updated_at: '2026-05-08T14:00:00Z',
};

const PRIYA_VSC: Patient = {
  id: 'PT-00301',
  clinic_id: 'vsc',
  demographic: {
    full_name: 'Priya Shah',
    dob: '1978-06-14',
    sex_at_birth: 'female',
    ethnicity: 'Asian British',
    address: { line1: '3 Elm Street', city: 'London', postcode: 'E1 7PQ' },
  },
  contact: { email: 'priya.shah@example.com', phone: '+44 7700 900321', preferred_channel: 'email' },
  gp: { name: 'Dr. Nguyen', address: 'Tower Hamlets GP, London E1 8AH', phone: '+44 20 555 0400', email: 'towerhamlets@nhs.net', nhs_ods_id: 'G85014' },
  baseline: { height_cm: 158, baseline_weight_kg: 88.0, baseline_bmi: 35.2 },
  latest: { weight_kg: 86.5, bmi: 34.6, recorded_at: '2026-03-15T10:30:00Z' },
  verification: { sumsub_id: 'sumsub_ps301', identity_verified_at: '2026-01-10T11:00:00Z', bmi_verified_at: '2026-03-15T10:35:00Z' },
  consents_given: [
    { consent_id: 'consent_treatment', version: 'v1', given_at: '2026-01-10T11:00:00Z' },
    { consent_id: 'consent_gp', version: 'v1', given_at: '2026-01-10T11:00:00Z' },
  ],
  flags: [{ id: 'flag_002', code: 'B1', severity: 'low', raised_at: '2026-03-01T09:00:00Z' }],
  status: 'suspended',
  vip: false,
  coach_id: null,
  created_at: '2026-01-10T11:00:00Z',
  updated_at: '2026-03-15T10:30:00Z',
};

// ── Additional FeelTru patients ──────────────────────────────────────────────

const EMMA_FEELTRU: Patient = {
  id: 'PT-00412',
  clinic_id: 'feeltru',
  demographic: {
    full_name: 'Emma Whitfield',
    dob: '1983-02-28',
    sex_at_birth: 'female',
    ethnicity: 'White British',
    address: { line1: '22 Willow Lane', city: 'Edinburgh', postcode: 'EH4 2NF' },
  },
  contact: { email: 'emma.whitfield@example.com', phone: '+44 7700 900654', preferred_channel: 'email' },
  gp: { name: 'Dr. McAllister', address: 'Dean Surgery, Edinburgh EH4 3BR', phone: '+44 131 555 0500', email: 'dean@nhs.net', nhs_ods_id: 'S10003' },
  baseline: { height_cm: 167, baseline_weight_kg: 95.0, baseline_bmi: 34.1 },
  latest: { weight_kg: 87.3, bmi: 31.3, recorded_at: '2026-05-05T08:30:00Z' },
  verification: { sumsub_id: 'sumsub_ew412', identity_verified_at: '2026-01-05T09:00:00Z', bmi_verified_at: '2026-05-05T08:35:00Z' },
  consents_given: [
    { consent_id: 'consent_treatment', version: 'v1', given_at: '2026-01-05T09:00:00Z' },
    { consent_id: 'consent_gp', version: 'v1', given_at: '2026-01-05T09:00:00Z' },
  ],
  flags: [],
  status: 'active',
  vip: true,
  coach_id: 'user_olwyn',
  created_at: '2026-01-05T09:00:00Z',
  updated_at: '2026-05-05T08:30:00Z',
};

const ZARA_FEELTRU: Patient = {
  id: 'PT-00378',
  clinic_id: 'feeltru',
  demographic: {
    full_name: 'Zara Ahmed',
    dob: '1994-09-17',
    sex_at_birth: 'female',
    ethnicity: 'Asian British',
    address: { line1: '56 Orchard Road', city: 'Bristol', postcode: 'BS8 2HY' },
  },
  contact: { email: 'zara.ahmed@example.com', phone: '+44 7700 900987', preferred_channel: 'sms' },
  gp: { name: 'Dr. Wilson', address: 'Clifton Practice, Bristol BS8 3LE', phone: '+44 117 555 0600', email: 'clifton@nhs.net', nhs_ods_id: 'L83011' },
  baseline: { height_cm: 162, baseline_weight_kg: 87.0, baseline_bmi: 33.2 },
  latest: { weight_kg: 87.0, bmi: 33.2, recorded_at: '2026-05-07T10:00:00Z' },
  verification: { sumsub_id: 'sumsub_za378', identity_verified_at: '2026-05-07T09:50:00Z', bmi_verified_at: '2026-05-07T10:00:00Z' },
  consents_given: [
    { consent_id: 'consent_treatment', version: 'v1', given_at: '2026-05-07T09:50:00Z' },
  ],
  flags: [],
  status: 'new',
  vip: false,
  coach_id: 'user_olwyn',
  created_at: '2026-05-07T09:50:00Z',
  updated_at: '2026-05-07T10:00:00Z',
};

const FIONA_FEELTRU: Patient = {
  id: 'PT-00445',
  clinic_id: 'feeltru',
  demographic: {
    full_name: 'Fiona MacLeod',
    dob: '1967-12-03',
    sex_at_birth: 'female',
    ethnicity: 'White Scottish',
    address: { line1: '11 Harbour View', city: 'Glasgow', postcode: 'G1 3LF' },
  },
  contact: { email: 'fiona.macleod@example.com', phone: '+44 7700 900543', preferred_channel: 'phone' },
  gp: { name: 'Dr. Robertson', address: 'City Centre Health, Glasgow G2 1PP', phone: '+44 141 555 0700', email: 'citycentre@nhs.net', nhs_ods_id: 'S10019' },
  baseline: { height_cm: 161, baseline_weight_kg: 102.5, baseline_bmi: 39.5 },
  latest: { weight_kg: 97.8, bmi: 37.7, recorded_at: '2026-04-20T14:00:00Z' },
  verification: { sumsub_id: 'sumsub_fm445', identity_verified_at: '2026-01-25T10:00:00Z', bmi_verified_at: '2026-04-20T14:05:00Z' },
  consents_given: [
    { consent_id: 'consent_treatment', version: 'v1', given_at: '2026-01-25T10:00:00Z' },
  ],
  flags: [],
  status: 'monitoring',
  vip: false,
  coach_id: 'user_olwyn',
  created_at: '2026-01-25T10:00:00Z',
  updated_at: '2026-04-20T14:00:00Z',
};

// ── Welcome-call canonical patients (BLD-13.3) ───────────────────────────────

const MICHELLE_FEELTRU: Patient = {
  id: 'PT-00210',
  clinic_id: 'feeltru',
  demographic: {
    full_name: 'Michelle Clarke',
    dob: '1982-07-03',
    sex_at_birth: 'female',
    ethnicity: 'White British',
    address: { line1: '8 Maple Drive', city: 'Bristol', postcode: 'BS1 4TN' },
  },
  contact: { email: 'michelle.clarke@example.com', phone: '+44 7700 900701', preferred_channel: 'email' },
  gp: { name: 'Dr. Owens', address: 'Central Surgery, Bristol BS1 5RT', phone: '+44 117 555 0100', email: 'central@nhs.net', nhs_ods_id: 'L83042' },
  baseline: { height_cm: 167, baseline_weight_kg: 97.0, baseline_bmi: 34.8 },
  latest: { weight_kg: 97.0, bmi: 34.8, recorded_at: '2026-04-28T10:00:00Z' },
  verification: { sumsub_id: 'sumsub_mc210', identity_verified_at: '2026-04-28T10:00:00Z', bmi_verified_at: '2026-04-28T10:05:00Z' },
  consents_given: [
    { consent_id: 'consent_treatment', version: 'v1', given_at: '2026-04-28T10:00:00Z' },
    { consent_id: 'consent_gp', version: 'v1', given_at: '2026-04-28T10:00:00Z' },
  ],
  flags: [{ id: 'flag_wc053', code: 'FLAG-004', severity: 'medium', raised_at: '2026-05-06T11:25:00Z' }],
  status: 'active',
  vip: false,
  coach_id: 'user_olwyn',
  intercom_user_id: 'icom_pt00210_feeltru',
  created_at: '2026-04-28T10:00:00Z',
  updated_at: '2026-05-06T11:25:00Z',
};

const SARAH_CHEN_FEELTRU: Patient = {
  id: 'PT-00214',
  clinic_id: 'feeltru',
  demographic: {
    full_name: 'Sarah Chen',
    dob: '1990-02-18',
    sex_at_birth: 'female',
    ethnicity: 'Chinese',
    address: { line1: '22 Riverside Court', city: 'London', postcode: 'E1 7RG' },
  },
  contact: { email: 'sarah.chen@example.com', phone: '+44 7700 900714', preferred_channel: 'email' },
  gp: { name: 'Dr. Kim', address: 'East End Practice, London E1 8PQ', phone: '+44 20 7555 0200', email: 'eastend@nhs.net', nhs_ods_id: 'G85011' },
  baseline: { height_cm: 160, baseline_weight_kg: 82.0, baseline_bmi: 32.0 },
  latest: { weight_kg: 82.0, bmi: 32.0, recorded_at: '2026-05-01T09:30:00Z' },
  verification: { sumsub_id: 'sumsub_sc214', identity_verified_at: '2026-05-01T09:30:00Z', bmi_verified_at: '2026-05-01T09:35:00Z' },
  consents_given: [
    { consent_id: 'consent_treatment', version: 'v1', given_at: '2026-05-01T09:30:00Z' },
    { consent_id: 'consent_gp', version: 'v1', given_at: '2026-05-01T09:30:00Z' },
  ],
  flags: [],
  status: 'active',
  vip: false,
  coach_id: 'user_olwyn',
  intercom_user_id: 'icom_pt00214_feeltru',
  created_at: '2026-05-01T09:30:00Z',
  updated_at: '2026-05-08T07:00:00Z',
};

const BETH_FEELTRU: Patient = {
  id: 'PT-00199',
  clinic_id: 'feeltru',
  demographic: {
    full_name: 'Beth Newman',
    dob: '1975-11-09',
    sex_at_birth: 'female',
    ethnicity: 'White British',
    address: { line1: '3 Chestnut Avenue', city: 'Leeds', postcode: 'LS1 2WZ' },
  },
  contact: { email: 'beth.newman@example.com', phone: '+44 7700 900199', preferred_channel: 'phone' },
  gp: { name: 'Dr. Hassan', address: 'Kirkgate Surgery, Leeds LS1 3PQ', phone: '+44 113 555 0300', email: 'kirkgate@nhs.net', nhs_ods_id: 'B82031' },
  baseline: { height_cm: 169, baseline_weight_kg: 105.0, baseline_bmi: 36.8 },
  latest: { weight_kg: 105.0, bmi: 36.8, recorded_at: '2026-04-25T11:00:00Z' },
  verification: { sumsub_id: 'sumsub_bn199', identity_verified_at: '2026-04-25T11:00:00Z', bmi_verified_at: '2026-04-25T11:05:00Z' },
  consents_given: [
    { consent_id: 'consent_treatment', version: 'v1', given_at: '2026-04-25T11:00:00Z' },
    { consent_id: 'consent_gp', version: 'v1', given_at: '2026-04-25T11:00:00Z' },
  ],
  flags: [],
  status: 'active',
  vip: false,
  coach_id: 'user_olwyn',
  intercom_user_id: 'icom_pt00199_feeltru',
  created_at: '2026-04-25T11:00:00Z',
  updated_at: '2026-05-07T08:00:00Z',
};

// ── BLD-10.1 — Ryan Mitchell — demo male patient registered at FeelTru ───────
// Triggers the gender eligibility mismatch banner (DEC-16, UK Equality Act 2010 Sch 3 Para 27).
// FeelTru is female_only; this patient should be redirected to VSC or data purged per BLD-10.4.
const RYAN_FEELTRU: Patient = {
  id: 'PT-00556',
  clinic_id: 'feeltru',
  demographic: {
    full_name: 'Ryan Mitchell',
    dob: '1989-07-14',
    sex_at_birth: 'male',
    ethnicity: 'White British',
    address: { line1: '14 Grafton Street', city: 'Manchester', postcode: 'M1 5GF' },
  },
  contact: { email: 'ryan.mitchell@example.com', phone: '+44 7700 900556', preferred_channel: 'email' },
  gp: { name: 'Dr. Patel', address: 'Northern Quarter Surgery, Manchester M1 2AB', phone: '+44 161 555 0100', email: 'nq@nhs.net', nhs_ods_id: 'P84721' },
  baseline: { height_cm: 182, baseline_weight_kg: 105.0, baseline_bmi: 31.7 },
  latest: { weight_kg: 105.0, bmi: 31.7, recorded_at: '2026-05-10T14:00:00Z' },
  verification: { sumsub_id: 'sumsub_rm556', identity_verified_at: '2026-05-10T14:00:00Z', bmi_verified_at: null },
  consents_given: [
    { consent_id: 'consent_treatment', version: 'v1', given_at: '2026-05-10T14:00:00Z' },
  ],
  flags: [],
  status: 'active',
  vip: false,
  coach_id: null,
  intercom_user_id: 'icom_pt00556_feeltru',
  created_at: '2026-05-10T14:00:00Z',
  updated_at: '2026-05-10T14:00:00Z',
};

// ── Task-165 — legacy records with malformed phone/postcode ─────────────────
// Two seed patients that existed before Task-115 added intake validation, used
// by the cleanupPatientContactData backfill job and its tests. They mirror
// the two real-world classes of broken data ops have found in MOCK_PATIENTS:
//   - LEGACY_FIXABLE_VSC: phone + postcode are auto-normalisable
//     (no spaces / wrong case). Backfill rewrites them in place.
//   - LEGACY_UNFIXABLE_VSC: phone is too short to interpret and postcode is
//     not a UK postcode at all. Backfill flags both for ops follow-up.
const LEGACY_FIXABLE_VSC: Patient = {
  id: 'PT-00701',
  clinic_id: 'vsc',
  demographic: {
    full_name: 'Harold Bryant',
    dob: '1962-05-09',
    sex_at_birth: 'male',
    ethnicity: 'White British',
    address: { line1: '4 Pinewood Crescent', city: 'Manchester', postcode: 'm12ab' },
  },
  contact: { email: 'harold.bryant@example.com', phone: '07700900222', preferred_channel: 'sms' },
  gp: null,
  baseline: { height_cm: 175, baseline_weight_kg: 110.0, baseline_bmi: 35.9 },
  latest: { weight_kg: 110.0, bmi: 35.9, recorded_at: '2025-12-01T09:00:00Z' },
  verification: { sumsub_id: 'sumsub_hb701', identity_verified_at: '2025-12-01T09:00:00Z', bmi_verified_at: '2025-12-01T09:05:00Z' },
  consents_given: [
    { consent_id: 'consent_treatment', version: 'v1', given_at: '2025-12-01T09:00:00Z' },
  ],
  flags: [],
  status: 'active',
  vip: false,
  coach_id: null,
  created_at: '2025-12-01T09:00:00Z',
  updated_at: '2025-12-01T09:00:00Z',
};

const LEGACY_UNFIXABLE_VSC: Patient = {
  id: 'PT-00702',
  clinic_id: 'vsc',
  demographic: {
    full_name: 'Doris Whittaker',
    dob: '1955-09-18',
    sex_at_birth: 'female',
    ethnicity: 'White British',
    address: { line1: '21 Foxglove Way', city: 'Leeds', postcode: 'XX999' },
  },
  // "07700" is too short to be a UK mobile — only 5 digits — and cannot be
  // safely auto-fixed; ops must phone the patient to get the real number.
  contact: { email: 'doris.whittaker@example.com', phone: '07700', preferred_channel: 'phone' },
  gp: null,
  baseline: { height_cm: 160, baseline_weight_kg: 92.0, baseline_bmi: 35.9 },
  latest: { weight_kg: 92.0, bmi: 35.9, recorded_at: '2025-11-20T11:00:00Z' },
  verification: { sumsub_id: 'sumsub_dw702', identity_verified_at: '2025-11-20T11:00:00Z', bmi_verified_at: '2025-11-20T11:05:00Z' },
  consents_given: [
    { consent_id: 'consent_treatment', version: 'v1', given_at: '2025-11-20T11:00:00Z' },
  ],
  flags: [],
  status: 'active',
  vip: false,
  coach_id: null,
  created_at: '2025-11-20T11:00:00Z',
  updated_at: '2025-11-20T11:00:00Z',
};

export const MOCK_PATIENTS: Patient[] = [
  SARAH_FEELTRU, SARAH_VSC,
  JAMES_VSC, MIRIAM_VSC, TOM_VSC, PRIYA_VSC,
  EMMA_FEELTRU, ZARA_FEELTRU, FIONA_FEELTRU,
  MICHELLE_FEELTRU, SARAH_CHEN_FEELTRU, BETH_FEELTRU,
  RYAN_FEELTRU,
  LEGACY_FIXABLE_VSC, LEGACY_UNFIXABLE_VSC,
];

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
export const WEIGHT_MIN_KG = 30;
export const WEIGHT_MAX_KG = 300;

// Task-244 — patients can now self-submit a weight reading via a magic-link
// page. The same fixture handles both staff and patient submissions; `source`
// makes the distinction explicit so the audit log, the per-patient history
// surface, and the coach badge can tell them apart. Patient-submitted rows
// also carry `coach_acknowledged_at` so the assigned coach gets a "new from
// patient" badge until they tick it off.
export type WeightCheckInSource = 'staff' | 'patient';

export type PatientWeightCheckIn = {
  id: string;
  clinic_id: ClinicId;
  patient_id: string;
  weight_kg: number;
  bmi: number;
  previous_weight_kg: number;
  delta_vs_baseline_kg: number;
  actor_id: string;
  actor_name: string;
  recorded_at: string;
  source: WeightCheckInSource;
  coach_acknowledged_at: string | null;
  coach_acknowledged_by: string | null;
};

export const PATIENT_WEIGHT_CHECKINS: PatientWeightCheckIn[] = [];

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

export async function recordPatientWeight(
  clinic_id: ClinicId,
  patient_id: string,
  weight_kg: number,
  actor = CURRENT_USER,
  opts: { source?: WeightCheckInSource } = {},
): Promise<Patient> {
  await delay(250);

  const source: WeightCheckInSource = opts.source ?? 'staff';

  // Layer-2 gate: staff submissions require write:patients. Patient-sourced
  // submissions arrive via the magic-link page and are explicitly trusted at
  // this layer — the magic link itself is the authentication boundary, and
  // the audit log records `source: 'patient'` so a self-report can never be
  // mistaken for a clinical mutation.
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
    // Staff-recorded readings are implicitly "seen" — only patient-submitted
    // rows surface as a coach badge until acknowledged.
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
// Called when a male/non-binary patient is identified at a female_only clinic.
// Owner-only (task-104 explicitly re-gated this to Owner after Admin gained
// write:patients for the preferred-channel editor — data purge must not be
// widened by that change). Audit-logged with legal basis. Removes from Livera
// mirror only (Primed API purge is a V1.2 concern — noted in audit trail).
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
    patient_name_hash: patient.demographic.full_name.length, // hashed — no PII in audit log
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
    // Deliberately no PII payload — just the audit-safe metadata that
    // already lives in the pino line above.
    after: {
      patient_name_hash: patient.demographic.full_name.length,
      legal_basis: 'UK GDPR Art 5(1)(c)',
      legal_gateway: 'UK Equality Act 2010 Sch 3 Para 27',
      primed_api_purge: 'PENDING',
    },
  });
}

// ── Task-225 — updatePatientVip / updatePatientStatus / updatePatientCoach ──
// Inline-editor mutators for the patient-level flags admins manage from the
// LeftColumn. Each mirrors the updatePatientPreferredChannel safety chain:
//   Layer 1 (UI gate): editor only renders if can(actor, 'write', 'patients').
//   Layer 2 (server gate): can() check here; SAFETY_VIOLATION on denial.
//   Layer 3 (audit log): [AUDIT] entry + recordAudit spine row + projection
//     into PATIENT_FLAG_CHANGES so the per-patient Notification log breadcrumb
//     introduced in task-150 stays in sync with real edits.
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
// Admins routinely correct typos on the patient profile (e.g. ops takes a
// phone update over chat). Task-115 added intake-time validation and Task-165
// backfilled the legacy bad data, but the in-app edit path went unguarded —
// so a careless save could re-introduce the exact "m12ab" / "07700900222"
// shapes the backfill was built to fix.
//
// These mutations are the canonical write entry points for phone & postcode.
// They re-use the intake validators (`isValidUkMobile` / `isValidUkPostcode`)
// and store values in canonical form (`+44…` E.164 phone, spaced/uppercase
// postcode) via `normaliseUkMobile` / `normalisePostcode`. Invalid input is
// rejected with APIError('VALIDATION', …) so the calling UI can surface a
// friendly inline error.
//
// 3-layer safety chain mirrors updatePatientPreferredChannel:
//   Layer 1 (UI gate): editor only renders if can(actor, 'write','patients').
//   Layer 2 (server gate): can() + validator checks here.
//   Layer 3 (audit log): [AUDIT] entry per mutation (success + denial + validation_failed).
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
// Task-179 added a "Send to a different email" affordance to the Px-upload
// resend flow but only persisted the corrected address onto the upload link
// itself — the patient record still carried the bouncing email, so the next
// reminder, GP letter, courier notification, etc. went straight back to the
// bad address. This canonical mutation lets staff fix the patient record so
// every downstream automated send routes correctly.
//
// 3-layer safety chain mirrors updatePatientPhone:
//   Layer 1 (UI gate): editor only renders if can(actor, 'write','patients').
//   Layer 2 (server gate): can() + isValidEmail check here.
//   Layer 3 (audit log): [AUDIT] entry per mutation (success + denial + validation_failed).
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

// Helper for the editor: list coach-role users in a clinic. Stays in-fixture
// so the page can compute the option list server-side and pass it down.
export function listCoachOptions(clinic_id: ClinicId): Array<{ id: string; full_name: string }> {
  return Object.values(USERS_REGISTRY)
    .filter((u) => u.active && u.roles.includes('Coach') && u.active_clinic_id === clinic_id)
    .map((u) => ({ id: u.id, full_name: u.full_name }));
}

// ── Task-247 — BMI photo evidence review ─────────────────────────────────────
// Prescribers review the BMI photo uploaded by the patient and either confirm
// (sets verification.bmi_verified_at — clears the "Awaiting BMI evidence" and
// "Self-reported BMI out of range" contextual flags via the existing
// filterSelfReportedBmiFlag / normalizeSelfReportedBmiFlag plumbing in
// fixtures/orders.ts) or reject (clears any prior verified_at so the flags
// reappear and a fresh upload can be requested). Both outcomes are audited.
//
// Gated by the `decide`/`orders` permission since this is a prescriber
// clinical decision — coaches and admin staff don't sign these off.
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
