/**
 * Pure order fixture data — client-safe.
 *
 * Like patients.data.ts: free of audit / database imports so client components
 * (shell FAB speed-dials) can read MOCK_ORDERS without bundling `@workspace/db`
 * → `pg` into the browser.
 *
 * Mutating server functions live in `./orders.ts`. The audit / db spine
 * (`lib/api/audit.ts`) reaches `@workspace/db` only via a webpack-ignored
 * dynamic import, so client components that only need to read fixture data
 * should import from this module to stay off that path entirely.
 */

import type { ClinicId, Order } from '../types';
import { NOW } from '../constants';

const SARAH_ORDER_FEELTRU: Order = {
  id: 'ORD-00441',
  clinic_id: 'feeltru',
  patient_id: 'PT-00198',
  type: 'reorder',
  status: 'clinical_check',
  product: { medication: 'Mounjaro', dose: '7.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: {
    ft_rq_1: 84.2,            // current weight (kg)
    ft_rq_2: 'yes',           // experienced side effects?
    ft_rq_3: 'Mild nausea — particularly in the first week. Settled by day 5.',
    ft_rq_4: 'no',            // pregnant/breastfeeding
    ft_rq_5: 'no',            // medication changes
    ft_rq_6: 'no',            // new diagnoses
    ft_rq_7: 7,               // progress rating (1–10)
  },
  amendment_window: 'pre_dispensed',
  primed_order_id: null,
  primed_clinical_check_completed: false,
  ryft_authorisation_id: 'ryft_auth_abc',
  amount_charged: null,
  amount_authorised: 220,
  clinical_decision: null,
  sla_warn_at: '2026-05-11T14:00:00Z',
  sla_breach_at: '2026-05-12T08:00:00Z',
  g6_flags: ['B4'],
  contextual_flags: ['Dose increase', 'Cardiac history', 'BMI 29.5', 'Awaiting ID'],
  intervention_raised_at: null,
  expired_at: null,
  // BLD-14.3 — NICE CG189 checklist (all confirmed for this dose-escalation order)
  nice_checklist: [
    { id: 'nc-1', label: 'BMI \u226527.5 with comorbidity (hypertension confirmed)', checked: true,  checked_by: 'user_claire', checked_at: '2026-05-11T07:10:00Z' },
    { id: 'nc-2', label: 'Patient willing to receive treatment + monitoring',          checked: true,  checked_by: 'user_claire', checked_at: '2026-05-11T07:10:00Z' },
    { id: 'nc-3', label: 'No contraindications (pancreatitis / MTC / MEN2)',           checked: true,  checked_by: 'user_claire', checked_at: '2026-05-11T07:11:00Z' },
    { id: 'nc-4', label: 'Lifestyle conversation documented this cycle',               checked: true,  checked_by: 'user_claire', checked_at: '2026-05-11T07:11:00Z' },
    { id: 'nc-5', label: 'Reviewed for stop criteria (5% loss at 6 months)',           checked: false },
  ],
  // BLD-14.4 — Dose escalation gate (5mg -> 7.5mg, eligible)
  dose_escalation_gate: {
    is_dose_escalation: true,
    from_dose: '5mg',
    to_dose: '7.5mg',
    weeks_at_current_dose: 6,
    weeks_required: 4,
    weight_loss_pct: 4.1,
    weight_loss_kg: 3.6,
    prior_evidence_uploaded: true,
    evidence_label: 'Reorder Q4 photo (pen pack \xb7 23 Apr 2026)',
    eligible: true,
  },
  // BLD-14.5 — Weight trajectory (last 5 readings)
  weight_history: [
    { recorded_at: '2026-01-25T10:00:00Z', weight_kg: 92.5, bmi: 34.0 },
    { recorded_at: '2026-02-22T10:00:00Z', weight_kg: 91.0, bmi: 33.4 },
    { recorded_at: '2026-03-22T10:00:00Z', weight_kg: 88.5, bmi: 32.5 },
    { recorded_at: '2026-04-19T10:00:00Z', weight_kg: 86.2, bmi: 31.7 },
    { recorded_at: '2026-05-01T10:00:00Z', weight_kg: 84.2, bmi: 30.9 },
  ],
  created_at: '2026-05-11T06:00:00Z',
  updated_at: NOW,
};

