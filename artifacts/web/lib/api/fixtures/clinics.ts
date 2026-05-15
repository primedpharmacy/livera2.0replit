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
 * DEC-01: FeelTru uses amendment_window = 'pre_dispensed'. VSC corrected to 'pre_approval' in V1.1.
 * DEC-13: FeelTru has two Owners — Qadir + Mobeen (see fixtures/users.ts).
 * DEC-16: FeelTru gender_eligibility = 'female_only' (UK Equality Act 2010 Sch 3 Para 27).
 * DEC-34: coaching_enabled is a per-clinic platform feature toggle.
 */

import type { ClinicId, Clinic, ClinicConfig } from '../types';
import { delay, APIError, NOW, CURRENT_USER } from '../constants';
import { can } from '@/lib/permissions';

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
      amendment_window: 'pre_approval',    // V1.1 correction — VSC moves to pre_approval

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

      // Rule-engine (BLD-14.6 seeds)
      flag_rules: [],
      treatment_gap_rules: [
        {
          id: 'tgr_vsc_1',
          label: '8+ week gap — require consultation',
          gap_days_min: 56,
          gap_days_max: null,
          action: 'require_consult' as const,
          action_copy: 'Patient has not reordered for over 8 weeks. A consultation is required before approving this reorder to assess current weight, compliance, and clinical appropriateness.',
          enabled: true,
        },
        {
          id: 'tgr_vsc_2',
          label: '4–8 week gap — warn prescriber',
          gap_days_min: 28,
          gap_days_max: 55,
          action: 'warn' as const,
          action_copy: 'Patient has a gap of 4–8 weeks since their last order. Verify current weight, compliance, and any relevant lifestyle changes before approving.',
          enabled: true,
        },
      ],
      dose_escalation_rules: [],
      primed_flag_rules: [],
      questionnaire_order: [
        { id: 'vsc_oq_1', label: 'What is your current weight? (kg)',             type: 'number',  required: true,  order: 1, placeholder: 'Enter your current weight in kg' },
        { id: 'vsc_oq_2', label: 'What is your goal weight? (kg)',                type: 'number',  required: true,  order: 2, placeholder: 'Enter your target weight in kg' },
        { id: 'vsc_oq_3', label: 'Do you have any drug allergies?',               type: 'yes_no',  required: true,  order: 3 },
        { id: 'vsc_oq_4', label: 'Are you taking any other medications?',         type: 'yes_no',  required: true,  order: 4 },
        { id: 'vsc_oq_5', label: 'Which of the following conditions do you have?', type: 'choice', required: true,  order: 5, options: ['Type 2 diabetes', 'Hypertension', 'Thyroid disorder', 'Heart disease', 'None of the above'] },
        { id: 'vsc_oq_6', label: 'Have you tried weight-loss medication before?', type: 'yes_no',  required: true,  order: 6 },
        { id: 'vsc_oq_7', label: 'Anything else the prescriber should know?',     type: 'text',    required: false, order: 7, placeholder: 'Optional — relevant medical history, previous treatments, etc.' },
      ],
      questionnaire_reorder: [
        { id: 'vsc_rq_1', label: 'What is your current weight? (kg)',                type: 'number', required: true,  order: 1, placeholder: 'Enter your weight in kg' },
        { id: 'vsc_rq_2', label: 'Have you experienced any side effects?',           type: 'yes_no', required: true,  order: 2 },
        { id: 'vsc_rq_3', label: 'If yes, please describe the side effects',         type: 'text',   required: false, order: 3, placeholder: 'e.g. nausea, injection site reaction, fatigue…' },
        { id: 'vsc_rq_4', label: 'Are you still taking the same other medications?', type: 'yes_no', required: true,  order: 4 },
        { id: 'vsc_rq_5', label: 'Any new medical diagnoses since last order?',      type: 'yes_no', required: true,  order: 5 },
        { id: 'vsc_rq_6', label: 'How would you rate your progress? (1 = poor, 10 = excellent)', type: 'scale', required: true, order: 6, scale_min: 1, scale_max: 10 },
      ],
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
        pharmacy_comms_enabled: true,   // BLD-16.1 — enabled for FeelTru
        bmi_ai_validation_enabled: true, // BLD-16.2 — enabled for FeelTru
        primed_flag_mirror_enabled: false,
        video_consultations_enabled: true,
        welcome_calls_enabled: true,               // always true per DEC-34
        ai_clinical_note_drafting_enabled: true,
      },

      // Rule-engine (BLD-14.6 seeds)
      flag_rules: [],
      treatment_gap_rules: [
        {
          id: 'tgr_ft_1',
          label: '8+ week gap — require consultation',
          gap_days_min: 56,
          gap_days_max: null,
          action: 'require_consult' as const,
          action_copy: 'Patient has not reordered for over 8 weeks. A consultation is required before approving this reorder to assess current weight, compliance, and clinical appropriateness.',
          enabled: true,
        },
        {
          id: 'tgr_ft_2',
          label: '4–8 week gap — warn prescriber',
          gap_days_min: 28,
          gap_days_max: 55,
          action: 'warn' as const,
          action_copy: 'Patient has a gap of 4–8 weeks since their last order. Verify current weight, compliance, and any relevant lifestyle changes before approving.',
          enabled: true,
        },
      ],
      dose_escalation_rules: [],
      primed_flag_rules: [],
      questionnaire_order: [
        { id: 'ft_oq_1', label: 'What is your current weight? (kg)',               type: 'number',  required: true,  order: 1, placeholder: 'Enter your current weight in kg' },
        { id: 'ft_oq_2', label: 'What is your goal weight? (kg)',                  type: 'number',  required: true,  order: 2, placeholder: 'Enter your target weight in kg' },
        { id: 'ft_oq_3', label: 'Do you have any drug allergies?',                 type: 'yes_no',  required: true,  order: 3 },
        { id: 'ft_oq_4', label: 'Are you currently taking any other medications?', type: 'yes_no',  required: true,  order: 4 },
        { id: 'ft_oq_5', label: 'Which conditions apply to you?',                  type: 'choice',  required: true,  order: 5, options: ['PCOS', 'Insulin resistance', 'Type 2 diabetes', 'Hypertension', 'Thyroid disorder', 'None of the above'] },
        { id: 'ft_oq_6', label: 'Are you pregnant or breastfeeding?',              type: 'yes_no',  required: true,  order: 6, help_text: 'GLP-1 medications are contraindicated during pregnancy and breastfeeding.' },
        { id: 'ft_oq_7', label: 'Have you tried weight-loss medication before?',   type: 'yes_no',  required: true,  order: 7 },
        { id: 'ft_oq_8', label: 'Anything else the prescriber should know?',       type: 'text',    required: false, order: 8, placeholder: 'Optional — relevant history, previous treatments, GP details…' },
      ],
      questionnaire_reorder: [
        { id: 'ft_rq_1', label: 'What is your current weight? (kg)',                   type: 'number', required: true,  order: 1, placeholder: 'Enter your weight in kg' },
        { id: 'ft_rq_2', label: 'Have you experienced any side effects?',              type: 'yes_no', required: true,  order: 2 },
        { id: 'ft_rq_3', label: 'If yes, please describe the side effects',            type: 'text',   required: false, order: 3, placeholder: 'e.g. nausea, hair thinning, injection site reaction…' },
        { id: 'ft_rq_4', label: 'Are you pregnant or breastfeeding?',                 type: 'yes_no', required: true,  order: 4, help_text: 'This must be answered at every reorder — clinical requirement.' },
        { id: 'ft_rq_5', label: 'Any changes to your other medications since last order?', type: 'yes_no', required: true, order: 5 },
        { id: 'ft_rq_6', label: 'Any new medical diagnoses since last order?',         type: 'yes_no', required: true,  order: 6 },
        { id: 'ft_rq_7', label: 'How would you rate your progress? (1 = poor, 10 = excellent)', type: 'scale', required: true, order: 7, scale_min: 1, scale_max: 10 },
      ],
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

