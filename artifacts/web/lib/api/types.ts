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
  | 'System'       // BLD-8.3 (Wave 6) — webhook-internal actor; no UI access
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
  // Task-38 — Refund authority: admins with this flag can action `type: 'refund'`
  // amendments via the refund-specific panel on AmendmentDetailClient.
  can_refund?: boolean;
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
  // BLD-3.6 — object per DEC-35 (replaces flat string from Wave 1)
  patient_sla_copy: {
    clinical_review_message: string;  // "Clinical review usually takes up to 4 hours"
    delivery_message: string;         // "Delivery within 2 working days"
  };

  // BLD-4.1 — minimum chars for a clinical note body (configurable per clinic)
  clinical_note_min_chars: number;  // default 40

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
    coaching_overdue_days: number;         // default 35 (calendar days since last log)
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

  // Rule-engine stubs — concrete types added in Chunks 13/16a/17
  flag_rules: unknown[];                   // G6 flag evaluation rules (Chunk 16a)
  treatment_gap_rules: TreatmentGapRule[]; // Treatment gap rules (BLD-14.6)
  dose_escalation_rules: unknown[];        // Dose escalation protocol (Chunk 13)
  primed_flag_rules: unknown[];            // Primed flag mirror rules (Chunk 17)
  questionnaire_order: QuestionItem[];     // New-patient questionnaire config (BLD-13.4)
  questionnaire_reorder: QuestionItem[];   // Reorder questionnaire config (BLD-13.4)
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
  // Task-38 — Refund authority. Mirrors ClinicTeamMember.can_refund and is
  // consumed by the AmendmentDetailClient refund panel gate.
  can_refund?: boolean;
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
  coach_id: string | null;  // FeelTru-only — assigned coach (DEC-05)
  // BLD-8.3 (Wave 6) — Intercom user ID for webhook patient resolution.
  // Set to Intercom's external_id value when the patient account is created in Intercom.
  // Used by app/api/webhooks/intercom/route.ts to look up patient from webhook payload.
  // Optional — null for patients not yet linked to an Intercom contact.
  intercom_user_id?: string | null;
  created_at: string;
  updated_at: string;
};

// --- Order ---
export type OrderStatus =
  | 'received'
  | 'clinical_check'
  | 'approved'
  | 'in_dispensing'   // BLD-5.3 — between approved and dispatched; amendment window still open
  | 'dispatched'
  | 'delivered'
  | 'on_hold'         // queried / intervention pending
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
  contextual_flags?: string[];            // Behavioural flags for display in queue (Dose increase, Safeguarding, etc.)
  intervention_raised_at: string | null;  // BLD-4.6.1 — set when decision='queried'
  expired_at: string | null;              // BLD-4.6.3 — set by detectOrderExpiry

  // BLD-14.3 — NICE CG189 checklist (toggled by prescriber during clinical_check)
  nice_checklist?: Array<{
    id: string;
    label: string;
    checked: boolean;
    checked_by?: string;
    checked_at?: string;
  }> | null;

  // BLD-14.4 — Dose escalation gate (computed from questionnaire + treatment history)
  dose_escalation_gate?: {
    is_dose_escalation: boolean;
    from_dose: string;
    to_dose: string;
    weeks_at_current_dose: number;
    weeks_required: number;
    weight_loss_pct: number;
    weight_loss_kg: number;
    prior_evidence_uploaded: boolean;
    evidence_label?: string;
    eligible: boolean;
  } | null;

  // BLD-14.5 — Weight trajectory (last ≤5 readings snapshotted at order submission)
  weight_history?: Array<{
    recorded_at: string;  // ISO
    weight_kg: number;
    bmi: number;
  }> | null;

  royal_mail_tracking_id?: string | null;   // BLD-11.1 — RM1234567890GB format
  dispatched_at?: string | null;            // BLD-11.2 — ISO timestamp; set when status → dispatched

  // Task-38 — Post-approval cancellation & refund flow
  cancelled_at?: string | null;             // ISO timestamp when status → cancelled
  cancellation_reason?: string | null;      // Free-text reason captured in the confirm modal
  refund_amendment_id?: string | null;      // Linked Amendment.id when a refund was required

  // Task-61 — Patient-uploaded prescription for GLP-1 higher-dose path
  // Captured from the intake success screen when the patient answered "yes" to
  // both ft_oq_9 (currently on GLP-1) and ft_oq_10 (requesting a higher start dose).
  px_upload?: {
    filename: string;
    size: number;          // bytes
    content_type: string;  // image/* or application/pdf
    uploaded_at: string;   // ISO timestamp
    data_url?: string;     // base64 data URL for preview (mock storage only; omitted for >2MB files)
    source?: 'success_screen' | 'email_link'; // Task-80 — provenance for the audit log
  } | null;

  // Task-80 — Tokenised email-link upload (Px upload "complete later")
  // Generated at intake submission when the order requires a Px upload.
  // The patient can use the link in their email to open a minimal page that
  // POSTs to the same px-upload endpoint via the token route. Tokens are
  // single-use and expire after `expires_at`.
  px_upload_link?: {
    token: string;
    expires_at: string;       // ISO
    sent_at: string | null;   // ISO — when the email was successfully queued
    consumed_at: string | null; // ISO — when an upload arrived via this token
    email_message_id: string | null;
    to_email: string;
  } | null;

  created_at: string;
  updated_at: string;
};

