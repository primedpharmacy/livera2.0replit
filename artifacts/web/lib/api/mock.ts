/**
 * Livera Mock API — frontend development against this until backend ready.
 *
 * Pattern: every component imports from this file, never from fetch directly.
 * When Yohan's backend is ready, swap implementations to call real endpoints.
 * The TypeScript types here ARE the API contract.
 *
 * All endpoints follow these conventions:
 * - REST + OpenAPI shape; URLs match `/api/v1/{resource}` style
 * - Workspace isolation enforced — every list filters by clinic_id
 * - Latency simulated with 200-400ms delay so UI handles loading states correctly
 * - Errors thrown as { code, message } objects — frontend catches and displays
 *
 * Persona spine: Sarah Cookland (PT-00198 on FeelTru, PT-00198 on VSC for testing)
 */

// ============================================================================
// CORE ENTITY TYPES (the API contract)
// ============================================================================

export type ClinicId = 'vsc' | 'feeltru';
export type Role = 'Owner' | 'RM' | 'Prescriber' | 'Coach' | 'Admin';

export type Clinic = {
  id: ClinicId;
  legal_entity_name: string;
  trading_name: string;
  cqc_registration: string | null;
  gphc_pharmacy_id: string | null;
  brand_tokens: { logo_url: string; primary_color: string; secondary_color: string };
  timezone: string;
  currency: 'GBP';
  features: { coaching_enabled: boolean; ai_clinical_note_drafting_enabled: boolean };
  config: ClinicConfig;
};

export type ClinicConfig = {
  sla: { approval_warn_hours: number; approval_breach_hours: number; patient_sla_copy: string };
  day_X_nudge: { enabled: boolean; trigger_day: number; calendly_link: string; copy: string };
  consents: Array<{ id: string; title: string; body: string; mandatory: boolean; version: string }>;
  consultation_types: Array<{
    id: string;
    name: string;
    modality: 'phone' | 'video' | 'chat';
    provider: string;
    default_duration_min: number;
    eligible_roles: Role[];
    dpia_reference: string | null;
    calendly_event_type_id: string | null;
  }>;
  monday_board_ids: { incidents: string; complaints: string };
  intercom_workspace_id: string;
};

export type User = {
  id: string;
  email: string;
  full_name: string;
  roles: Role[];
  active_clinic_id: ClinicId;
  professional_registrations: Array<{ body: string; reg_number: string; expiry: string; status: string }>;
  active: boolean;
};

export type Patient = {
  id: string; // PT-XXXXX
  clinic_id: ClinicId;
  demographic: {
    full_name: string;
    dob: string;
    sex_at_birth: 'female' | 'male' | 'other';
    ethnicity: string;
    address: { line1: string; line2?: string; city: string; postcode: string };
  };
  contact: { email: string; phone: string; preferred_channel: 'email' | 'sms' | 'phone' };
  gp: { name: string; address: string; phone: string; email: string; nhs_ods_id: string } | null;
  baseline: { height_cm: number; baseline_weight_kg: number; baseline_bmi: number };
  latest: { weight_kg: number; bmi: number; recorded_at: string };
  verification: { sumsub_id: string; identity_verified_at: string | null; bmi_verified_at: string | null };
  consents_given: Array<{ consent_id: string; version: string; given_at: string }>;
  flags: Array<{ id: string; code: string; severity: 'low' | 'medium' | 'high'; raised_at: string }>;
  status: 'new' | 'active' | 'monitoring' | 'suspended';
  vip: boolean;
  created_at: string;
  updated_at: string;
};

export type OrderStatus =
  | 'received'
  | 'clinical_check'
  | 'approved'
  | 'dispatched'
  | 'delivered'
  | 'on_hold'
  | 'declined'
  | 'expired'
  | 'cancelled';