const SARAH_ORDER_VSC: Order = { ...SARAH_ORDER_FEELTRU, clinic_id: 'vsc', patient_id: 'PT-00012', amendment_window: 'pre_approval' };

const JAMES_ORDER_VSC: Order = {
  id: 'ORD-00438',
  clinic_id: 'vsc',
  patient_id: 'PT-00234',
  type: 'reorder',
  status: 'approved',
  product: { medication: 'Mounjaro', dose: '5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: {
    vsc_rq_1: 101.4,   // current weight (kg)
    vsc_rq_2: 'no',    // side effects?
    vsc_rq_3: '',
    vsc_rq_4: 'yes',   // same other medications?
    vsc_rq_5: 'no',    // new diagnoses?
    vsc_rq_6: 8,       // progress rating (1–10)
  },
  amendment_window: 'pre_approval',
  primed_order_id: null,
  primed_clinical_check_completed: true,
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
  intervention_raised_at: null,
  expired_at: null,
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
  questionnaire_responses: {
    vsc_rq_1: 95.1,    // current weight (kg)
    vsc_rq_2: 'no',    // side effects?
    vsc_rq_3: '',
    vsc_rq_4: 'yes',   // same other medications?
    vsc_rq_5: 'no',    // new diagnoses?
    vsc_rq_6: 6,       // progress rating (1–10)
  },
  amendment_window: 'pre_approval',
  primed_order_id: null,
  primed_clinical_check_completed: false,
  ryft_authorisation_id: 'ryft_auth_mo1',
  amount_charged: null,
  amount_authorised: 159.00,
  clinical_decision: null,
  sla_warn_at: '2026-05-11T06:00:00Z',
  sla_breach_at: '2026-05-11T12:00:00Z',
  g6_flags: [],
  contextual_flags: ['Dose increase', 'Awaiting BMI'],
  intervention_raised_at: null,
  expired_at: null,
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
  questionnaire_responses: {
    ft_rq_1: 87.3,     // current weight (kg)
    ft_rq_2: 'no',     // side effects?
    ft_rq_3: '',
    ft_rq_4: 'no',     // pregnant/breastfeeding
    ft_rq_5: 'no',     // medication changes
    ft_rq_6: 'no',     // new diagnoses
    ft_rq_7: 9,        // progress rating (1–10)
  },
  amendment_window: 'pre_dispensed',
  primed_order_id: 'primed_ew_001',
  primed_clinical_check_completed: true,
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
  intervention_raised_at: null,
  expired_at: null,
  royal_mail_tracking_id: 'RM123456789GB',
  dispatched_at: '2026-05-07T08:00:00Z',
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
  questionnaire_responses: {
    ft_oq_1: 87.0,                      // current weight (kg)
    ft_oq_2: 72.0,                      // goal weight (kg)
    ft_oq_3: 'no',                      // drug allergies?
    ft_oq_4: 'no',                      // other medications?
    ft_oq_5: 'PCOS',                    // conditions
    ft_oq_6: 'no',                      // pregnant/breastfeeding?
    ft_oq_7: 'yes',                     // tried weight-loss medication before?
    ft_oq_8: 'Tried Orlistat in 2023 with limited success. GP-referred.',
  },
  amendment_window: 'pre_dispensed',
  primed_order_id: null,
  primed_clinical_check_completed: false,
  ryft_authorisation_id: 'ryft_auth_za1',
  amount_charged: null,
  amount_authorised: 149.00,
  clinical_decision: null,
  sla_warn_at: '2026-05-11T11:00:00Z',
  sla_breach_at: '2026-05-12T05:00:00Z',
  g6_flags: [],
  contextual_flags: ['Duplicate address', 'Awaiting Rx evidence'],
  intervention_raised_at: null,
  expired_at: null,
  created_at: '2026-05-11T05:00:00Z',
  updated_at: NOW,
};

