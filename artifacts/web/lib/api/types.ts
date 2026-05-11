/**
 * Livera API type definitions — extracted from mock.ts (Mini-wave 6a cleanup).
 * These types ARE the API contract. When Yohan's backend is ready, these stay
 * as the shared contract layer; only implementations move.
 */

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