export type Order = {
  id: string; // ORD-XXXXX
  clinic_id: ClinicId;
  patient_id: string;
  type: 'new' | 'reorder';
  status: OrderStatus;
  product: { medication: string; dose: string; strength: string; plan: string };
  questionnaire_responses: Record<string, unknown>;
  amendment_window: 'pre_dispensed' | 'pre_approval';
  primed_order_id: string | null;
  ryft_authorisation_id: string | null;
  amount_charged: number | null;
  amount_authorised: number | null;
  clinical_decision: {
    prescriber_user_id: string;
    decision: 'approved' | 'declined' | 'queried';
    decided_at: string;
    rationale: string;
  } | null;
  sla_warn_at: string;
  sla_breach_at: string;
  g6_flags: string[];
  created_at: string;
  updated_at: string;
};

export type Consultation = {
  id: string;
  clinic_id: ClinicId;
  patient_id: string;
  clinician_id: string;
  consultation_type: 'welcome_call' | 'coaching' | 'clinical_consult' | 'follow_up';
  modality: 'phone' | 'video' | 'chat';
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'no_show' | 'cancelled' | 'rescheduled';
  provider: string; // e.g. 'calendly+google_meet'
  provider_event_id: string | null;
  join_url_clinician: string | null;
  join_url_patient: string | null;
  recording_enabled: false; // V1 always false (DEC-40)
  transcription_enabled: false; // V1 always false
  clinical_note_id: string | null;
  linked_order_id: string | null;
};

export type Incident = {
  id: string;
  clinic_id: ClinicId;
  patient_id: string | null;
  type: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  status: 'open' | 'on_hold' | 'investigating' | 'resolved' | 'closed';
  triggered_by: 'system' | 'clinician' | 'admin';
  monday_board_id: string;
  monday_item_id: string | null;
  yellow_card_submitted: boolean;
  yellow_card_reference: string | null;
  cqc_notification_required: boolean;
  cqc_notified_at: string | null;
  created_at: string;
};

export type Complaint = {
  id: string;
  clinic_id: ClinicId;
  monday_board_id: string;
  monday_item_id: string;
  patient_id: string | null;
  received_at: string;
  status: 'received' | 'acknowledged' | 'investigating' | 'resolved' | 'closed';
  severity: 'low' | 'medium' | 'high';
  acknowledgement_due_at: string;
  acknowledgement_sent_at: string | null;
  source: 'intercom' | 'email' | 'phone' | 'external';
  cqc_quality_statements: string[];
  sync_status: 'in_sync' | 'out_of_sync' | 'error';
};

export type Amendment = {
  id: string;
  clinic_id: ClinicId;
  order_id: string;
  type: 'dose_change' | 'cancellation' | 'refund' | 'reschedule' | 'address_change' | 'dose_escalation';
  status: 'requested' | 'reviewing' | 'approved' | 'rejected' | 'applied';
  requested_by: { actor_type: 'patient' | 'admin' | 'clinician' | 'system'; actor_id: string };
  requested_at: string;
  details: Record<string, unknown>;
  decided_by: string | null;
  decided_at: string | null;
  decision_rationale: string | null;
};

export type GPLetter = {
  id: string;
  clinic_id: ClinicId;
  patient_id: string;
  template_id: string;
  subject: string;
  body: string;
  status: 'draft' | 'sent' | 'delivered' | 'bounced';
  patient_consent_verified: boolean;
  sent_at: string | null;
  sent_to_email: string | null;
};

// ============================================================================
// MOCK DATA (Sarah Cookland persona on both clinics)
// ============================================================================

const NOW = '2026-05-11T08:00:00Z';