// --- Courier Event (BLD-11.1 — Royal Mail webhook events) ---
export type CourierEventType =
  | 'accepted'          // RM accepted parcel from pharmacy
  | 'collected'         // RM driver collected from depot
  | 'in_transit'        // en route to delivery office
  | 'out_for_delivery'  // on vehicle today
  | 'delivered'         // successfully delivered
  | 'exception';        // failed delivery / problem

export type CourierEvent = {
  id: string;
  clinic_id: ClinicId;
  order_id: string;
  event_type: CourierEventType;
  occurred_at: string;            // ISO 8601
  location: string | null;        // e.g. "Manchester Delivery Office"
  description: string;
  is_exception: boolean;
  exception_code: string | null;  // 'NOT_HOME' | 'ADDRESS_NOT_FOUND' | 'REFUSED' | 'DAMAGED'
  postmark_triggered: boolean;    // BLD-11.3 — Postmark template fired for this event
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
  name: string;          // Board display name (PV §7.3)
  workspace_id: string;  // Monday workspace ID (PV §7.3)
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

// BLD-8.1 (Wave 6) — DEC-10: intercom_tag → Incident workflow
export type IncidentOrigin =
  | 'intercom_tag'
  | 'manual'
  | 'coach_escalation'
  | 'system_severe_se'; // DEC-29: auto-write to board 18402056019

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
  yellow_card_decision: 'filed' | 'not_applicable' | null; // BLD-YC-01
  cqc_notification_required: boolean;
  cqc_notified_at: string | null;
  escalated_to_user_id: string | null;
  resolution_notes: string | null;
  sync_status: 'in_sync' | 'out_of_sync' | 'error';
  created_at: string;
  // BLD-8.1 additions (Wave 6 — DEC-10)
  intercom_thread_url: string | null;
  incident_origin: IncidentOrigin;
  // Creator attribution
  created_by_user_id: string | null;
};

export type IncidentComment = {
  id: string;
  incident_id: string;
  user_id: string;
  user_name: string;
  user_initials: string;
  body: string;
  created_at: string;
};

// --- Complaint (DEC-37 — Monday source of truth; Livera mirrors) ---
// BLD-9.1 (Wave 6) — 21-field schema per Decision A/B (locked)
// FeelTru-specific Monday fields (cqc_saf_quality_statements, you_said_we_did_action)
// stay in Monday only — not mirrored to Livera per DEC-37.
export type ComplaintSeverity = 'informal' | 'formal' | 'serious'; // per PV §8 Chunk 9 (Decision C)
export type ComplaintStatus = 'received' | 'acknowledged' | 'investigating' | 'resolved' | 'closed';

