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

const NOW = new Date().toISOString();

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
  sla_warn_at: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
  sla_breach_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  g6_flags: ['B4'],
  created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  updated_at: NOW,
};

const SARAH_ORDER_VSC: Order = { ...SARAH_ORDER_FEELTRU, clinic_id: 'vsc' };

const MOCK_PATIENTS: Patient[] = [SARAH_FEELTRU, SARAH_VSC];
const MOCK_ORDERS: Order[] = [SARAH_ORDER_FEELTRU, SARAH_ORDER_VSC];
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