const MOCK_CLINICS: Record<ClinicId, Clinic> = {
  vsc: {
    id: 'vsc',
    legal_entity_name: 'Quanta Healthcare Ltd',
    trading_name: 'VSC',
    cqc_registration: null,
    gphc_pharmacy_id: '1039469',
    brand_tokens: { logo_url: '/logos/vsc.svg', primary_color: '#6366f1', secondary_color: '#4338ca' },
    timezone: 'Europe/London',
    currency: 'GBP',
    features: { coaching_enabled: false, ai_clinical_note_drafting_enabled: true },
    config: {
      sla: { approval_warn_hours: 6, approval_breach_hours: 24, patient_sla_copy: 'up to 4 hours' },
      day_X_nudge: { enabled: false, trigger_day: 19, calendly_link: '', copy: '' },
      consents: [
        { id: 'consent_treatment', title: 'Consent to treatment and service', body: '...', mandatory: true, version: 'v1' },
        { id: 'consent_gp', title: 'Consent to GP communication', body: '...', mandatory: false, version: 'v1' },
      ],
      consultation_types: [],
      monday_board_ids: { incidents: '18402056019', complaints: '18409111860' },
      intercom_workspace_id: 'a86dr8yl',
    },
  },
  feeltru: {
    id: 'feeltru',
    legal_entity_name: 'FeelTru Ltd',
    trading_name: 'FeelTru',
    cqc_registration: '15258555',
    gphc_pharmacy_id: '1039469',
    brand_tokens: { logo_url: '/logos/feeltru.svg', primary_color: '#6366f1', secondary_color: '#4338ca' },
    timezone: 'Europe/London',
    currency: 'GBP',
    features: { coaching_enabled: true, ai_clinical_note_drafting_enabled: true },
    config: {
      sla: { approval_warn_hours: 6, approval_breach_hours: 24, patient_sla_copy: 'up to 4 hours' },
      day_X_nudge: { enabled: true, trigger_day: 19, calendly_link: 'https://calendly.com/feeltru/coaching', copy: 'Time for your check-in!' },
      consents: [
        { id: 'consent_treatment', title: 'Consent to treatment and service', body: '...', mandatory: true, version: 'v1' },
        { id: 'consent_gp', title: 'Consent to GP communication', body: '...', mandatory: false, version: 'v1' },
      ],
      consultation_types: [
        { id: 'welcome_call', name: 'Welcome Call', modality: 'phone', provider: 'intercom_phone', default_duration_min: 30, eligible_roles: ['Admin'], dpia_reference: null, calendly_event_type_id: null },
        { id: 'coaching', name: 'Coaching Session', modality: 'video', provider: 'calendly+google_meet', default_duration_min: 30, eligible_roles: ['Coach'], dpia_reference: 'DPIA-2026-001', calendly_event_type_id: 'evt_coaching' },
      ],
      monday_board_ids: { incidents: '18402056019', complaints: '18402056040' },
      intercom_workspace_id: 'b91ks9zm',
    },
  },
};

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
  created_at: '2026-01-15T14:30:00Z',
  updated_at: '2026-05-01T10:00:00Z',
};

const SARAH_VSC: Patient = { ...SARAH_FEELTRU, clinic_id: 'vsc', id: 'PT-00198' };

const SARAH_ORDER_FEELTRU: Order = {
  id: 'ORD-00441',
  clinic_id: 'feeltru',
  patient_id: 'PT-00198',
  type: 'reorder',
  status: 'clinical_check',
  product: { medication: 'Mounjaro', dose: '7.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: { weight_today: 84.2, side_effects: 'mild nausea', medication_changes: 'none' },
  amendment_window: 'pre_dispensed',
  primed_order_id: null,
  ryft_authorisation_id: 'ryft_auth_abc',
  amount_charged: null,
  amount_authorised: 220,
  clinical_decision: null,
  sla_warn_at: '2026-05-11T14:00:00Z',
  sla_breach_at: '2026-05-12T08:00:00Z',
  g6_flags: ['B4'],
  created_at: '2026-05-11T06:00:00Z',
  updated_at: NOW,
};

const SARAH_ORDER_VSC: Order = { ...SARAH_ORDER_FEELTRU, clinic_id: 'vsc' };

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
  created_at: '2026-01-25T10:00:00Z',
  updated_at: '2026-04-20T14:00:00Z',
};