// BLD-4.6.1 — Intervention seed: an order in on_hold status with intervention_raised_at set
const HELEN_ORDER_FEELTRU_INTERVENTION: Order = {
  id: 'ORD-00433',
  clinic_id: 'feeltru',
  patient_id: 'PT-00198',
  type: 'reorder',
  status: 'on_hold',
  product: { medication: 'Mounjaro', dose: '5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: {
    ft_rq_1: 85.6,                           // current weight (kg)
    ft_rq_2: 'yes',                          // side effects?
    ft_rq_3: 'Mild headache — intermittent, started around day 3.',
    ft_rq_4: 'no',                           // pregnant/breastfeeding
    ft_rq_5: 'yes',                          // medication changes (started metformin)
    ft_rq_6: 'no',                           // new diagnoses
    ft_rq_7: 6,                              // progress rating (1–10)
  },
  amendment_window: 'pre_dispensed',
  primed_order_id: null,
  primed_clinical_check_completed: false,
  ryft_authorisation_id: 'ryft_auth_hf1',
  amount_charged: null,
  amount_authorised: 199.00,
  clinical_decision: {
    prescriber_user_id: 'user_qadir',
    decision: 'queried',
    decided_at: '2026-05-08T09:00:00Z',
    rationale: 'Concurrent metformin initiation. Please confirm dosing schedule and GP awareness.',
  },
  sla_warn_at: '2026-05-08T09:00:00Z',
  sla_breach_at: '2026-05-12T09:00:00Z',
  g6_flags: [],
  intervention_raised_at: '2026-05-08T09:00:00Z',
  expired_at: null,
  created_at: '2026-05-07T14:00:00Z',
  updated_at: '2026-05-08T09:00:00Z',
};

// BLD-4.6.3/4 — Expired seed: an order that hit the 6-calendar-day expiry
const NINA_ORDER_VSC_EXPIRED: Order = {
  id: 'ORD-00418',
  clinic_id: 'vsc',
  patient_id: 'PT-00156',
  type: 'new',
  status: 'expired',
  product: { medication: 'Mounjaro', dose: '2.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: {
    vsc_oq_1: 96.0,                       // current weight (kg)
    vsc_oq_2: 80.0,                       // goal weight (kg)
    vsc_oq_3: 'no',                       // drug allergies?
    vsc_oq_4: 'no',                       // other medications?
    vsc_oq_5: 'None of the above',        // conditions
    vsc_oq_6: 'no',                       // tried weight-loss medication before?
    vsc_oq_7: '',
  },
  amendment_window: 'pre_approval',
  primed_order_id: null,
  primed_clinical_check_completed: false,
  ryft_authorisation_id: 'ryft_auth_ni1',
  amount_charged: null,
  amount_authorised: 149.00,
  clinical_decision: null,
  sla_warn_at: '2026-05-02T10:00:00Z',
  sla_breach_at: '2026-05-03T10:00:00Z',
  g6_flags: [],
  intervention_raised_at: null,
  expired_at: '2026-05-07T10:00:00Z',
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-07T10:00:00Z',
};