export type Complaint = {
  // 1. Identity
  id: string;                              // CMP-XXXX format
  clinic_id: ClinicId;
  // 2. Monday source-of-truth pointer (DEC-37)
  monday_board_id: string;                 // routing key for all mondayWrite calls
  monday_item_id: string | null;           // null until first Monday write (BLD-9.4)
  // 3. Complainant
  patient_id: string | null;              // null for non-patient complainants
  complainant_name: string;
  complainant_email: string | null;
  // 4. Classification
  status: ComplaintStatus;                 // 5 stages per PV §8
  // TODO V1.2: Consider locking category to a per-clinic enum if
  // category vocabulary stabilizes across complaint usage.
  category: string;                        // free-form: 'clinical' | 'service' | 'billing' | 'communication' | 'other'
  severity: ComplaintSeverity;             // 'informal' | 'formal' | 'serious'
  // 5. Content
  body: string;                            // complaint description
  // 6. SLA tracking (due dates derived at render: received_at + clinic_config.default_slas)
  received_at: string;                     // ISO 8601; SLA clock starts here
  acknowledged_at: string | null;         // actual send date; null = not yet sent
  resolved_at: string | null;             // actual resolution date; null = not yet resolved
  // 7. Resolution (Monday board fields mirrored)
  resolution: string | null;              // Lesson Learned per PV §8
  regulator_escalation: 'cqc' | 'gphc' | null; // CQC/GPhC per PV §8
  policy_register_link: string | null;    // Policy Register linkage per PV §8
  // 8. Audit
  created_at: string;
  created_by_user_id: string;
  updated_at: string | null;
  updated_by_user_id: string | null;
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
  body: string;                           // rendered email body (editable in compose modal)
  lifecycle_status: GPCommunicationLifecycle;
  status: GPLetterStatus;
  patient_consent_verified: boolean;
  sent_at: string | null;
  sent_to_email: string | null;
  created_by_user_id: string;
  created_at: string;
  // BLD-7.7 — cancel workflow (terminal; server gate blocks reversion)
  cancel_reason: string | null;
  // BLD-7.4 — send audit trail
  email_body_sent: string | null;         // actual rendered body at time of send (not template)
  pdf_filename: string | null;            // e.g. gp_letter_{patient_id}_{timestamp}.pdf
  postmark_message_id: string | null;     // null when Postmark stub
  sent_by_user_id: string | null;
  byte_size: number | null;               // PDF byte size in bytes
  // CLARIFY-1 (Wave 5) — auto-trigger traceability
  anchor_order_id: string | null;         // order that triggered this letter (null = manual compose)
  auto_triggered: boolean;               // true = created by decideOrder on approval
};

export type GpLetterTemplateCategory =
  | 'initial_treatment'
  | 'dose_change'
  | 'safeguarding'
  | 'progress_update'
  | 'adverse_event';

export type GPLetterTemplate = {
  id: string;
  clinic_id: ClinicId | 'shared';     // 'shared' = available to all clinics
  name: string;
  description: string;
  category: GpLetterTemplateCategory;
  email_body_template: string;         // brief intro + reference to attached PDF (BLD-7.1)
  pdf_letter_template: string;         // full clinical content for server-side PDF (BLD-7.2)
};

// --- Admin Note (BLD-4.5.1 — Wave 5) ---
// Distinct from ClinicalNote: no min-char gate, no AI drafting, no order approval gate.
// Authorable by Admin and Owner only. Coach has NO ACCESS.
// 3-layer safety chain on all mutations (Layer 1 UI gate in BLD-4.5.2 FAB modal).
export type AdminNoteTag = 'handoff' | 'follow_up' | 'context' | 'general';