// ---------------------------------------------------------------------------
// updateClinicHolidays — BLD-4.6.7 (Wave 4)
// Adds or removes a holiday entry from a clinic's holiday_calendar.
// Changes take effect immediately for addWorkingHours + dispatchCalculator.
// In-memory only — backend persistence is post-launch.
// ---------------------------------------------------------------------------

export async function updateClinicHolidays(
  clinic_id: ClinicId,
  action: 'add' | 'remove',
  entry: { date: string; name: string },
  actor_id: string,
): Promise<ClinicConfig['holiday_calendar']> {
  await delay();
  const clinic = MOCK_CLINICS[clinic_id];
  if (!clinic) throw new APIError('NOT_FOUND', `Clinic '${clinic_id}' not found`);

  // Layer 2 — Fix Cycle 1 BLOCKER 4: permission gate
  if (!can(CURRENT_USER, 'write', 'holiday_calendar')) {
    console.log('[AUDIT]', {
      event_type: 'clinic_holiday_calendar_update_blocked',
      outcome:    'PERMISSION_DENIED',
      actor_id:   CURRENT_USER.id,
      clinic_id,
      timestamp:  NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Only Admins and Owners may update the holiday calendar');
  }

  // Layer 2 — validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
    throw new APIError('SAFETY_VIOLATION', `Invalid holiday date format: '${entry.date}' — expected YYYY-MM-DD`);
  }
  if (!entry.name.trim()) {
    throw new APIError('SAFETY_VIOLATION', 'Holiday name cannot be empty');
  }

  if (action === 'add') {
    const exists = clinic.config.holiday_calendar.some((h) => h.date === entry.date);
    if (exists) {
      throw new APIError('SAFETY_VIOLATION', `A holiday already exists on ${entry.date}`);
    }
    clinic.config.holiday_calendar = [
      ...clinic.config.holiday_calendar,
      { date: entry.date, name: entry.name.trim() },
    ].sort((a, b) => a.date.localeCompare(b.date));
  } else {
    clinic.config.holiday_calendar = clinic.config.holiday_calendar.filter(
      (h) => h.date !== entry.date,
    );
  }

  console.log('[AUDIT]', {
    event_type: 'clinic_holiday_calendar_updated',
    outcome:    'success',
    actor_id,
    clinic_id,
    action,
    entry,
    timestamp:  NOW,
  });

  return clinic.config.holiday_calendar;
}
