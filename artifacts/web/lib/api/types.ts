/**
 * Livera API type definitions — Wave 1 (Chunk 1 Foundations).
 *
 * ClinicConfig schema matches PRODUCT_VISION.md §6.1 exactly.
 * These types ARE the API contract. When Yohan's backend is ready,
 * these stay as the shared contract layer; only implementations move.
 *
 * Role notes (V1.2):
 *   Active roles: Owner | Admin | Prescriber | Coach
 *   Deprecated (code retained for migration): RM | Manager | Pharmacist | Technician
 */

export type ClinicId = 'vsc' | 'feeltru';

export type Role =
  | 'Owner'
  | 'Admin'
  | 'Prescriber'
  | 'Coach'
  | 'RM'           // deprecated — retained for migration only
  | 'Manager'      // deprecated — retired from UI per V1.2
  | 'Pharmacist'   // deprecated — retired from UI per V1.2
  | 'Technician';  // deprecated — retired from UI per V1.2

// --- Consent template (DEC-32) ---
export type ConsentTemplate = {
  consent_id: string;
  title: string;
  body: string;             // markdown
  mandatory: boolean;
  order: number;            // display order on registration Screen 5a
  version: number;
  last_updated: string;     // ISO
  last_updated_by: string;  // user_id
};

// --- Holiday entry (DEC-15) ---
export type HolidayEntry = {
  date: string;  // ISO date (YYYY-MM-DD)
  name: string;
};

// --- Consultation type config (DEC-40) ---
export type ConsultationTypeConfig = {
  id: string;
  name: string;
  modality: 'phone' | 'video' | 'chat';
  provider: string;  // e.g. 'intercom_phone', 'calendly+google_meet'
  default_duration_min: number;
  eligible_roles: Role[];
  dpia_reference: string | null;
  calendly_event_type_id: string | null;
};

// --- Clinic team member (per-clinic user view) ---
export type ClinicTeamMember = {
  user_id: string;
  full_name: string;
  email: string;
  role: Role;
  clinic_id: ClinicId;
  professional_registration: {
    body: string;
    reg_number: string;
    expiry: string;
    status: 'active' | 'expired' | 'pending';
  } | null;
  active: boolean;
  joined_at: string;  // ISO
};

// --- Clinic config (PRODUCT_VISION.md §6.1 — authoritative schema) ---
export type ClinicConfig = {
  // Identity
  clinic_id: ClinicId;
  clinic_name: string;
  legal_entity_name: string;
  cqc_provider_id: string | null;
  gphc_pharmacy_id: string | null;

  // Behavioural flags (BLD-1.1, DEC-02, DEC-16)
  coaching_enabled: boolean;          // gated by DEC-02; per-clinic toggle per DEC-34 refined
  gender_eligibility: 'female_only' | 'gender_neutral';  // DEC-16
  amendment_window: 'pre_dispensed' | 'pre_approval';    // DEC-01: both clinics pre_dispensed

  // Brand (§3.3 — injected via clinic_config; no hex codes in components)
  brand_tokens: {
    primary: string;
    primary_dark: string;
    accent: string;
    gradient: string;
    font_family: string;
    logo_url: string;
  };

  // Comms (BLD-1.3)
  reply_email: string;
  patient_sla_copy: string;  // e.g. "Clinical review usually takes up to 4 hours"

  // SLA values (BLD-1.4 — 10 values per DEC-04, DEC-35)
  default_slas: {
    approval_warn_hours: number;           // default 6
    approval_breach_hours: number;         // default 24
    intervention_resolution_wd: number;    // default 7 (working days)
    gp_letter_send_hours: number;          // default 48
    order_expiry_days: number;             // default 6 (calendar days)
    complaint_ack_wd: number;              // default 3 (working days)
    complaint_response_wd: number;         // default 20 (working days)
    coach_escalation_response_wh: number;  // default 24 (working hours)
    welcome_call_wd: number;               // default 5 (working days)
    initial_coaching_call_days: number;    // default 7 (calendar days)
  };

  // Monday integration (BLD-1.3, DEC-29, DEC-37)
  monday_incident_board_id: string;    // DEC-29: 18402056019 (shared severe SE board)
  monday_complaints_board_id: string;  // DEC-37: 18409111860 (VSC) | 18402056040 (FeelTru)

  // Calendly (DEC-34, DEC-40)
  calendly_account_id: string | null;

  // Consents (DEC-32) — fully customisable; 9-item default seed
  consents: ConsentTemplate[];

  // Holiday calendar (DEC-15) — pre-loaded UK public holidays + per-clinic additions
  holiday_calendar: HolidayEntry[];

  // Day-X nudge (DEC-30) — configurable per clinic; NOT hardcoded
  day_x_nudge: {
    enabled: boolean;
    trigger_day: number;  // default 19
    calendly_link_override: string | null;
    custom_copy_override: string | null;
  };

  // Drug watchlist (DEC-39) — MHRA alert filter
  drug_watchlist: string[];

  // Consultation types (DEC-40) — per-clinic template
  consultation_types: ConsultationTypeConfig[];

  // Incident triage text — NO hardcoded clinical logic; all from config (§3.2 rule 3)
  incident_triage_text: {
    mild: string;
    moderate: string;
    severe: string;
  };

  // Intercom workspace
  intercom_workspace_id: string;

  // Feature flags
  features: {
    gp_letter_enabled: boolean;
    pharmacy_comms_enabled: boolean;
    bmi_ai_validation_enabled: boolean;
    primed_flag_mirror_enabled: boolean;
    video_consultations_enabled: boolean;
    welcome_calls_enabled: boolean;                // always true at V1 per DEC-34
    ai_clinical_note_drafting_enabled: boolean;    // gated by BLD-6.5 sign-off
  };
};