export type AdminNote = {
  id: string;
  clinic_id: string;
  patient_id: string;
  body: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string | null;
  updated_by_user_id: string | null;
  tag: AdminNoteTag;
};

// --- Coaching log (DEC-05 — BLD-2.4 locked schema, 16+1 fields) ---
export type CoachingLog = {
  id: string;
  patient_id: string;
  coach_id: string;
  clinic_id: ClinicId;
  entry_type: 'initial_call' | 'check_in' | 'escalation' | 'note';
  entry_date: string;             // ISO — when session happened
  scheduled_date: string | null; // ISO — when planned (null = ad-hoc note)
  duration_minutes: number | null;
  modality: 'phone' | 'video' | 'chat' | null;
  summary: string;
  next_action: string | null;
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled';
  clinical_escalation_flag_id: string | null;
  consultation_id: string | null; // links to Consultation if booked via calendar
  created_at: string;
  updated_at: string;
  // 17th field — free-form observations; NOT aggregated into any KPI (DEC-27)
  structured_observations?: Record<string, unknown> | null;
};

// --- Calendly booking mirror (DEC-40 — BLD-CALENDLY-MIRROR-01) ---
// Mirrored from Calendly via webhook events:
//   invitee.created · invitee.canceled · invitee_no_show.created
export type CalendlyBooking = {
  id: string;                        // Livera internal ID
  patient_id: string;
  clinic_id: ClinicId;
  calendly_event_id: string;         // evt_xxxxxxxx
  event_type: string;                // e.g. "Coaching session · 30-min check-in"
  scheduled_at: string;              // ISO — start datetime
  end_at: string;                    // ISO — end datetime
  coach_name: string;
  booking_method: 'patient_self_booked' | 'coach_booked' | 'admin_booked';
  booked_at: string;                 // ISO — when booking was created in Calendly
  join_url: string | null;           // video meeting link, if applicable
  status: 'scheduled' | 'cancelled' | 'no_show';
};

// --- Clinical escalation flag (DEC-05 — BLD-2.7) ---
export type ClinicalEscalationFlag = {
  id: string;
  patient_id: string;
  clinic_id: ClinicId;
  raised_by_coach_id: string;
  raised_at: string;              // ISO
  coaching_log_id: string;        // must reference a log with entry_type 'escalation'
  severity: 'low' | 'medium' | 'high';
  description: string;
  status: 'open' | 'acknowledged' | 'resolved';
  acknowledged_by_user_id: string | null;
  acknowledged_at: string | null;
  resolved_by_user_id: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  sla_deadline: string;           // raised_at + 24 working hours via addWorkingHours
};

// --- ClinicalNote (BLD-4.1 — 20 fields) ----
// All clinical mutations are protected by the 3-layer safety chain:
//   Layer 1: UI gate (role + min-chars)
//   Layer 2: APIError('SAFETY_VIOLATION') server gate
//   Layer 3: [AUDIT] console entry on every mutation
export type ClinicalNote = {
  id: string;                          // NOTE-XXXXX
  patient_id: string;
  order_id: string | null;             // null for standalone notes
  clinic_id: ClinicId;
  author_user_id: string;
  author_role: 'Prescriber' | 'Admin';
  body: string;
  created_at: string;
  updated_at: string;
  edit_history: Array<{
    edited_at: string;
    edited_by: string;
    previous_body: string;
  }>;
  approval_gate_for_order_id: string | null;  // BLD-4.4 — must match order.id to gate approve
  ai_drafted: boolean;                         // BLD-6.5 — true if AI produced initial draft
  ai_draft_accepted_at: string | null;         // when prescriber opened the AI draft
  ai_draft_edited_by: string | null;           // prescriber who edited
  ai_prompt_version_id: string | null;         // AI_CLINICAL_NOTE_PROMPT_VERSION_ID
  // BLD-6.1 — AI audit trail (DEC-07)
  ai_draft_original: string | null;            // what the model first produced
  ai_draft_edits: Array<{                      // diff log of prescriber edits (timestamped)
    edited_at: string;
    prev_body: string;
    new_body: string;
  }>;
  final_note: string | null;                   // what was signed off and saved
  tags: string[];                              // e.g. ['clinical_check', 'follow_up']
  visibility: 'clinical_team' | 'patient_record';
};

