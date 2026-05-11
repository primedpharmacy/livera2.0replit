/**
 * Livera Mock API — frontend development against this until backend ready.
 *
 * Pattern: every component imports from this file, never from fetch directly.
 * When Yohan's backend is ready, swap implementations to call real endpoints.
 *
 * TODO (file-size refactor — do in parallel with Mini-wave 5, not before):
 *   Split into lib/api/types.ts, lib/api/fixtures/{patients,orders,clinics,consultations}.ts,
 *   and lib/api/{patients,orders,clinics,consultations,...}.ts.
 *   Keep mock.ts as a barrel re-export so no component import paths break.
 * The TypeScript types here ARE the API contract.
 *
 * All endpoints follow these conventions:
 * - REST + OpenAPI shape; URLs match `/api/v1/{resource}` style
 * - Workspace isolation enforced — every list filters by clinic_id
 * - Latency simulated with 200-400ms delay so UI handles loading states correctly
 * - Errors thrown as { code, message } objects — frontend catches and displays
 *
 * Persona spine: Sarah Cookland (PT-00198 on FeelTru, PT-00012 on VSC — different IDs per workspace
 * so cross-workspace isolation regressions surface immediately in demo data)
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
  incident_triage_text: { mild: string; moderate: string; severe: string };
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

export type MondayItem = {
  id: string;
  name: string;
  column_values: Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type MondayBoardState = {
  items: MondayItem[];
  etag: string;
};

export type IncidentType =
  | 'medication_error'
  | 'adverse_event'
  | 'delayed_dispensing'
  | 'wrong_dose'
  | 'allergic_reaction'
  | 'near_miss'
  | 'other';
export type IncidentSeverity = 'mild' | 'moderate' | 'severe';
export type IncidentStatus = 'open' | 'on_hold' | 'investigating' | 'resolved' | 'closed';

export type Incident = {
  id: string;
  clinic_id: ClinicId;
  patient_id: string | null;
  order_id: string | null;
  consultation_id: string | null;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  status: IncidentStatus;
  triggered_by: 'system' | 'clinician' | 'admin' | 'patient_report';
  reported_at: string;
  monday_board_id: string;
  monday_item_id: string | null;
  yellow_card_required: boolean;
  yellow_card_submitted: boolean;
  yellow_card_reference: string | null;
  cqc_notification_required: boolean;
  cqc_notified_at: string | null;
  escalated_to_user_id: string | null;
  resolution_notes: string | null;
  sync_status: 'in_sync' | 'out_of_sync' | 'error';
  created_at: string;
};

export type ComplaintSeverity = 'low' | 'medium' | 'high';
export type ComplaintStatus = 'received' | 'acknowledged' | 'investigating' | 'resolved' | 'closed';

export type Complaint = {
  id: string;
  clinic_id: ClinicId;
  monday_board_id: string;
  monday_item_id: string;
  patient_id: string | null;
  received_at: string;
  status: ComplaintStatus;
  severity: ComplaintSeverity;
  subject: string;
  description: string;
  acknowledgement_due_at: string;
  acknowledgement_sent_at: string | null;
  resolution_due_at: string;
  source: 'intercom' | 'email' | 'phone' | 'external' | 'in_person';
  cqc_quality_statements: Array<'Safe' | 'Effective' | 'Caring' | 'Responsive' | 'Well-led'>;
  sync_status: 'in_sync' | 'out_of_sync' | 'error';
  assigned_to_user_id: string | null;
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

export type GPLetterStatus = 'draft' | 'sent' | 'delivered' | 'bounced';

export type GPLetter = {
  id: string;
  clinic_id: ClinicId;
  patient_id: string;
  template_id: string;
  subject: string;
  body: string;
  status: GPLetterStatus;
  patient_consent_verified: boolean;
  sent_at: string | null;
  sent_to_email: string | null;
  created_by_user_id: string;
  created_at: string;
};

export type GPLetterTemplate = {
  id: string;
  name: string;
  body_template: string;
};

export type CoachingLog = {
  id: string;
  clinic_id: ClinicId;
  patient_id: string;
  coach_id: string;
  entry_type:
    | 'welcome_call'
    | 'initial_call'
    | 'routine_check_in'
    | 'ad_hoc'
    | 'missed_attempt';
  status: 'scheduled' | 'completed' | 'no_show' | 'rescheduled' | 'cancelled';
  entry_date: string;
  duration_minutes: number | null;
  summary: string;
  structured_observations: {
    mood: '1' | '2' | '3' | '4' | '5' | null;
    adherence: 'excellent' | 'good' | 'fair' | 'poor' | null;
    side_effects_reported: string | null;
    weight_self_reported_kg: number | null;
  };
  next_action: string | null;
  next_scheduled_date: string | null;
  clinical_escalation_flag_id: string | null;
  created_at: string;
  updated_at: string;
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
      incident_triage_text: {
        mild: 'Standard review. Document in incident log. No external notification required.',
        moderate: 'Clinical review required. Prescriber to assess. Consider patient follow-up.',
        severe: 'Severe incident. If patient is currently in distress or harm, advise them to call 999 or attend A&E. Yellow Card submission to MHRA is required for adverse drug reactions. CQC notification may be required (Regulation 18).',
      },
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
      incident_triage_text: {
        mild: 'Standard review. Document in incident log. No external notification required.',
        moderate: 'Clinical review required. Prescriber to assess. Consider patient follow-up.',
        severe: 'Severe incident. If patient is currently in distress or harm, advise them to call 999 or attend A&E. Yellow Card submission to MHRA is required for adverse drug reactions. CQC notification may be required (Regulation 18).',
      },
      intercom_workspace_id: 'b91ks9zm',
    },
  },
};

// ============================================================================
// MONDAY MOCK STORE — source-of-truth pattern (DEC-37, DEC-29)
// ============================================================================

// TODO (DEC-29 anomaly: VSC incidents currently land on FeelTru workspace board 18402056019)
const MOCK_MONDAY_BOARDS: Record<string, MondayBoardState> = {
  '18402056019': {
    // Shared incidents board — both VSC and FeelTru write here (DEC-29 anomaly)
    items: [
      { id: 'mbi_001', name: 'INC-001: Delayed dispensing – Zara Ahmed (FeelTru)', column_values: { status: 'open', severity: 'mild' }, created_at: '2026-05-08T09:15:00Z', updated_at: '2026-05-08T09:15:00Z' },
      { id: 'mbi_002', name: 'INC-002: Severe adverse event – Sarah Cookland (FeelTru)', column_values: { status: 'open', severity: 'severe' }, created_at: '2026-05-09T11:30:00Z', updated_at: '2026-05-09T11:30:00Z' },
      { id: 'mbi_003', name: 'INC-003: Medication error – James Hartley (VSC)', column_values: { status: 'investigating', severity: 'moderate' }, created_at: '2026-05-07T14:00:00Z', updated_at: '2026-05-10T09:00:00Z' },
      { id: 'mbi_004', name: 'INC-004: Near miss – Emma Whitfield (FeelTru)', column_values: { status: 'resolved', severity: 'mild' }, created_at: '2026-04-20T10:00:00Z', updated_at: '2026-04-25T14:00:00Z' },
      { id: 'mbi_005', name: 'INC-005: Allergic reaction – Priya Shah (VSC)', column_values: { status: 'on_hold', severity: 'severe' }, created_at: '2026-05-01T08:00:00Z', updated_at: '2026-05-03T16:00:00Z' },
    ],
    etag: 'v1',
  },
  '18409111860': {
    // VSC complaints board (DEC-37)
    items: [
      { id: 'mbc_v001', name: 'CMP-004: Unreasonable delay – James Hartley', column_values: { status: 'investigating', severity: 'high' }, created_at: '2026-04-28T10:00:00Z', updated_at: '2026-05-05T09:00:00Z' },
      { id: 'mbc_v002', name: 'CMP-005: Treatment review concerns', column_values: { status: 'closed', severity: 'medium' }, created_at: '2026-03-15T11:00:00Z', updated_at: '2026-04-10T14:00:00Z' },
    ],
    etag: 'v1',
  },
  '18402056040': {
    // FeelTru complaints board (DEC-37)
    items: [
      { id: 'mbc_f001', name: 'CMP-001: Side effect concerns – Fiona MacLeod', column_values: { status: 'received', severity: 'high' }, created_at: '2026-05-09T15:00:00Z', updated_at: '2026-05-09T15:00:00Z' },
      { id: 'mbc_f002', name: 'CMP-002: Delayed response – Zara Ahmed', column_values: { status: 'acknowledged', severity: 'medium' }, created_at: '2026-05-02T10:00:00Z', updated_at: '2026-05-05T11:00:00Z' },
      { id: 'mbc_f003', name: 'CMP-003: Prescription delay (anon)', column_values: { status: 'resolved', severity: 'low' }, created_at: '2026-04-15T09:00:00Z', updated_at: '2026-04-30T16:00:00Z' },
    ],
    etag: 'v1',
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

const SARAH_VSC: Patient = { ...SARAH_FEELTRU, clinic_id: 'vsc', id: 'PT-00012' };

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

const SARAH_ORDER_VSC: Order = { ...SARAH_ORDER_FEELTRU, clinic_id: 'vsc', patient_id: 'PT-00012' };

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
const MOCK_CONSULTATIONS: Consultation[] = [
  // ─── FeelTru consultations ────────────────────────────────────────────────
  {
    id: 'CON-F001',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',        // Sarah Cookland
    clinician_id: 'user_claire',
    consultation_type: 'clinical_consult',
    modality: 'video',
    scheduled_start: '2026-05-12T09:00:00Z',
    scheduled_end:   '2026-05-12T09:45:00Z',
    actual_start: null,
    actual_end: null,
    status: 'scheduled',
    provider: 'calendly+google_meet',
    provider_event_id: 'evt_8a3f72e1',
    join_url_clinician: 'https://meet.google.com/abc-defg-hij',
    join_url_patient:   'https://meet.google.com/abc-defg-hij',
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: null,
    linked_order_id: 'ORD-00441',
  },
  {
    id: 'CON-F002',
    clinic_id: 'feeltru',
    patient_id: 'PT-00378',        // Zara Ahmed
    clinician_id: 'user_admin',
    consultation_type: 'welcome_call',
    modality: 'phone',
    scheduled_start: '2026-05-11T10:00:00Z',
    scheduled_end:   '2026-05-11T10:30:00Z',
    actual_start: null,
    actual_end: null,
    status: 'scheduled',
    provider: 'intercom_phone',
    provider_event_id: null,
    join_url_clinician: null,
    join_url_patient: null,
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: null,
    linked_order_id: null,
  },
  {
    id: 'CON-F003',
    clinic_id: 'feeltru',
    patient_id: 'PT-00412',        // Emma Whitfield
    clinician_id: 'user_olwyn',
    consultation_type: 'coaching',
    modality: 'video',
    scheduled_start: '2026-05-11T14:00:00Z',
    scheduled_end:   '2026-05-11T14:30:00Z',
    actual_start: null,
    actual_end: null,
    status: 'scheduled',
    provider: 'calendly+google_meet',
    provider_event_id: 'evt_coaching_f003',
    join_url_clinician: 'https://meet.google.com/xyz-pqrs-tuv',
    join_url_patient:   'https://meet.google.com/xyz-pqrs-tuv',
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: null,
    linked_order_id: null,
  },
  {
    id: 'CON-F004',
    clinic_id: 'feeltru',
    patient_id: 'PT-00445',        // Fiona MacLeod
    clinician_id: 'user_olwyn',
    consultation_type: 'coaching',
    modality: 'video',
    scheduled_start: '2026-05-13T11:00:00Z',
    scheduled_end:   '2026-05-13T11:30:00Z',
    actual_start: null,
    actual_end: null,
    status: 'scheduled',
    provider: 'calendly+google_meet',
    provider_event_id: 'evt_coaching_f004',
    join_url_clinician: 'https://meet.google.com/mno-qrst-uvw',
    join_url_patient:   'https://meet.google.com/mno-qrst-uvw',
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: null,
    linked_order_id: null,
  },
  {
    id: 'CON-F005',
    clinic_id: 'feeltru',
    patient_id: 'PT-00412',        // Emma Whitfield — past completed
    clinician_id: 'user_olwyn',
    consultation_type: 'coaching',
    modality: 'video',
    scheduled_start: '2026-04-28T11:00:00Z',
    scheduled_end:   '2026-04-28T11:30:00Z',
    actual_start: '2026-04-28T11:02:00Z',
    actual_end:   '2026-04-28T11:32:00Z',
    status: 'completed',
    provider: 'calendly+google_meet',
    provider_event_id: 'evt_coaching_f005',
    join_url_clinician: null,
    join_url_patient: null,
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: 'note_f005',
    linked_order_id: null,
  },
  {
    id: 'CON-F006',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',        // Sarah Cookland — past completed
    clinician_id: 'user_olwyn',
    consultation_type: 'coaching',
    modality: 'video',
    scheduled_start: '2026-04-28T14:00:00Z',
    scheduled_end:   '2026-04-28T14:30:00Z',
    actual_start: '2026-04-28T14:01:00Z',
    actual_end:   '2026-04-28T14:31:00Z',
    status: 'completed',
    provider: 'calendly+google_meet',
    provider_event_id: 'evt_coaching_f006',
    join_url_clinician: null,
    join_url_patient: null,
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: 'note_f006',
    linked_order_id: null,
  },
  // ─── VSC consultations ────────────────────────────────────────────────────
  {
    id: 'CON-V001',
    clinic_id: 'vsc',
    patient_id: 'PT-00089',        // Tom Fletcher
    clinician_id: 'user_admin',
    consultation_type: 'welcome_call',
    modality: 'phone',
    scheduled_start: '2026-05-11T11:00:00Z',
    scheduled_end:   '2026-05-11T11:30:00Z',
    actual_start: null,
    actual_end: null,
    status: 'scheduled',
    provider: 'intercom_phone',
    provider_event_id: null,
    join_url_clinician: null,
    join_url_patient: null,
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: null,
    linked_order_id: null,
  },
  {
    id: 'CON-V002',
    clinic_id: 'vsc',
    patient_id: 'PT-00234',        // James Hartley
    clinician_id: 'user_claire',
    consultation_type: 'follow_up',
    modality: 'video',
    scheduled_start: '2026-05-14T10:00:00Z',
    scheduled_end:   '2026-05-14T10:45:00Z',
    actual_start: null,
    actual_end: null,
    status: 'scheduled',
    provider: 'calendly+google_meet',
    provider_event_id: 'evt_followup_v002',
    join_url_clinician: 'https://meet.google.com/def-ghij-klm',
    join_url_patient:   'https://meet.google.com/def-ghij-klm',
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: null,
    linked_order_id: 'ORD-00438',
  },
];
const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'INC-001',
    clinic_id: 'feeltru',
    patient_id: 'PT-00378',
    order_id: 'ORD-00449',
    consultation_id: null,
    incident_type: 'delayed_dispensing',
    severity: 'mild',
    description: "Patient's Mounjaro 2.5mg order ORD-00449 delayed beyond expected dispatch window due to pharmacy stock issue. Patient informed via SMS. No clinical harm identified.",
    status: 'open',
    triggered_by: 'system',
    reported_at: '2026-05-08T09:15:00Z',
    monday_board_id: '18402056019',
    monday_item_id: 'mbi_001',
    yellow_card_required: false,
    yellow_card_submitted: false,
    yellow_card_reference: null,
    cqc_notification_required: false,
    cqc_notified_at: null,
    escalated_to_user_id: null,
    resolution_notes: null,
    sync_status: 'in_sync',
    created_at: '2026-05-08T09:15:00Z',
  },
  {
    id: 'INC-002',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    order_id: 'ORD-00441',
    consultation_id: null,
    incident_type: 'adverse_event',
    severity: 'severe',
    description: 'Patient reported severe nausea and vomiting requiring A&E attendance following Mounjaro 7.5mg dose. Possible adverse drug reaction. MHRA Yellow Card required. CQC notification under Regulation 18 to be assessed.',
    status: 'open',
    triggered_by: 'patient_report',
    reported_at: '2026-05-09T11:30:00Z',
    monday_board_id: '18402056019',
    monday_item_id: 'mbi_002',
    yellow_card_required: true,
    yellow_card_submitted: false,
    yellow_card_reference: null,
    cqc_notification_required: true,
    cqc_notified_at: null,
    escalated_to_user_id: 'user_qadir',
    resolution_notes: null,
    sync_status: 'in_sync',
    created_at: '2026-05-09T11:30:00Z',
  },
  {
    id: 'INC-003',
    clinic_id: 'vsc',
    patient_id: 'PT-00234',
    order_id: 'ORD-00438',
    consultation_id: null,
    incident_type: 'medication_error',
    severity: 'moderate',
    description: 'Incorrect dose (10mg instead of 5mg) recorded on dispensing label for order ORD-00438. Error caught before dispatch. No patient harm. Dispensing process review required.',
    status: 'investigating',
    triggered_by: 'clinician',
    reported_at: '2026-05-07T14:00:00Z',
    monday_board_id: '18402056019',
    monday_item_id: 'mbi_003',
    yellow_card_required: false,
    yellow_card_submitted: false,
    yellow_card_reference: null,
    cqc_notification_required: false,
    cqc_notified_at: null,
    escalated_to_user_id: null,
    resolution_notes: null,
    sync_status: 'out_of_sync',
    created_at: '2026-05-07T14:00:00Z',
  },
  {
    id: 'INC-004',
    clinic_id: 'feeltru',
    patient_id: 'PT-00412',
    order_id: null,
    consultation_id: 'CON-F005',
    incident_type: 'near_miss',
    severity: 'mild',
    description: 'Prescriber almost prescribed Wegovy at incorrect dose (1.7mg vs 1.0mg) during consultation review. Error caught during pre-approval check. No patient harm.',
    status: 'resolved',
    triggered_by: 'admin',
    reported_at: '2026-04-20T10:00:00Z',
    monday_board_id: '18402056019',
    monday_item_id: 'mbi_004',
    yellow_card_required: false,
    yellow_card_submitted: false,
    yellow_card_reference: null,
    cqc_notification_required: false,
    cqc_notified_at: null,
    escalated_to_user_id: null,
    resolution_notes: 'Near miss captured and reviewed. Prescriber briefed. Pre-approval check process reinforced across clinical team.',
    sync_status: 'in_sync',
    created_at: '2026-04-20T10:00:00Z',
  },
  {
    id: 'INC-005',
    clinic_id: 'vsc',
    patient_id: 'PT-00301',
    order_id: null,
    consultation_id: null,
    incident_type: 'allergic_reaction',
    severity: 'severe',
    description: 'Patient reported severe allergic reaction (urticaria, facial swelling) after first Mounjaro 2.5mg dose. Advised to attend A&E. Yellow Card submitted to MHRA.',
    status: 'on_hold',
    triggered_by: 'patient_report',
    reported_at: '2026-05-01T08:00:00Z',
    monday_board_id: '18402056019',
    monday_item_id: 'mbi_005',
    yellow_card_required: true,
    yellow_card_submitted: true,
    yellow_card_reference: 'MHRA-2026-005891',
    cqc_notification_required: false,
    cqc_notified_at: null,
    escalated_to_user_id: 'user_qadir',
    resolution_notes: null,
    sync_status: 'in_sync',
    created_at: '2026-05-01T08:00:00Z',
  },
];
const MOCK_COMPLAINTS: Complaint[] = [
  {
    id: 'CMP-001',
    clinic_id: 'feeltru',
    monday_board_id: '18402056040',
    monday_item_id: 'mbc_f001',
    patient_id: 'PT-00445',
    received_at: '2026-05-09T15:00:00Z',
    status: 'received',
    severity: 'high',
    subject: 'Serious side effects not adequately warned about',
    description: 'Patient reports experiencing severe nausea, fatigue and hair thinning since starting Mounjaro. States she was not adequately counselled about these side effects prior to starting treatment. Requesting a full refund and urgent clinical review.',
    acknowledgement_due_at: '2026-05-13T23:59:00Z',
    acknowledgement_sent_at: null,
    resolution_due_at: '2026-06-06T23:59:00Z',
    source: 'email',
    cqc_quality_statements: ['Safe', 'Caring'],
    sync_status: 'in_sync',
    assigned_to_user_id: 'user_qadir',
  },
  {
    id: 'CMP-002',
    clinic_id: 'feeltru',
    monday_board_id: '18402056040',
    monday_item_id: 'mbc_f002',
    patient_id: 'PT-00378',
    received_at: '2026-05-02T10:00:00Z',
    status: 'acknowledged',
    severity: 'medium',
    subject: 'Delayed response to prescription query',
    description: 'Patient contacted the clinic via Intercom to query a change in her Mounjaro prescription. States she received no reply for 5 working days. She had to self-discontinue while awaiting guidance.',
    acknowledgement_due_at: '2026-05-06T23:59:00Z',
    acknowledgement_sent_at: '2026-05-05T11:00:00Z',
    resolution_due_at: '2026-05-30T23:59:00Z',
    source: 'intercom',
    cqc_quality_statements: ['Responsive'],
    sync_status: 'in_sync',
    assigned_to_user_id: 'user_qadir',
  },
  {
    id: 'CMP-003',
    clinic_id: 'feeltru',
    monday_board_id: '18402056040',
    monday_item_id: 'mbc_f003',
    patient_id: null,
    received_at: '2026-04-15T09:00:00Z',
    status: 'resolved',
    severity: 'low',
    subject: 'Prescription not dispatched within stated timeframe',
    description: 'Anonymous complaint (via website form) about prescription dispatch taking 10 working days vs stated 3–5. No personal details provided. Pharmacy SLA review initiated.',
    acknowledgement_due_at: '2026-04-19T23:59:00Z',
    acknowledgement_sent_at: '2026-04-18T14:00:00Z',
    resolution_due_at: '2026-05-09T23:59:00Z',
    source: 'external',
    cqc_quality_statements: ['Responsive'],
    sync_status: 'in_sync',
    assigned_to_user_id: null,
  },
  {
    id: 'CMP-004',
    clinic_id: 'vsc',
    monday_board_id: '18409111860',
    monday_item_id: 'mbc_v001',
    patient_id: 'PT-00234',
    received_at: '2026-04-28T10:00:00Z',
    status: 'investigating',
    severity: 'high',
    subject: 'Unreasonable delay in clinical response',
    description: 'Patient submitted urgent message regarding worsening side effects and received no clinical response for 8 working days. Patient attended A&E due to lack of guidance. Potential safeguarding concern.',
    acknowledgement_due_at: '2026-05-01T23:59:00Z',
    acknowledgement_sent_at: '2026-04-30T16:00:00Z',
    resolution_due_at: '2026-05-26T23:59:00Z',
    source: 'phone',
    cqc_quality_statements: ['Safe', 'Responsive', 'Well-led'],
    sync_status: 'out_of_sync',
    assigned_to_user_id: null,
  },
  {
    id: 'CMP-005',
    clinic_id: 'vsc',
    monday_board_id: '18409111860',
    monday_item_id: 'mbc_v002',
    patient_id: null,
    received_at: '2026-03-15T11:00:00Z',
    status: 'closed',
    severity: 'medium',
    subject: 'Concerns about treatment review process',
    description: 'Patient unhappy with how their 3-month treatment review was conducted. States the review felt rushed and did not address their questions about long-term use. Resolved following additional consultation.',
    acknowledgement_due_at: '2026-03-19T23:59:00Z',
    acknowledgement_sent_at: '2026-03-18T10:00:00Z',
    resolution_due_at: '2026-04-08T23:59:00Z',
    source: 'in_person',
    cqc_quality_statements: ['Caring', 'Effective'],
    sync_status: 'in_sync',
    assigned_to_user_id: null,
  },
];
const MOCK_AMENDMENTS: Amendment[] = [
  {
    id: 'AMEND-001',
    clinic_id: 'feeltru',
    order_id: 'ORD-00441',
    type: 'dose_escalation',
    status: 'requested',
    requested_by: { actor_type: 'patient', actor_id: 'PT-00198' },
    requested_at: '2026-05-11T07:30:00Z',
    details: {
      current_dose: '7.5mg',
      requested_dose: '10mg',
      reason: 'Patient reports plateau in weight loss over last 4 weeks and tolerating current dose well.',
    },
    decided_by: null,
    decided_at: null,
    decision_rationale: null,
  },
  {
    id: 'AMEND-002',
    clinic_id: 'feeltru',
    order_id: 'ORD-00447',
    type: 'refund',
    status: 'reviewing',
    requested_by: { actor_type: 'admin', actor_id: 'user_qadir' },
    requested_at: '2026-05-10T15:00:00Z',
    details: {
      amount_gbp: 195.00,
      reason: 'Duplicate charge raised during payment processing on 10 May 2026. Ryft duplicate auth confirmed.',
      ryft_refund_ref: 'ryft_ref_ew_dup',
    },
    decided_by: null,
    decided_at: null,
    decision_rationale: null,
  },
];
const MOCK_GP_LETTER_TEMPLATES: GPLetterTemplate[] = [
  {
    id: 'TMPL-001',
    name: 'Treatment commencement notification',
    body_template: `Dear {{gp_name}},

I am writing to notify you that your patient {{patient_name}} has commenced treatment with our clinic.

They have been prescribed {{medication}} at {{dose}} following a comprehensive clinical assessment. We have reviewed their medical history and ensured this treatment is appropriate.

Please do not hesitate to contact us if you have any concerns or require further clinical information.

Kind regards,
The Clinical Team
{{clinic_name}}
{{clinic_email}}`,
  },
  {
    id: 'TMPL-002',
    name: 'Dose escalation notification',
    body_template: `Dear {{gp_name}},

I am writing to inform you that we have escalated the dose of {{medication}} for your patient {{patient_name}}.

Following clinical review, the dose has been increased to {{dose}}. The patient is tolerating treatment well and has been counselled regarding the change.

We will continue to monitor and will keep you informed of any further changes.

Kind regards,
The Clinical Team
{{clinic_name}}
{{clinic_email}}`,
  },
  {
    id: 'TMPL-003',
    name: 'Treatment cessation notification',
    body_template: `Dear {{gp_name}},

I am writing to inform you that your patient {{patient_name}} has discontinued treatment with our clinic.

Treatment with {{medication}} has been stopped. The patient has been advised to follow up with your practice if they wish to explore further weight management options.

Please update your records accordingly.

Kind regards,
The Clinical Team
{{clinic_name}}
{{clinic_email}}`,
  },
  {
    id: 'TMPL-004',
    name: 'Adverse event notification',
    body_template: `Dear {{gp_name}},

I am writing urgently to notify you of an adverse event experienced by your patient {{patient_name}} during treatment with {{medication}} at {{dose}}.

The patient has reported [adverse event details]. We have taken the following actions: [actions taken].

We would recommend a clinical review at your earliest convenience. A Yellow Card report has been / is being submitted to the MHRA.

Kind regards,
The Clinical Team
{{clinic_name}}
{{clinic_email}}`,
  },
  {
    id: 'TMPL-005',
    name: 'Progress update',
    body_template: `Dear {{gp_name}},

Please find below a progress update for your patient {{patient_name}}, who is currently under our care for weight management.

Current medication: {{medication}} at {{dose}}
Treatment duration: [duration]
Weight change: [weight change]
Tolerability: [tolerability notes]

We are satisfied with the patient's progress and plan to continue treatment. Please contact us if you have any questions.

Kind regards,
The Clinical Team
{{clinic_name}}
{{clinic_email}}`,
  },
];

const MOCK_GP_LETTERS: GPLetter[] = [
  {
    id: 'GPL-001',
    clinic_id: 'feeltru',
    patient_id: 'PT-00378',
    template_id: 'TMPL-001',
    subject: 'Treatment commencement notification — Zara Ahmed',
    body: `Dear Dr. Patel,

I am writing to notify you that your patient Zara Ahmed has commenced treatment with our clinic.

They have been prescribed Mounjaro (tirzepatide) at 2.5mg weekly following a comprehensive clinical assessment. We have reviewed their medical history and ensured this treatment is appropriate.

Please do not hesitate to contact us if you have any concerns or require further clinical information.

Kind regards,
The Clinical Team
FeelTru
admin@feeltru.com`,
    status: 'delivered',
    patient_consent_verified: true,
    sent_at: '2026-04-10T10:30:00Z',
    sent_to_email: 'dr.patel@holborngp.nhs.uk',
    created_by_user_id: 'user_qadir',
    created_at: '2026-04-10T10:00:00Z',
  },
  {
    id: 'GPL-002',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    template_id: 'TMPL-002',
    subject: 'Dose escalation notification — Sarah Cookland',
    body: `Dear Dr. Williams,

I am writing to inform you that we have escalated the dose of Mounjaro (tirzepatide) for your patient Sarah Cookland.

Following clinical review, the dose has been increased to 7.5mg weekly. The patient is tolerating treatment well and has been counselled regarding the change.

We will continue to monitor and will keep you informed of any further changes.

Kind regards,
The Clinical Team
FeelTru
admin@feeltru.com`,
    status: 'draft',
    patient_consent_verified: true,
    sent_at: null,
    sent_to_email: null,
    created_by_user_id: 'user_qadir',
    created_at: '2026-05-10T14:00:00Z',
  },
  {
    id: 'GPL-003',
    clinic_id: 'feeltru',
    patient_id: 'PT-00445',
    template_id: 'TMPL-004',
    subject: 'Adverse event notification — Fiona MacLeod',
    body: `Dear Dr. Singh,

I am writing urgently to notify you of an adverse event experienced by your patient Fiona MacLeod during treatment with Mounjaro (tirzepatide) at 5mg weekly.

The patient has reported severe nausea, fatigue and hair thinning. We have taken the following actions: dose held, safety review initiated, patient contacted.

We would recommend a clinical review at your earliest convenience.

Kind regards,
The Clinical Team
FeelTru
admin@feeltru.com`,
    status: 'draft',
    patient_consent_verified: false,
    sent_at: null,
    sent_to_email: null,
    created_by_user_id: 'user_qadir',
    created_at: '2026-05-11T07:30:00Z',
  },
  {
    id: 'GPL-004',
    clinic_id: 'vsc',
    patient_id: 'PT-00234',
    template_id: 'TMPL-005',
    subject: 'Progress update — James Hartley',
    body: `Dear Dr. Khan,

Please find below a progress update for your patient James Hartley, who is currently under our care for weight management.

Current medication: Mounjaro (tirzepatide) at 5mg weekly
Treatment duration: 3 months
Weight change: -8.2kg
Tolerability: Good, mild nausea initially, now resolved

We are satisfied with the patient's progress and plan to continue treatment.

Kind regards,
The Clinical Team
VSC Health
admin@vsc.com`,
    status: 'sent',
    patient_consent_verified: true,
    sent_at: '2026-05-08T09:00:00Z',
    sent_to_email: 'dr.khan@mancgp.nhs.uk',
    created_by_user_id: 'user_vsc_admin',
    created_at: '2026-05-08T08:30:00Z',
  },
];
const MOCK_COACHING_LOGS: CoachingLog[] = [
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

// --- Monday.com mock proxy (DEC-37, DEC-29) ---
async function mondayRead(boardId: string): Promise<MondayBoardState> {
  await delay(150);
  const board = MOCK_MONDAY_BOARDS[boardId] ?? { items: [], etag: 'empty' };
  console.log('[MONDAY READ]', { boardId, etag: board?.etag ?? '(missing)' });
  return board;
}

async function mondayWrite(
  boardId: string,
  op: 'create' | 'update',
  item: Partial<MondayItem> & { id: string }
): Promise<MondayBoardState> {
  await delay(200);
  if (!MOCK_MONDAY_BOARDS[boardId]) {
    MOCK_MONDAY_BOARDS[boardId] = { items: [], etag: 'v1' };
  }
  const board = MOCK_MONDAY_BOARDS[boardId];
  if (op === 'create') {
    board.items.push({
      id: item.id,
      name: item.name ?? 'New item',
      column_values: item.column_values ?? {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else {
    const existing = board.items.find((i) => i.id === item.id);
    if (existing) {
      existing.column_values = { ...existing.column_values, ...(item.column_values ?? {}) };
      existing.updated_at = new Date().toISOString();
    }
  }
  board.etag = `v${Date.now()}`;
  console.log('[MONDAY WRITE]', { boardId, op, etag: board.etag });
  return board;
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
  // Layer 3 — Audit: log every attempt before any validation
  // TODO: Replace with audit_event API call when backend is ready
  console.log('[AUDIT]', {
    event_type: 'clinical_decision_attempt',
    clinic_id,
    order_id: id,
    user_id: CURRENT_USER.id,
    decision_attempted: decision,
    rationale,
    timestamp: new Date().toISOString(),
  });

  await delay(400);
  const o = MOCK_ORDERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!o) throw new APIError('NOT_FOUND', 'Order not found');

  // Layer 2 — Data guard: validate before applying any decision
  if (o.status !== 'clinical_check') {
    // TODO: Replace with audit_event API call when backend is ready
    console.log('[AUDIT]', {
      event_type: 'clinical_decision_result',
      outcome: 'safety_violation',
      reason: 'not_in_clinical_check',
      order_id: id,
      user_id: CURRENT_USER.id,
      timestamp: new Date().toISOString(),
    });
    throw new APIError('SAFETY_VIOLATION', 'Cannot act on this order: it is not in clinical_check status');
  }

  if (decision === 'approved') {
    const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === o.patient_id);
    const hasHighUnacknowledgedFlag = patient?.flags.some(
      (f) => f.severity === 'high' && f.code !== 'B4_acknowledged'
    ) ?? false;

    if (hasHighUnacknowledgedFlag) {
      // TODO: Replace with audit_event API call when backend is ready
      console.log('[AUDIT]', {
        event_type: 'clinical_decision_result',
        outcome: 'safety_violation',
        reason: 'high_severity_flag_unacknowledged',
        order_id: id,
        user_id: CURRENT_USER.id,
        timestamp: new Date().toISOString(),
      });
      throw new APIError('SAFETY_VIOLATION', 'Cannot approve: patient has an unacknowledged high-severity clinical flag');
    }

    const hasDoseEscalation = 'dose_escalation' in o.questionnaire_responses;
    const hasPriorDoseEvidence = Boolean(o.questionnaire_responses['prior_dose_evidence']);
    if (hasDoseEscalation && !hasPriorDoseEvidence) {
      // TODO: Replace with audit_event API call when backend is ready
      console.log('[AUDIT]', {
        event_type: 'clinical_decision_result',
        outcome: 'safety_violation',
        reason: 'dose_escalation_no_prior_evidence',
        order_id: id,
        user_id: CURRENT_USER.id,
        timestamp: new Date().toISOString(),
      });
      throw new APIError('SAFETY_VIOLATION', 'Cannot approve: dose escalation requires prior dose evidence in questionnaire');
    }
  }

  o.clinical_decision = {
    prescriber_user_id: CURRENT_USER.id,
    decision,
    decided_at: new Date().toISOString(),
    rationale,
  };
  o.status = decision === 'approved' ? 'approved' : decision === 'declined' ? 'declined' : 'on_hold';
  o.updated_at = new Date().toISOString();

  // TODO: Replace with audit_event API call when backend is ready
  console.log('[AUDIT]', {
    event_type: 'clinical_decision_result',
    outcome: decision,
    order_id: id,
    user_id: CURRENT_USER.id,
    new_status: o.status,
    timestamp: new Date().toISOString(),
  });

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

// --- Incidents (DEC-29: VSC+FeelTru share Monday board 18402056019) ---
export async function listIncidents(
  clinic_id: ClinicId,
  opts?: { status?: Incident['status']; severity?: Incident['severity']; incident_type?: Incident['incident_type'] }
): Promise<Incident[]> {
  await delay();
  let results = scopedToClinic(MOCK_INCIDENTS, clinic_id);
  if (opts?.status) results = results.filter((i) => i.status === opts.status);
  if (opts?.severity) results = results.filter((i) => i.severity === opts.severity);
  if (opts?.incident_type) results = results.filter((i) => i.incident_type === opts.incident_type);
  return results;
}

export async function getIncident(clinic_id: ClinicId, id: string): Promise<Incident> {
  await delay();
  const i = MOCK_INCIDENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!i) throw new APIError('NOT_FOUND', 'Incident not found');
  return i;
}

export async function updateIncidentStatus(
  clinic_id: ClinicId,
  id: string,
  status: Incident['status'],
  resolution_notes?: string
): Promise<Incident> {
  await delay(300);
  const i = MOCK_INCIDENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!i) throw new APIError('NOT_FOUND', 'Incident not found');
  i.status = status;
  if (resolution_notes !== undefined) i.resolution_notes = resolution_notes;
  if (i.monday_item_id) {
    await mondayWrite(i.monday_board_id, 'update', { id: i.monday_item_id, column_values: { status } });
    i.sync_status = 'in_sync';
  }
  console.log('[AUDIT]', { action: 'incident.status_updated', incident_id: id, status, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return i;
}

export async function submitYellowCard(clinic_id: ClinicId, id: string): Promise<Incident> {
  await delay(600);
  const i = MOCK_INCIDENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!i) throw new APIError('NOT_FOUND', 'Incident not found');
  if (i.yellow_card_submitted) throw new APIError('ALREADY_SUBMITTED', 'Yellow Card already submitted for this incident');
  i.yellow_card_submitted = true;
  i.yellow_card_reference = `MHRA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(6, '0')}`;
  console.log('[AUDIT]', { action: 'yellow_card.submitted', incident_id: id, reference: i.yellow_card_reference, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return i;
}

export async function notifyCQC(clinic_id: ClinicId, id: string): Promise<Incident> {
  await delay(400);
  const i = MOCK_INCIDENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!i) throw new APIError('NOT_FOUND', 'Incident not found');
  if (i.cqc_notified_at) throw new APIError('ALREADY_NOTIFIED', 'CQC has already been notified for this incident');
  i.cqc_notified_at = new Date().toISOString();
  console.log('[AUDIT]', { action: 'cqc.notified', incident_id: id, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return i;
}

export async function syncIncidentFromMonday(clinic_id: ClinicId, id: string): Promise<Incident> {
  const i = MOCK_INCIDENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!i) throw new APIError('NOT_FOUND', 'Incident not found');
  await mondayRead(i.monday_board_id);
  i.sync_status = 'in_sync';
  console.log('[AUDIT]', { action: 'incident.synced_from_monday', incident_id: id, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return i;
}

// --- Complaints (DEC-37: Monday-source-of-truth, Livera mirrors) ---
export async function listComplaints(
  clinic_id: ClinicId,
  opts?: { status?: Complaint['status']; severity?: Complaint['severity'] }
): Promise<Complaint[]> {
  await delay();
  let results = scopedToClinic(MOCK_COMPLAINTS, clinic_id);
  if (opts?.status) results = results.filter((c) => c.status === opts.status);
  if (opts?.severity) results = results.filter((c) => c.severity === opts.severity);
  return results;
}

export async function getComplaint(clinic_id: ClinicId, id: string): Promise<Complaint> {
  await delay();
  const c = MOCK_COMPLAINTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', 'Complaint not found');
  return c;
}

export async function acknowledgeComplaint(clinic_id: ClinicId, id: string): Promise<Complaint> {
  await delay(300);
  const c = MOCK_COMPLAINTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', 'Complaint not found');
  if (c.status !== 'received') throw new APIError('INVALID_STATE', 'Complaint must be in received state to acknowledge');
  c.status = 'acknowledged';
  c.acknowledgement_sent_at = new Date().toISOString();
  if (c.monday_item_id) {
    await mondayWrite(c.monday_board_id, 'update', { id: c.monday_item_id, column_values: { status: 'acknowledged' } });
    c.sync_status = 'in_sync';
  }
  console.log('[AUDIT]', { action: 'complaint.acknowledged', complaint_id: id, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return c;
}

export async function updateComplaintStatus(
  clinic_id: ClinicId,
  id: string,
  status: Complaint['status']
): Promise<Complaint> {
  await delay(300);
  const c = MOCK_COMPLAINTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', 'Complaint not found');
  c.status = status;
  if (c.monday_item_id) {
    await mondayWrite(c.monday_board_id, 'update', { id: c.monday_item_id, column_values: { status } });
    c.sync_status = 'in_sync';
  }
  console.log('[AUDIT]', { action: 'complaint.status_updated', complaint_id: id, status, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return c;
}

export async function syncComplaintFromMonday(clinic_id: ClinicId, id: string): Promise<Complaint> {
  const c = MOCK_COMPLAINTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', 'Complaint not found');
  await mondayRead(c.monday_board_id);
  c.sync_status = 'in_sync';
  console.log('[AUDIT]', { action: 'complaint.synced_from_monday', complaint_id: id, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return c;
}

// --- Amendments (DEC-38: refunds flow here, not Tasks) ---
export async function listAmendments(clinic_id: ClinicId, opts?: { status?: Amendment['status']; type?: Amendment['type'] }): Promise<Amendment[]> {
  await delay();
  let results = scopedToClinic(MOCK_AMENDMENTS, clinic_id);
  if (opts?.status) results = results.filter((a) => a.status === opts.status);
  if (opts?.type) results = results.filter((a) => a.type === opts.type);
  return results;
}

export async function getAmendment(clinic_id: ClinicId, id: string): Promise<Amendment> {
  await delay();
  const a = MOCK_AMENDMENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!a) throw new APIError('NOT_FOUND', 'Amendment not found');
  return a;
}

export async function decideAmendment(
  clinic_id: ClinicId,
  id: string,
  decision: 'approved' | 'rejected',
  rationale: string
): Promise<Amendment> {
  // Layer 3 — Audit: log every attempt before any validation
  // TODO: Replace with audit_event API call when backend is ready
  console.log('[AUDIT]', {
    event_type: 'amendment_decision_attempt',
    clinic_id,
    amendment_id: id,
    user_id: CURRENT_USER.id,
    decision_attempted: decision,
    rationale,
    timestamp: new Date().toISOString(),
  });

  await delay(400);
  const a = MOCK_AMENDMENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!a) throw new APIError('NOT_FOUND', 'Amendment not found');

  // Layer 2 — Data guard: validate before applying any decision
  if (a.status !== 'requested' && a.status !== 'reviewing') {
    throw new APIError('INVALID_STATE', 'Amendment cannot be decided in its current state');
  }

  // Layer 1 — Safety re-validation for dose escalation approvals
  if (decision === 'approved' && a.type === 'dose_escalation') {
    const order = MOCK_ORDERS.find((o) => o.clinic_id === clinic_id && o.id === a.order_id);
    const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === order?.patient_id);
    const hasHighUnacknowledgedFlag = patient?.flags.some(
      (f) => f.severity === 'high' && f.code !== 'B4_acknowledged'
    ) ?? false;

    if (hasHighUnacknowledgedFlag) {
      // TODO: Replace with audit_event API call when backend is ready
      console.log('[AUDIT]', {
        event_type: 'amendment_decision_result',
        outcome: 'safety_violation',
        reason: 'high_severity_flag_unacknowledged',
        amendment_id: id,
        user_id: CURRENT_USER.id,
        timestamp: new Date().toISOString(),
      });
      throw new APIError('SAFETY_VIOLATION', 'Cannot approve: patient has an unacknowledged high-severity clinical flag');
    }
  }

  a.status = decision === 'approved' ? 'approved' : 'rejected';
  a.decided_by = CURRENT_USER.id;
  a.decided_at = new Date().toISOString();
  a.decision_rationale = rationale;

  // TODO: Replace with audit_event API call when backend is ready
  console.log('[AUDIT]', {
    event_type: 'amendment_decision_result',
    outcome: decision,
    amendment_id: id,
    user_id: CURRENT_USER.id,
    timestamp: new Date().toISOString(),
  });

  return a;
}

// --- GP Letters ---
export async function listGPLetters(
  clinic_id: ClinicId,
  opts?: { patient_id?: string; status?: GPLetter['status'] }
): Promise<GPLetter[]> {
  await delay();
  let results = scopedToClinic(MOCK_GP_LETTERS, clinic_id);
  if (opts?.patient_id) results = results.filter((g) => g.patient_id === opts.patient_id);
  if (opts?.status) results = results.filter((g) => g.status === opts.status);
  return results;
}

export async function getGPLetter(clinic_id: ClinicId, id: string): Promise<GPLetter> {
  await delay();
  const g = MOCK_GP_LETTERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!g) throw new APIError('NOT_FOUND', 'GP letter not found');
  return g;
}

export async function createGPLetter(
  clinic_id: ClinicId,
  data: { patient_id: string; template_id: string; subject: string; body: string }
): Promise<GPLetter> {
  await delay(400);
  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === data.patient_id);
  if (!patient) throw new APIError('NOT_FOUND', 'Patient not found');
  const consentVerified = patient.consents_given.some((c) => c.consent_id === 'consent_gp');
  const letter: GPLetter = {
    id: `GPL-${String(MOCK_GP_LETTERS.length + 1).padStart(3, '0')}`,
    clinic_id,
    patient_id: data.patient_id,
    template_id: data.template_id,
    subject: data.subject,
    body: data.body,
    status: 'draft',
    patient_consent_verified: consentVerified,
    sent_at: null,
    sent_to_email: null,
    created_by_user_id: CURRENT_USER.id,
    created_at: new Date().toISOString(),
  };
  MOCK_GP_LETTERS.push(letter);
  console.log('[AUDIT]', { action: 'gp_letter.created', letter_id: letter.id, patient_id: data.patient_id, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return letter;
}

export async function sendGPLetter(clinic_id: ClinicId, id: string): Promise<GPLetter> {
  await delay(600);
  const g = MOCK_GP_LETTERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!g) {
    console.log('[AUDIT]', { event_type: 'gp_letter_send_result', outcome: 'not_found', clinic_id, letter_id: id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
    throw new APIError('NOT_FOUND', 'GP letter not found');
  }
  if (g.status !== 'draft') {
    console.log('[AUDIT]', { event_type: 'gp_letter_send_result', outcome: 'invalid_state', clinic_id, letter_id: id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
    throw new APIError('INVALID_STATE', 'Letter is not in draft status');
  }
  if (!g.patient_consent_verified) {
    console.log('[AUDIT]', { event_type: 'gp_letter_send_result', outcome: 'consent_violation', clinic_id, letter_id: id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
    throw new APIError('CONSENT_VIOLATION', 'Patient has not consented to GP communication');
  }
  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === g.patient_id);
  const gpEmail = patient?.gp?.email ?? null;
  if (!gpEmail) {
    console.log('[AUDIT]', { event_type: 'gp_letter_send_result', outcome: 'no_gp_email', clinic_id, letter_id: id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
    throw new APIError('NO_GP_EMAIL', 'No GP email address on record for this patient');
  }
  g.status = 'sent';
  g.sent_at = new Date().toISOString();
  g.sent_to_email = gpEmail;
  console.log('[AUDIT]', { action: 'gp_letter.sent', letter_id: id, sent_to: gpEmail, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return g;
}

export async function reassignComplaint(
  clinic_id: ClinicId,
  id: string,
  new_assignee_user_id: string,
): Promise<Complaint> {
  await delay(150);
  const c = MOCK_COMPLAINTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', `Complaint ${id} not found`);

  // Monday first
  await mondayWrite(c.monday_board_id, 'update', {
    id: c.monday_item_id,
    column_values: { assignee: new_assignee_user_id },
  });

  // Mirror to Livera
  c.assigned_to_user_id = new_assignee_user_id;
  c.sync_status = 'in_sync';

  console.log('[AUDIT]', {
    event_type: 'complaint.reassigned',
    clinic_id,
    complaint_id: id,
    new_assignee_user_id,
    user_id: CURRENT_USER.id,
    timestamp: new Date().toISOString(),
  });

  return c;
}

export async function listGPLetterTemplates(): Promise<GPLetterTemplate[]> {
  await delay(100);
  return MOCK_GP_LETTER_TEMPLATES;
}

// --- Coaching Logs ---
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
