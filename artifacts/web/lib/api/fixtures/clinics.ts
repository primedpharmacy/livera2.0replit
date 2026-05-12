/**
 * Livera clinic fixtures — Wave 1 (Chunk 1 Foundations).
 *
 * ClinicConfig schema matches PRODUCT_VISION.md §6.1 exactly.
 *
 * BLD-1.1: coaching_enabled + gender_eligibility in config
 * BLD-1.2: amendment_window = 'pre_dispensed' for both clinics (DEC-01)
 * BLD-1.3: reply_email + monday_incident_board_id + monday_complaints_board_id
 * BLD-1.4: default_slas — all 10 values with documented defaults (§5)
 *
 * DEC-01: Both FeelTru and VSC use amendment_window = 'pre_dispensed'.
 * DEC-13: FeelTru has two Owners — Qadir + Mobeen (see fixtures/users.ts).
 * DEC-16: FeelTru gender_eligibility = 'female_only' (UK Equality Act 2010 Sch 3 Para 27).
 * DEC-34: coaching_enabled is a per-clinic platform feature toggle.
 */

import type { ClinicId, Clinic, ClinicConfig } from '../types';
import { delay, APIError, NOW } from '../constants';

// ---------------------------------------------------------------------------
// Default SLA values (§5) — all 10 per DEC-04, DEC-35
// These are the platform defaults; each clinic can override via Settings.
// ---------------------------------------------------------------------------

const DEFAULT_SLAS: ClinicConfig['default_slas'] = {
  approval_warn_hours: 6,           // Clinical Check SLA warn tint
  approval_breach_hours: 24,        // Clinical Check SLA breach tint
  intervention_resolution_wd: 7,    // Intervention resolution (working days)
  gp_letter_send_hours: 48,         // GP Letter send from prescription approval
  order_expiry_days: 6,             // Order expiry (calendar days from creation)
  complaint_ack_wd: 3,              // Complaint acknowledgement (working days)
  complaint_response_wd: 20,        // Complaint substantive response (working days)
  coach_escalation_response_wh: 24, // Coach Clinical Escalation prescriber response (working hours)
  welcome_call_wd: 5,               // Welcome Call (working days from registration completion)
  initial_coaching_call_days: 7,    // Initial Coaching Call (calendar days from first dispatch)
  coaching_overdue_days: 35,        // Overdue check-in threshold (calendar days since last log)
};

// ---------------------------------------------------------------------------
// Default consent templates (DEC-32) — 9-item seed on clinic creation
// Each clinic can customise; the seed is a template, not a contract.
// ---------------------------------------------------------------------------

const DEFAULT_CONSENTS: ClinicConfig['consents'] = [
  {
    consent_id: 'consent_terms',
    title: 'Terms and conditions',
    body: 'I agree to the terms and conditions of using this service.',
    mandatory: true,
    order: 1,
    version: 1,
    last_updated: '2026-01-01T00:00:00Z',
    last_updated_by: 'user_qadir',
  },
  {
    consent_id: 'consent_privacy',
    title: 'Privacy policy',
    body: 'I consent to my personal data being processed as described in the privacy policy.',
    mandatory: true,
    order: 2,
    version: 1,
    last_updated: '2026-01-01T00:00:00Z',
    last_updated_by: 'user_qadir',
  },
  {
    consent_id: 'consent_health_info',
    title: 'Health information sharing',
    body: 'I consent to sharing my health information with the clinical team for the purposes of treatment.',
    mandatory: true,
    order: 3,
    version: 1,
    last_updated: '2026-01-01T00:00:00Z',
    last_updated_by: 'user_qadir',
  },
  {
    consent_id: 'consent_nhs_number',
    title: 'NHS number use',
    body: 'I consent to my NHS number being used for identification and clinical purposes.',
    mandatory: false,
    order: 4,
    version: 1,
    last_updated: '2026-01-01T00:00:00Z',
    last_updated_by: 'user_qadir',
  },
  {
    consent_id: 'consent_prescriber_review',
    title: 'Prescriber review',
    body: 'I understand that a prescriber will review my questionnaire and may request further information.',
    mandatory: true,
    order: 5,
    version: 1,
    last_updated: '2026-01-01T00:00:00Z',
    last_updated_by: 'user_qadir',
  },
  {
    consent_id: 'consent_se_reporting',
    title: 'Side effect reporting',
    body: 'I agree to report any side effects I experience during treatment.',
    mandatory: true,
    order: 6,
    version: 1,
    last_updated: '2026-01-01T00:00:00Z',
    last_updated_by: 'user_qadir',
  },
  {
    consent_id: 'consent_age',
    title: 'Age confirmation (18+)',
    body: 'I confirm that I am aged 18 or over.',
    mandatory: true,
    order: 7,
    version: 1,
    last_updated: '2026-01-01T00:00:00Z',
    last_updated_by: 'user_qadir',
  },
  {
    consent_id: 'consent_treatment',
    title: 'Consent to treatment and service',
    body: 'I consent to the prescribed treatment and associated clinical service.',
    mandatory: true,
    order: 8,
    version: 1,
    last_updated: '2026-01-01T00:00:00Z',
    last_updated_by: 'user_qadir',
  },
  {
    consent_id: 'consent_gp',
    title: 'Consent to GP communication',
    body: 'I consent to a letter being sent to my GP notifying them of my treatment.',
    mandatory: false,  // DEC-22: consent-driven GP letter workflow
    order: 9,
    version: 1,
    last_updated: '2026-01-01T00:00:00Z',
    last_updated_by: 'user_qadir',
  },
];