// --- Pharmacy Comm Thread (DEC-23, BLD-5.3) ---
// Order-anchored OR patient-anchored. Bidirectional with Primed (DEC-19 assumed APIs).
export type PharmacyCommAnchorType = 'order' | 'patient';

export type PharmacyCommMessage = {
  id: string;
  thread_id: string;
  direction: 'outbound' | 'inbound';    // outbound = clinic→Primed; inbound = Primed→clinic
  body: string;
  sent_by_user_id: string | null;       // null for inbound from Primed
  sent_at: string;                      // ISO
  attachments: string[];                // file URLs
};

export type PharmacyCommThread = {
  id: string;
  clinic_id: ClinicId;
  anchor_type: PharmacyCommAnchorType;
  anchor_id: string;                    // order_id or patient_id
  topic: string;                        // e.g. 'patient_address_change', 'amendment'
  priority: 'routine' | 'urgent';
  status: 'open' | 'awaiting_response' | 'resolved';
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  messages: PharmacyCommMessage[];
  amendment_id: string | null;          // linked Amendment if thread = amendment comms (DEC-28)
};

// --- WelcomeCall (BLD-13.3) ---

export type WelcomeCallStatus = 'awaiting' | 'attempted' | 'completed' | 'unreachable';
export type WelcomeCallAttemptType = 'success' | 'no_answer' | 'voicemail';

export type WelcomeCallAttempt = {
  id: string;
  type: WelcomeCallAttemptType;
  timestamp: string;            // ISO
  by_user_id: string;
  duration_display: string;     // e.g. "8 min", "0:32"
  channel: string;              // e.g. "Intercom telephone"
  body: string;                 // plain text outcome line
  notes?: string;               // clinician's own notes / quote
};

export type WelcomeCallOutcome = {
  outcome_summary: string;
  patient_receptive?: boolean;
  comfortable_with_app?: boolean;
  side_effects_understood?: boolean;
  follow_up_needed?: boolean;
  follow_up_note?: string;
  flag_raised_text?: string;
};

export type WelcomeCallFlag = {
  flag_id: string;
  flag_name: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  raised_by_user_id: string;
};

export type WelcomeCall = {
  id: string;                   // WC-XXXX
  patient_id: string;
  order_id: string;
  clinic_id: ClinicId;
  status: WelcomeCallStatus;
  owner_user_id: string;
  trigger_description: string;
  triggered_at: string;         // ISO — when the dispatch fired
  attempts: WelcomeCallAttempt[];
  outcome?: WelcomeCallOutcome;
  flag_raised?: WelcomeCallFlag;
  created_at: string;           // ISO
  updated_at: string;           // ISO
};

// --- Task (BLD-13.2) ---

export type TaskStatus = 'todo' | 'progress' | 'done' | 'blocked';
export type TaskPriority = 'high' | 'med' | 'low';
export type TaskLinkedType = 'Patient' | 'Order' | 'Incident' | 'Complaint';

export type TaskLinkedRecord = {
  type: TaskLinkedType;
  ref: string;
  label: string;        // human-readable: e.g. "ORD-01287 · Sarah Chen · 0.25mg semaglutide"
  meta?: string;        // e.g. "Status: In Clinical Check · Submitted 01 May 2026"
};

export type TaskSubtask = {
  id: string;
  title: string;
  done: boolean;
  due_label?: string;   // display string e.g. "Today", "02 May"
};

export type TaskActivityKind =
  | 'created'
  | 'status_change'
  | 'assigned'
  | 'comment'
  | 'note'
  | 'subtask_done'
  | 'linked';

