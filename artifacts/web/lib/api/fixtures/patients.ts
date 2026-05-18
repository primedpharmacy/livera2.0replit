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
  verification: { sumsub_id: 'sumsub_abc123', identity_verified_at: '2026-01-15T14:30:00Z', bmi_verified_at: '2026-05-01T10:05:00Z' },
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
  verification: { sumsub_id: 'sumsub_tf089', identity_verified_at: '2026-05-08T13:50:00Z', bmi_verified_at: null },
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

export const MOCK_PATIENTS: Patient[] = [
  SARAH_FEELTRU, SARAH_VSC,
  JAMES_VSC, MIRIAM_VSC, TOM_VSC, PRIYA_VSC,
  EMMA_FEELTRU, ZARA_FEELTRU, FIONA_FEELTRU,
  MICHELLE_FEELTRU, SARAH_CHEN_FEELTRU, BETH_FEELTRU,
  RYAN_FEELTRU,
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
}