// ---------------------------------------------------------------------------
// Incident triage text — NO hardcoded clinical logic in components (§3.2 rule 3)
// All triage copy lives here in config, injected per clinic.
// ---------------------------------------------------------------------------

const INCIDENT_TRIAGE_TEXT: ClinicConfig['incident_triage_text'] = {
  mild: 'Standard review. Document in incident log. No external notification required.',
  moderate: 'Clinical review required. Prescriber to assess. Consider patient follow-up.',
  severe:
    'Severe incident. If patient is currently in distress or harm, advise them to call 999 or attend A&E. ' +
    'Yellow Card submission to MHRA is required for adverse drug reactions. ' +
    'CQC notification may be required (Regulation 18).',
};

// ---------------------------------------------------------------------------
// UK public holidays 2026 (partial — configurable per clinic per DEC-15)
// ---------------------------------------------------------------------------

const UK_HOLIDAYS_2026: ClinicConfig['holiday_calendar'] = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-06', name: 'Easter Monday' },
  { date: '2026-05-04', name: 'Early May Bank Holiday' },
  { date: '2026-05-25', name: 'Spring Bank Holiday' },
  { date: '2026-08-31', name: 'Summer Bank Holiday' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-28', name: 'Boxing Day (substitute)' },
];

// ---------------------------------------------------------------------------
// Clinic fixtures
// ---------------------------------------------------------------------------