export type TaskActivity = {
  id: string;
  kind: TaskActivityKind;
  actor_user_id: string;
  timestamp: string;           // ISO
  content?: string;            // for comment / note
  from_status?: TaskStatus;
  to_status?: TaskStatus;
  subtask_title?: string;
  linked_ref?: string;
  assigned_to_user_id?: string;
};

export type Task = {
  id: string;                  // TSK-XXXX
  title: string;
  description: string;
  owner_user_id: string;
  reporter_user_id: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string;            // ISO date e.g. '2026-05-11'
  clinic_id: ClinicId;
  linked?: TaskLinkedRecord;
  subtasks: TaskSubtask[];
  activity: TaskActivity[];
  created_at: string;          // ISO
  updated_at: string;          // ISO
};

// --- DiscontinuationProtocol (BLD-13.5) ---
// Created when a patient's treatment is discontinued for any reason.
// Triggers GP notification (GP letter) + follow-up SLA.
export type DiscontinuationReason =
  | 'patient_request'
  | 'clinical_decision'
  | 'non_compliance'
  | 'adverse_event'
  | 'lost_to_follow_up';

export type DiscontinuationStatus =
  | 'initiated'
  | 'gp_notified'
  | 'follow_up_pending'
  | 'closed';

export type DiscontinuationProtocol = {
  id: string;                        // DISC-XXXXX
  clinic_id: ClinicId;
  patient_id: string;
  order_id: string | null;           // linked order if applicable
  reason: DiscontinuationReason;
  reason_detail: string;
  created_at: string;                // ISO
  created_by: string;                // user_id
  status: DiscontinuationStatus;
  gp_notified_at: string | null;     // ISO — when GP letter was sent
  follow_up_call_at: string | null;  // ISO — when follow-up call was completed
  sla_follow_up_days: number;        // from clinic config, default 7
  closed_at: string | null;
  notes: string;
};

// --- QuestionItem (BLD-13.4) ---
// Configurable questionnaire question — used in ClinicConfig.questionnaire_order
// and questionnaire_reorder. The builder in Settings → Questionnaire edits these.
export type QuestionType = 'text' | 'yes_no' | 'scale' | 'number' | 'choice';

export type QuestionItem = {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  order: number;
  placeholder?: string;
  help_text?: string;
  options?: string[];      // for type = 'choice'
  scale_min?: number;      // for type = 'scale'
  scale_max?: number;      // for type = 'scale'
  safety_flag?: boolean;   // BLD-13.4 — if true, a yes_no "yes" answer triggers a clinical "Review needed" highlight on the order questionnaire card. Non-safety questions stay neutral regardless of answer.
};

// --- TreatmentGapRule (BLD-14.6) ---
// Configurable rules that fire when a patient's reorder gap exceeds thresholds.
// Stored in ClinicConfig.treatment_gap_rules[].
export type TreatmentGapAction = 'warn' | 'block_reorder' | 'require_consult';

export type TreatmentGapRule = {
  id: string;
  label: string;
  gap_days_min: number;          // minimum gap since last dispensed order (calendar days)
  gap_days_max: number | null;   // null = no upper bound
  action: TreatmentGapAction;
  action_copy: string;           // message shown to clinician when rule fires
  enabled: boolean;
};

// --- SlaBreach (BLD-3.2) ---
// Written to Monday.com via lib/integrations/monday.ts writeSlaBreach (BLD-3.5).
export type SlaBreachEntityType = 'order' | 'coaching_escalation' | 'gp_letter';

export type SlaBreach = {
  id: string;                          // BREACH-XXXXX
  clinic_id: ClinicId;
  entity_type: SlaBreachEntityType;
  entity_id: string;                   // e.g. ORD-XXXXX
  sla_type: string;                    // key from default_slas e.g. 'approval_breach_hours'
  breach_detected_at: string;          // ISO
  acknowledged_at: string | null;
  acknowledged_by_user_id: string | null;
  notes: string | null;
  monday_item_id: string | null;       // populated after writeSlaBreach succeeds
};