// ── Additional orders ────────────────────────────────────────────────────────

const JAMES_ORDER_VSC: Order = {
  id: 'ORD-00438',
  clinic_id: 'vsc',
  patient_id: 'PT-00234',
  type: 'reorder',
  status: 'approved',
  product: { medication: 'Mounjaro', dose: '5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: { weight_today: 101.4, side_effects: 'none', medication_changes: 'none' },
  amendment_window: 'pre_dispensed',
  primed_order_id: null,
  ryft_authorisation_id: 'ryft_auth_jh1',
  amount_charged: 179.00,
  amount_authorised: 179.00,
  clinical_decision: {
    prescriber_user_id: 'user_qadir',
    decision: 'approved',
    decided_at: '2026-05-03T14:00:00Z',
    rationale: 'Patient progressing well. Weight loss on target. No contraindications.',
  },
  sla_warn_at: '2026-05-03T15:00:00Z',
  sla_breach_at: '2026-05-04T09:00:00Z',
  g6_flags: [],
  created_at: '2026-05-03T09:30:00Z',
  updated_at: '2026-05-03T14:00:00Z',
};

const MIRIAM_ORDER_VSC: Order = {
  id: 'ORD-00422',
  clinic_id: 'vsc',
  patient_id: 'PT-00156',
  type: 'reorder',
  status: 'clinical_check',
  product: { medication: 'Mounjaro', dose: '2.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: { weight_today: 95.1, side_effects: 'none', medication_changes: 'none' },
  amendment_window: 'pre_dispensed',
  primed_order_id: null,
  ryft_authorisation_id: 'ryft_auth_mo1',
  amount_charged: null,
  amount_authorised: 159.00,
  clinical_decision: null,
  sla_warn_at: '2026-05-11T06:00:00Z',
  sla_breach_at: '2026-05-11T12:00:00Z',
  g6_flags: [],
  created_at: '2026-05-10T12:00:00Z',
  updated_at: NOW,
};

const EMMA_ORDER_FEELTRU: Order = {
  id: 'ORD-00447',
  clinic_id: 'feeltru',
  patient_id: 'PT-00412',
  type: 'reorder',
  status: 'dispatched',
  product: { medication: 'Wegovy', dose: '1.0mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: { weight_today: 87.3, side_effects: 'none', medication_changes: 'none' },
  amendment_window: 'pre_dispensed',
  primed_order_id: 'primed_ew_001',
  ryft_authorisation_id: 'ryft_auth_ew1',
  amount_charged: 195.00,
  amount_authorised: 195.00,
  clinical_decision: {
    prescriber_user_id: 'user_qadir',
    decision: 'approved',
    decided_at: '2026-05-06T11:00:00Z',
    rationale: 'Excellent progress. 7.7 kg loss over 4 months. Continue current dose.',
  },
  sla_warn_at: '2026-05-05T16:00:00Z',
  sla_breach_at: '2026-05-06T10:00:00Z',
  g6_flags: [],
  created_at: '2026-05-05T10:00:00Z',
  updated_at: '2026-05-07T08:00:00Z',
};

const ZARA_ORDER_FEELTRU: Order = {
  id: 'ORD-00449',
  clinic_id: 'feeltru',
  patient_id: 'PT-00378',
  type: 'new',
  status: 'clinical_check',
  product: { medication: 'Mounjaro', dose: '2.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: { weight_today: 87.0, side_effects: 'none', medication_changes: 'none' },
  amendment_window: 'pre_dispensed',
  primed_order_id: null,
  ryft_authorisation_id: 'ryft_auth_za1',
  amount_charged: null,
  amount_authorised: 149.00,
  clinical_decision: null,
  sla_warn_at: '2026-05-11T11:00:00Z',
  sla_breach_at: '2026-05-12T05:00:00Z',
  g6_flags: [],
  created_at: '2026-05-11T05:00:00Z',
  updated_at: NOW,
};

const MOCK_PATIENTS: Patient[] = [
  SARAH_FEELTRU, SARAH_VSC,
  JAMES_VSC, MIRIAM_VSC, TOM_VSC, PRIYA_VSC,
  EMMA_FEELTRU, ZARA_FEELTRU, FIONA_FEELTRU,
];
const MOCK_ORDERS: Order[] = [
  SARAH_ORDER_FEELTRU, SARAH_ORDER_VSC,
  JAMES_ORDER_VSC, MIRIAM_ORDER_VSC,
  EMMA_ORDER_FEELTRU, ZARA_ORDER_FEELTRU,
];
const MOCK_CONSULTATIONS: Consultation[] = [];
const MOCK_INCIDENTS: Incident[] = [];
const MOCK_COMPLAINTS: Complaint[] = [];
const MOCK_AMENDMENTS: Amendment[] = [];
const MOCK_GP_LETTERS: GPLetter[] = [];

// Hardcoded current user — swap for real auth in Wave 1 follow-up
export const CURRENT_USER: User = {
  id: 'user_qadir',
  email: 'qadir@livera.health',
  full_name: 'Qadir Hussain',
  roles: ['Owner'],
  active_clinic_id: 'feeltru',
  professional_registrations: [],
  active: true,
};

// ============================================================================
// API HELPERS
// ============================================================================

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

class APIError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// Workspace isolation — every list filters by current clinic
function scopedToClinic<T extends { clinic_id: ClinicId }>(items: T[], clinic_id: ClinicId): T[] {
  return items.filter((item) => item.clinic_id === clinic_id);
}

// ============================================================================
// API ENDPOINTS — REST shape, will become real endpoints later
// ============================================================================

// --- Clinics ---
export async function getClinic(id: ClinicId): Promise<Clinic> {
  await delay();
  const clinic = MOCK_CLINICS[id];
  if (!clinic) throw new APIError('NOT_FOUND', 'Clinic not found');
  return clinic;
}

export async function listClinics(): Promise<Clinic[]> {
  await delay();
  return Object.values(MOCK_CLINICS);
}

// --- Auth (placeholder) ---
export async function getCurrentUser(): Promise<User> {
  await delay(50);
  return CURRENT_USER;
}

// --- Patients ---
export async function listPatients(clinic_id: ClinicId, opts?: { search?: string; status?: Patient['status'] }): Promise<Patient[]> {
  await delay();
  let results = scopedToClinic(MOCK_PATIENTS, clinic_id);
  if (opts?.search) {
    const q = opts.search.toLowerCase();
    results = results.filter((p) => p.demographic.full_name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }
  if (opts?.status) results = results.filter((p) => p.status === opts.status);
  return results;
}

export async function getPatient(clinic_id: ClinicId, id: string): Promise<Patient> {
  await delay();
  const p = MOCK_PATIENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!p) throw new APIError('NOT_FOUND', 'Patient not found');
  return p;
}

// --- Orders ---
export async function listOrders(clinic_id: ClinicId, opts?: { status?: OrderStatus; patient_id?: string }): Promise<Order[]> {
  await delay();
  let results = scopedToClinic(MOCK_ORDERS, clinic_id);
  if (opts?.status) results = results.filter((o) => o.status === opts.status);
  if (opts?.patient_id) results = results.filter((o) => o.patient_id === opts.patient_id);
  return results;
}

export async function getOrder(clinic_id: ClinicId, id: string): Promise<Order> {
  await delay();
  const o = MOCK_ORDERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!o) throw new APIError('NOT_FOUND', 'Order not found');
  return o;
}

export async function decideOrder(
  clinic_id: ClinicId,
  id: string,
  decision: 'approved' | 'declined' | 'queried',
  rationale: string
): Promise<Order> {
  await delay(400);
  const o = MOCK_ORDERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!o) throw new APIError('NOT_FOUND', 'Order not found');
  o.clinical_decision = {
    prescriber_user_id: CURRENT_USER.id,
    decision,
    decided_at: new Date().toISOString(),
    rationale,
  };
  o.status = decision === 'approved' ? 'approved' : decision === 'declined' ? 'declined' : 'on_hold';
  o.updated_at = new Date().toISOString();
  return o;
}

// --- Consultations (DEC-40 unified) ---
export async function listConsultations(
  clinic_id: ClinicId,
  opts?: { from?: string; to?: string; clinician_id?: string; type?: Consultation['consultation_type'] }
): Promise<Consultation[]> {
  await delay();
  let results = scopedToClinic(MOCK_CONSULTATIONS, clinic_id);
  if (opts?.from) results = results.filter((c) => c.scheduled_start >= opts.from!);
  if (opts?.to) results = results.filter((c) => c.scheduled_start <= opts.to!);
  if (opts?.clinician_id) results = results.filter((c) => c.clinician_id === opts.clinician_id);
  if (opts?.type) results = results.filter((c) => c.consultation_type === opts.type);
  return results;
}

export async function getConsultation(clinic_id: ClinicId, id: string): Promise<Consultation> {
  await delay();
  const c = MOCK_CONSULTATIONS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', 'Consultation not found');
  return c;
}

// --- Incidents ---
export async function listIncidents(clinic_id: ClinicId, opts?: { status?: Incident['status']; severity?: Incident['severity'] }): Promise<Incident[]> {
  await delay();
  let results = scopedToClinic(MOCK_INCIDENTS, clinic_id);
  if (opts?.status) results = results.filter((i) => i.status === opts.status);
  if (opts?.severity) results = results.filter((i) => i.severity === opts.severity);
  return results;
}

export async function getIncident(clinic_id: ClinicId, id: string): Promise<Incident> {
  await delay();
  const i = MOCK_INCIDENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!i) throw new APIError('NOT_FOUND', 'Incident not found');
  return i;
}

// --- Complaints (DEC-37: Monday-source-of-truth, Livera mirrors) ---
export async function listComplaints(clinic_id: ClinicId, opts?: { status?: Complaint['status'] }): Promise<Complaint[]> {
  await delay();
  let results = scopedToClinic(MOCK_COMPLAINTS, clinic_id);
  if (opts?.status) results = results.filter((c) => c.status === opts.status);
  return results;
}

// --- Amendments (DEC-38: refunds flow here, not Tasks) ---
export async function listAmendments(clinic_id: ClinicId, opts?: { status?: Amendment['status']; type?: Amendment['type'] }): Promise<Amendment[]> {
  await delay();
  let results = scopedToClinic(MOCK_AMENDMENTS, clinic_id);
  if (opts?.status) results = results.filter((a) => a.status === opts.status);
  if (opts?.type) results = results.filter((a) => a.type === opts.type);
  return results;
}

// --- GP Letters ---
export async function listGPLetters(clinic_id: ClinicId, opts?: { patient_id?: string; status?: GPLetter['status'] }): Promise<GPLetter[]> {
  await delay();
  let results = scopedToClinic(MOCK_GP_LETTERS, clinic_id);
  if (opts?.patient_id) results = results.filter((g) => g.patient_id === opts.patient_id);
  if (opts?.status) results = results.filter((g) => g.status === opts.status);
  return results;
}

// ============================================================================
// CLINICAL CHECK QUEUE — derived endpoint, returns orders in clinical_check status
// ============================================================================
export async function getClinicalCheckQueue(clinic_id: ClinicId): Promise<Order[]> {
  return listOrders(clinic_id, { status: 'clinical_check' });
}

// ============================================================================
// EXPORTS — types stay exported above; below are utility helpers
// ============================================================================
// Synchronous clinic lookup — use in hooks (hooks can't be async)
export function getClinicSync(id: ClinicId): Clinic {
  return MOCK_CLINICS[id] ?? MOCK_CLINICS.feeltru;
}

export { APIError };