const MOCK_CLINICS: Record<ClinicId, Clinic> = {
  // ── VSC (Quanta Healthcare Ltd) ───────────────────────────────────────────
  vsc: {
    id: 'vsc',
    config: {
      // Identity
      clinic_id: 'vsc',
      clinic_name: 'VSC',
      legal_entity_name: 'Quanta Healthcare Ltd',
      cqc_provider_id: null,
      gphc_pharmacy_id: '1039469',

      // Behavioural flags (BLD-1.1)
      coaching_enabled: false,             // DEC-02/34: disabled at V1.1
      gender_eligibility: 'gender_neutral', // DEC-16: VSC is mixed-gender
      amendment_window: 'pre_dispensed',   // DEC-01: locked 10 May 2026

      // Brand (§3.3)
      brand_tokens: {
        primary: '#6366f1',
        primary_dark: '#4338ca',
        accent: '#6366f1',
        gradient: '135deg, #6366f1, #4338ca',
        font_family: 'system-ui, sans-serif',
        logo_url: '/logos/vsc.svg',
      },

      // Comms (BLD-1.3 / BLD-3.6)
      reply_email: 'hello@vsc.health',
      patient_sla_copy: {
        clinical_review_message: 'Clinical review usually takes up to 4 hours',
        delivery_message: 'Delivery within 2 working days',
      },
      clinical_note_min_chars: 40,

      // SLA values (BLD-1.4 — all 10 per §5)
      default_slas: { ...DEFAULT_SLAS },

      // Monday integration (BLD-1.3, DEC-29, DEC-37)
      monday_incident_board_id: '18402056019',   // DEC-29: shared severe SE board
      monday_complaints_board_id: '18409111860',  // DEC-37: VSC complaints board

      // Calendly
      calendly_account_id: null,

      // Consents (DEC-32)
      consents: DEFAULT_CONSENTS,

      // Holiday calendar (DEC-15)
      holiday_calendar: UK_HOLIDAYS_2026,

      // Day-X nudge (DEC-30)
      day_x_nudge: {
        enabled: false,
        trigger_day: 19,
        calendly_link_override: null,
        custom_copy_override: null,
      },

      // Drug watchlist (DEC-39)
      drug_watchlist: ['semaglutide', 'tirzepatide', 'liraglutide'],

      // Consultation types (DEC-40)
      consultation_types: [
        {
          id: 'welcome_call',
          name: 'Welcome Call',
          modality: 'phone',
          provider: 'intercom_phone',
          default_duration_min: 30,
          eligible_roles: ['Admin', 'Owner'],
          dpia_reference: null,
          calendly_event_type_id: null,
        },
      ],

      // Incident triage text
      incident_triage_text: INCIDENT_TRIAGE_TEXT,

      // Intercom
      intercom_workspace_id: 'a86dr8yl',

      // Feature flags
      features: {
        gp_letter_enabled: true,
        pharmacy_comms_enabled: false,
        bmi_ai_validation_enabled: false,
        primed_flag_mirror_enabled: false,
        video_consultations_enabled: false,
        welcome_calls_enabled: true,               // always true per DEC-34
        ai_clinical_note_drafting_enabled: true,
      },

      // Rule-engine stubs — [] until Chunks 13/16a/17 land
      flag_rules: [],
      treatment_gap_rules: [],
      dose_escalation_rules: [],
      primed_flag_rules: [],
      questionnaire_order: [],
      questionnaire_reorder: [],
    },
  },

  // ── FeelTru Ltd ───────────────────────────────────────────────────────────
  feeltru: {
    id: 'feeltru',
    config: {
      // Identity
      clinic_id: 'feeltru',
      clinic_name: 'FeelTru',
      legal_entity_name: 'FeelTru Ltd',
      cqc_provider_id: '1-10590850075',  // CQC Provider ID (PRODUCT_VISION.md §1.2)
      gphc_pharmacy_id: '1039469',       // Primed Pharmacy (shared)

      // Behavioural flags (BLD-1.1)
      coaching_enabled: true,           // DEC-02: FeelTru coaching ENABLED
      gender_eligibility: 'female_only', // DEC-16: UK Equality Act 2010 Sch 3 Para 27
      amendment_window: 'pre_dispensed', // DEC-01: locked 10 May 2026

      // Brand (§3.3 — FeelTru)
      brand_tokens: {
        primary: '#9697E8',
        primary_dark: '#4B5BA3',
        accent: '#F08E5F',
        gradient: '135deg, #9697E8, #C09ED0, #F08E5F',
        font_family: 'Poppins, system-ui, sans-serif',
        logo_url: '/logos/feeltru.svg',
      },

      // Comms (BLD-1.3 / BLD-3.6)
      reply_email: 'hello@feeltru.health',
      patient_sla_copy: {
        clinical_review_message: 'Clinical review usually takes up to 4 hours',
        delivery_message: 'Delivery within 2 working days',
      },
      clinical_note_min_chars: 40,

      // SLA values (BLD-1.4 — all 10 per §5)
      default_slas: { ...DEFAULT_SLAS },

      // Monday integration (BLD-1.3, DEC-29, DEC-37)
      monday_incident_board_id: '18402056019',    // DEC-29: shared severe SE board (cross-workspace anomaly retained)
      monday_complaints_board_id: '18402056040',  // DEC-37: FeelTru complaints board

      // Calendly
      calendly_account_id: 'feeltru-calendly',

      // Consents (DEC-32)
      consents: DEFAULT_CONSENTS,

      // Holiday calendar (DEC-15)
      holiday_calendar: UK_HOLIDAYS_2026,

      // Day-X nudge (DEC-30)
      day_x_nudge: {
        enabled: true,
        trigger_day: 19,
        calendly_link_override: 'https://calendly.com/feeltru/coaching',
        custom_copy_override: 'Time for your check-in! Book your next coaching session.',
      },

      // Drug watchlist (DEC-39)
      drug_watchlist: ['semaglutide', 'tirzepatide', 'liraglutide'],

      // Consultation types (DEC-40)
      consultation_types: [
        {
          id: 'welcome_call',
          name: 'Welcome Call',
          modality: 'phone',
          provider: 'intercom_phone',
          default_duration_min: 30,
          eligible_roles: ['Admin', 'Owner'],
          dpia_reference: null,
          calendly_event_type_id: null,
        },
        {
          id: 'coaching',
          name: 'Coaching Session',
          modality: 'video',
          provider: 'calendly+google_meet',
          default_duration_min: 30,
          eligible_roles: ['Coach'],
          dpia_reference: 'DPIA-2026-001',
          calendly_event_type_id: 'evt_coaching',
        },
      ],

      // Incident triage text
      incident_triage_text: INCIDENT_TRIAGE_TEXT,

      // Intercom
      intercom_workspace_id: 'b91ks9zm',

      // Feature flags
      features: {
        gp_letter_enabled: true,
        pharmacy_comms_enabled: false,
        bmi_ai_validation_enabled: false,
        primed_flag_mirror_enabled: false,
        video_consultations_enabled: true,
        welcome_calls_enabled: true,               // always true per DEC-34
        ai_clinical_note_drafting_enabled: true,
      },

      // Rule-engine stubs — [] until Chunks 13/16a/17 land
      flag_rules: [],
      treatment_gap_rules: [],
      dose_escalation_rules: [],
      primed_flag_rules: [],
      questionnaire_order: [],
      questionnaire_reorder: [],
    },
  },
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function getClinic(id: ClinicId): Promise<Clinic> {
  await delay();
  const clinic = MOCK_CLINICS[id];
  if (!clinic) throw new APIError('NOT_FOUND', `Clinic '${id}' not found`);
  return clinic;
}

export async function listClinics(): Promise<Clinic[]> {
  await delay();
  return Object.values(MOCK_CLINICS);
}

// Synchronous clinic lookup — for hooks (hooks cannot be async)
export function getClinicSync(id: ClinicId): Clinic {
  return MOCK_CLINICS[id] ?? MOCK_CLINICS.feeltru;
}

export async function updateClinicSlaThresholds(
  clinic_id: ClinicId,
  updates: Partial<ClinicConfig['default_slas']> & { clinical_note_min_chars?: number },
  actor_id: string,
): Promise<ClinicConfig> {
  await delay();
  const clinic = MOCK_CLINICS[clinic_id];
  if (!clinic) throw new APIError('NOT_FOUND', `Clinic '${clinic_id}' not found`);

  // Layer 2 — server gate: every value must be a positive number
  for (const [field, value] of Object.entries(updates)) {
    if (typeof value !== 'number' || value <= 0) {
      throw new APIError('SAFETY_VIOLATION', `Invalid value for ${field}: must be a positive number`);
    }
  }

  // Apply updates + [AUDIT] per changed field
  const { clinical_note_min_chars, ...slaUpdates } = updates;

  for (const [field, newValue] of Object.entries(slaUpdates)) {
    const key = field as keyof ClinicConfig['default_slas'];
    const oldValue = clinic.config.default_slas[key];
    (clinic.config.default_slas as Record<string, number>)[field] = newValue as number;
    console.log('[AUDIT]', {
      event_type: 'sla_threshold_updated',
      outcome:    'success',
      actor_id,
      clinic_id,
      field_name: field,
      old_value:  oldValue,
      new_value:  newValue,
      timestamp:  NOW,
    });
  }

  if (clinical_note_min_chars !== undefined) {
    const oldValue = clinic.config.clinical_note_min_chars;
    clinic.config.clinical_note_min_chars = clinical_note_min_chars;
    console.log('[AUDIT]', {
      event_type: 'sla_threshold_updated',
      outcome:    'success',
      actor_id,
      clinic_id,
      field_name: 'clinical_note_min_chars',
      old_value:  oldValue,
      new_value:  clinical_note_min_chars,
      timestamp:  NOW,
    });
  }

  return clinic.config;
}