// Task-38 — Cancelled-after-capture seed.
// Demonstrates the refund branch: payment was captured (amount_charged set), the
// order was cancelled post-approval, and a linked AMEND-003 refund amendment
// sits in `requested` status pending refund-authority review.
const PRIYA_ORDER_FEELTRU_CANCELLED: Order = {
  id: 'ORD-00450',
  clinic_id: 'feeltru',
  patient_id: 'PT-00198',
  type: 'reorder',
  status: 'cancelled',
  product: { medication: 'Mounjaro', dose: '5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: { weight_today: 88.0, side_effects: 'none', medication_changes: 'none' },
  amendment_window: 'pre_dispensed',
  primed_order_id: null,
  primed_clinical_check_completed: false,
  ryft_authorisation_id: 'ryft_auth_pr1',
  amount_charged: 179.00,
  amount_authorised: 179.00,
  clinical_decision: {
    prescriber_user_id: 'user_qadir',
    decision: 'approved',
    decided_at: '2026-05-09T11:00:00Z',
    rationale: 'Reorder approved — stable on current dose.',
  },
  sla_warn_at: '2026-05-09T15:00:00Z',
  sla_breach_at: '2026-05-10T09:00:00Z',
  g6_flags: [],
  intervention_raised_at: null,
  expired_at: null,
  cancelled_at: '2026-05-10T14:30:00Z',
  cancellation_reason: 'Patient called to cancel — relocating overseas, no longer requires UK supply.',
  refund_amendment_id: 'AMEND-003',
  created_at: '2026-05-09T08:00:00Z',
  updated_at: '2026-05-10T14:30:00Z',
};

// Task-81 / Task-86 — Px-upload approval gate seed.
// GLP-1 higher-dose intake path (ft_oq_9 + ft_oq_10 = 'yes') that has not yet
// supplied a current prescription. Mirrors the contextual flag added by
// createIntakeOrder so the Approve button on Order Detail is disabled with the
// "GLP-1 prescription upload required…" copy until attachPxUpload runs.
const ZARA_ORDER_FEELTRU_PX_PENDING: Order = {
  id: 'ORD-00451',
  clinic_id: 'feeltru',
  patient_id: 'PT-00378',
  type: 'new',
  status: 'clinical_check',
  product: { medication: 'Mounjaro', dose: '7.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: {
    ft_oq_1: 87.0,
    ft_oq_2: 72.0,
    ft_oq_3: 'no',
    ft_oq_4: 'no',
    ft_oq_5: 'None',
    ft_oq_6: 'no',
    ft_oq_7: 'yes',
    ft_oq_8: 'Currently on Mounjaro 5mg from a previous provider; requesting 7.5mg.',
    ft_oq_9: 'yes',   // currently on a GLP-1
    ft_oq_10: 'yes',  // requesting a higher starting dose
  },
  amendment_window: 'pre_approval',
  primed_order_id: null,
  primed_clinical_check_completed: false,
  ryft_authorisation_id: 'ryft_auth_za2',
  amount_charged: null,
  amount_authorised: 149.0,
  clinical_decision: null,
  sla_warn_at: '2026-05-18T11:00:00Z',
  sla_breach_at: '2026-05-19T11:00:00Z',
  g6_flags: [],
  contextual_flags: ['New intake', 'Px upload pending'],
  intervention_raised_at: null,
  px_upload: null,
  // Task-178 + Task-180 — Rich history seed combining the email-history
  // demo (initial bounce, two delivered resends, a cool-down-suppressed
  // attempt sourced from the audit log) with the prescriber-queue
  // reminder-health pill (the first reminder hard-bounced and has not yet
  // been re-sent, so the queue should show a "Reminder bounced" pill).
  px_upload_link: {
    token: 'pxlnk_zara_v3',
    expires_at: '2026-05-21T14:05:00Z',
    sent_at: '2026-05-09T14:05:00Z',
    first_sent_at: '2026-05-09T08:32:00Z',
    consumed_at: null,
    email_message_id: 'pm-msg-zara-3',
    to_email: 'zara.k@example.com',
    initial_attempted_at: '2026-05-08T16:14:00Z',
    initial_to_email: 'zara.k@exmple.com',
    initial_send_status: 'Bounced',
    initial_send_error_message:
      'Postmark hard-bounce: mailbox does not exist (exmple.com).',
    initial_send_by_user_id: null,
    resends: [
      {
        sent_at: '2026-05-09T08:32:00Z',
        attempted_at: '2026-05-09T08:32:00Z',
        to_email: 'zara.k@example.com',
        expires_at: '2026-05-16T08:32:00Z',
        previous_expired: false,
        by_user_id: 'user_claire',
        status: 'Delivered',
        error_message: null,
      },
      {
        sent_at: '2026-05-09T14:05:00Z',
        attempted_at: '2026-05-09T14:05:00Z',
        to_email: 'zara.k@example.com',
        expires_at: '2026-05-21T14:05:00Z',
        previous_expired: false,
        by_user_id: 'user_mobeen',
        status: 'Delivered',
        error_message: null,
      },
    ],
    reminder_sent_at: null,
    final_reminder_sent_at: null,
    reminder_failures: [
      {
        kind: 'first',
        attempted_at: '2026-05-11T08:32:00Z',
        to_email: 'zara.k@example.com',
        status: 'Bounced',
        error_message: 'Hard bounce — mailbox does not exist (550)',
        // Task-261 — null = fired by the scheduled reminder job.
        by_user_id: null,
      },
    ],
  },
  expired_at: null,
  created_at: '2026-05-08T16:00:00Z',
  updated_at: '2026-05-09T14:05:30Z',
};

// ---------------------------------------------------------------------------
// Task-178 — In-memory adapter over the audit log.
//
// The task brief is explicit: "No new persistence layer — reuse
// `px_upload_link` record + audit log". Cool-down-suppressed resend
// attempts are emitted as `px_upload_link_resend_suppressed` events via
// the existing audit pipeline (and persisted to Postgres by recordAudit).
// The fixture layer keeps a parallel in-memory mirror of those events so
// the client UI can render them in the Email-history view without having
// to query Postgres. This is a *read adapter*, not a new persistence layer.
// ---------------------------------------------------------------------------
export type OrderAuditEvent = {
  order_id: string;
  clinic_id: ClinicId;
  event_type: string;
  actor_user_id: string | null;
  occurred_at: string; // ISO
  payload: Record<string, unknown>;
};

export const MOCK_ORDER_AUDIT_EVENTS: OrderAuditEvent[] = [];

export function recordOrderAuditEvent(evt: OrderAuditEvent): void {
  MOCK_ORDER_AUDIT_EVENTS.push(evt);
}

export function getOrderAuditEvents(
  order_id: string,
  event_types?: readonly string[],
): OrderAuditEvent[] {
  const filtered = MOCK_ORDER_AUDIT_EVENTS.filter((e) => e.order_id === order_id);
  if (!event_types || event_types.length === 0) return filtered;
  const set = new Set(event_types);
  return filtered.filter((e) => set.has(e.event_type));
}

// Seed a single suppressed-resend event for the ZARA Px-pending demo order
// so reviewers can see the cool-down row in the Email history without
// having to interact with the page first.
MOCK_ORDER_AUDIT_EVENTS.push({
  order_id: 'order_zara_glp_px_pending',
  clinic_id: 'feeltru',
  event_type: 'px_upload_link_resend_suppressed',
  actor_user_id: 'user_claire',
  occurred_at: '2026-05-09T14:05:30Z',
  payload: {
    reason: 'cooldown',
    to_email: 'zara.k@example.com',
    cooldown_seconds: 60,
    remaining_seconds: 30,
  },
});

// Task-253 — Legacy px-replacement seed. Mirrors the state of an order
// that was replaced one-or-more times BEFORE Task-171 shipped: the
// current `px_upload` is the latest file, and the Task-119 audit log
// captured every prior swap, but `px_upload_history` is empty. The
// startup backfill (see backfillPxUploadReplacementHistory) reconstructs
// the chain from the audit events seeded into MOCK_ORDER_AUDIT_EVENTS
// below so the Order Detail UI can render a complete history.
const LEILA_ORDER_FEELTRU_LEGACY_REPLACED: Order = {
  id: 'ORD-00452',
  clinic_id: 'feeltru',
  patient_id: 'PT-00378',
  type: 'new',
  status: 'clinical_check',
  product: { medication: 'Mounjaro', dose: '5mg', strength: 'pre-filled pen', plan: '4 weeks' },
  questionnaire_responses: {
    ft_oq_1: 92.0,
    ft_oq_2: 78.0,
    ft_oq_3: 'no',
    ft_oq_4: 'no',
    ft_oq_5: 'None',
    ft_oq_6: 'no',
    ft_oq_7: 'yes',
    ft_oq_8: 'Currently on Mounjaro 2.5mg from a previous provider; stepping up.',
    ft_oq_9: 'yes',
    ft_oq_10: 'yes',
  },
  amendment_window: 'pre_approval',
  primed_order_id: null,
  primed_clinical_check_completed: false,
  ryft_authorisation_id: 'ryft_auth_le1',
  amount_charged: null,
  amount_authorised: 179.0,
  clinical_decision: null,
  sla_warn_at: '2026-05-17T10:00:00Z',
  sla_breach_at: '2026-05-18T10:00:00Z',
  g6_flags: [],
  contextual_flags: ['New intake', 'Px upload received'],
  intervention_raised_at: null,
  px_upload: {
    filename: 'leila-rx-final.pdf',
    size: 184_320,
    content_type: 'application/pdf',
    uploaded_at: '2026-05-06T15:42:00Z',
    object_path: '/objects/uploads/leila-rx-final',
    source: 'staff_upload',
    uploaded_by_user_id: 'user_claire',
  },
  // px_upload_history intentionally omitted — populated by the
  // Task-253 backfill from MOCK_ORDER_AUDIT_EVENTS at module load.
  expired_at: null,
  created_at: '2026-05-04T09:00:00Z',
  updated_at: '2026-05-06T15:42:00Z',
};

export const MOCK_ORDERS: Order[] = [
  SARAH_ORDER_FEELTRU, SARAH_ORDER_VSC,
  JAMES_ORDER_VSC, MIRIAM_ORDER_VSC,
  EMMA_ORDER_FEELTRU, ZARA_ORDER_FEELTRU,
  HELEN_ORDER_FEELTRU_INTERVENTION,
  NINA_ORDER_VSC_EXPIRED,
  PRIYA_ORDER_FEELTRU_CANCELLED,
  ZARA_ORDER_FEELTRU_PX_PENDING,
  LEILA_ORDER_FEELTRU_LEGACY_REPLACED,
];

// Task-253 — Legacy px_upload_result audit rows for ORD-00452 (above).
// Two successful replacements happened before Task-171 shipped:
// the patient's blurry initial scan was swapped via the email-link
// route, then staff swapped the resulting wrong-page PDF via the
// staff-upload control. The current `px_upload` on the order is the
// third (latest) file, so the history should end up with two entries.
MOCK_ORDER_AUDIT_EVENTS.push(
  {
    order_id: 'ORD-00452',
    clinic_id: 'feeltru',
    event_type: 'px_upload_result',
    actor_user_id: null,
    occurred_at: '2026-05-05T11:14:00Z',
    payload: {
      outcome: 'success',
      is_replacement: true,
      source: 'email_link',
      filename: 'leila-rx-v2.jpg',
      replaced_from: {
        filename: 'leila-rx-initial.jpg',
        size: 412_000,
        content_type: 'image/jpeg',
        source: 'success_screen',
      },
    },
  },
  {
    order_id: 'ORD-00452',
    clinic_id: 'feeltru',
    event_type: 'px_upload_result',
    actor_user_id: 'user_claire',
    occurred_at: '2026-05-06T15:42:00Z',
    payload: {
      outcome: 'success',
      is_replacement: true,
      source: 'staff_upload',
      filename: 'leila-rx-final.pdf',
      replaced_from: {
        filename: 'leila-rx-v2.jpg',
        size: 388_400,
        content_type: 'image/jpeg',
        source: 'email_link',
      },
    },
  },
);

// Task-253 — One-shot backfill that reconstructs `px_upload_history`
// for orders whose replacements happened before Task-171 shipped.
// Inlined here (rather than calling backfillPxUploadReplacementHistory
// from lib/api/jobs) to avoid the circular import — that job module
// imports MOCK_ORDERS / MOCK_ORDER_AUDIT_EVENTS from this file. The
// logic is intentionally identical: read px_upload_result audit rows
// with outcome=success + is_replacement=true, dedupe by replaced_at +
// replaced_filename, append in chronological order. Idempotent.
(function backfillLegacyPxUploadHistoryAtBoot(): void {
  type Row = {
    order_id: string;
    occurred_at: string;
    actor_user_id: string | null;
    source: 'success_screen' | 'email_link' | 'staff_upload';
    replaced_filename: string;
  };
  const rows: Row[] = [];
  for (const evt of MOCK_ORDER_AUDIT_EVENTS) {
    if (evt.event_type !== 'px_upload_result') continue;
    const p = evt.payload as Record<string, unknown>;
    if (p.outcome !== 'success' || p.is_replacement !== true) continue;
    const replacedFrom = p.replaced_from as Record<string, unknown> | null | undefined;
    const replacedFilename = typeof replacedFrom?.filename === 'string'
      ? replacedFrom.filename : null;
    const source = typeof p.source === 'string' ? p.source : null;
    if (!replacedFilename) continue;
    if (source !== 'success_screen' && source !== 'email_link' && source !== 'staff_upload') {
      continue;
    }
    rows.push({
      order_id: evt.order_id,
      occurred_at: evt.occurred_at,
      actor_user_id: evt.actor_user_id,
      source,
      replaced_filename: replacedFilename,
    });
  }
  rows.sort((a, b) =>
    new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  );
  for (const r of rows) {
    const order = MOCK_ORDERS.find((o) => o.id === r.order_id);
    if (!order) continue;
    const history = order.px_upload_history ?? [];
    const present = history.some(
      (h) => h.replaced_at === r.occurred_at && h.replaced_filename === r.replaced_filename,
    );
    if (present) continue;
    order.px_upload_history = [
      ...history,
      {
        replaced_at: r.occurred_at,
        replaced_filename: r.replaced_filename,
        replaced_by_user_id: r.actor_user_id,
        replaced_by_source: r.source,
      },
    ];
  }
})();