// --- Clinic (outer entity) ---
// All identity + config fields now live inside ClinicConfig (§6.1).
export type Clinic = {
  id: ClinicId;
  config: ClinicConfig;
};

// --- User ---
export type User = {
  id: string;
  email: string;
  full_name: string;
  roles: Role[];
  active_clinic_id: ClinicId;
  professional_registrations: Array<{
    body: string;
    reg_number: string;
    expiry: string;
    status: string;
  }>;
  active: boolean;
};

// --- Patient ---
export type Patient = {
  id: string;  // PT-XXXXX
  clinic_id: ClinicId;
  demographic: {
    full_name: string;
    dob: string;
    sex_at_birth: 'female' | 'male' | 'other';
    ethnicity: string;
    address: { line1: string; line2?: string; city: string; postcode: string };
  };
  contact: { email: string; phone: string; preferred_channel: 'email' | 'sms' | 'phone' };
  gp: {
    name: string;
    address: string;
    phone: string;
    email: string;
    nhs_ods_id: string;
  } | null;
  baseline: { height_cm: number; baseline_weight_kg: number; baseline_bmi: number };
  latest: { weight_kg: number; bmi: number; recorded_at: string };
  verification: {
    sumsub_id: string;
    identity_verified_at: string | null;
    bmi_verified_at: string | null;
  };
  consents_given: Array<{ consent_id: string; version: string; given_at: string }>;
  flags: Array<{ id: string; code: string; severity: 'low' | 'medium' | 'high'; raised_at: string }>;
  status: 'new' | 'active' | 'monitoring' | 'suspended';
  vip: boolean;
  created_at: string;
  updated_at: string;
};

// --- Order ---
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
  id: string;  // ORD-XXXXX
  clinic_id: ClinicId;
  patient_id: string;
  type: 'new' | 'reorder';
  status: OrderStatus;
  product: { medication: string; dose: string; strength: string; plan: string };
  questionnaire_responses: Record<string, unknown>;
  amendment_window: 'pre_dispensed' | 'pre_approval';  // DEC-01
  primed_order_id: string | null;
  primed_clinical_check_completed: boolean;  // DEC-28: boundary state for data sync
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

// --- Consultation (DEC-40 — unified entity) ---
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
  provider: string;  // provider-agnostic per DEC-40 — e.g. 'calendly+google_meet'
  provider_event_id: string | null;
  join_url_clinician: string | null;
  join_url_patient: string | null;
  recording_enabled: false;      // V1 always false (DEC-40)
  transcription_enabled: false;  // V1 always false (DEC-40)
  clinical_note_id: string | null;
  linked_order_id: string | null;
};

// --- Monday (DEC-29, DEC-37) ---
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

// --- Incident ---
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

// --- Complaint (DEC-37 — Monday source of truth; Livera mirrors) ---
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

// --- Amendment (DEC-38) ---
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

// --- GP Communication (DEC-22) ---
export type GPLetterStatus = 'draft' | 'sent' | 'delivered' | 'bounced';

export type GPCommunicationLifecycle =
  | 'awaiting_consent'  // patient hasn't consented to GP correspondence
  | 'owed'              // consented + first treatment approved → letter queued
  | 'sent'              // Postmark delivery confirmed
  | 'cancelled'         // prescriber cancelled with reason (terminal)
  | 'ad_hoc';           // one-off letter (dose change / discontinuation / safeguarding)

export type GPLetter = {
  id: string;
  clinic_id: ClinicId;
  patient_id: string;
  template_id: string;
  subject: string;
  body: string;
  lifecycle_status: GPCommunicationLifecycle;
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

// --- Coaching log (DEC-05) ---
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
