/**
 * Livera order fixtures — extracted from mock.ts (Mini-wave 6a cleanup).
 * Wave 4: BLD-4.6.1 (intervention SLA), BLD-4.6.3 (expiry), BLD-5.3 (amendOrder).
 *
 * Contains: MOCK_ORDERS, listOrders, getOrder, decideOrder, getClinicalCheckQueue,
 *           createAmendment (BLD-5.3), expireOrder (BLD-4.6.3).
 */

import type { ClinicId, Order, OrderStatus } from '../types';
import { delay, APIError, scopedToClinic, CURRENT_USER, NOW } from '../constants';
import { MOCK_PATIENTS } from './patients';
import { MOCK_CLINICAL_NOTES } from './clinicalNotes';
import { getClinicSync } from './clinics';
import { createPharmacyCommThread } from './pharmacyComms';
import { createGPLetter, MOCK_GP_LETTERS } from './gpLetters'; // CLARIFY-1 (Wave 5) — auto-trigger on approval; Task-109 — direct cleanup on reversal
import { releaseAuth } from '@/lib/integrations/ryft'; // Task-38 — auth-release branch
import { notifyPatient } from '@/lib/integrations/patientNotify'; // Task-49 + Task-65
import { sendPatientEmail, sendStaffEmail } from '@/lib/integrations/postmark'; // Task-80 / Task-78
import { randomBytes } from 'crypto';
import { evaluateSelfReportedBmi, filterSelfReportedBmiFlag, SELF_REPORTED_BMI_FLAG } from '@/lib/clinical/selfReportedBmi'; // Task-163
import { recordAudit } from '../audit'; // Task-167 — durable spine

// ---------------------------------------------------------------------------
// Seeds
// All seeds carry intervention_raised_at and expired_at (BLD-4.6.1, BLD-4.6.3).
// ---------------------------------------------------------------------------

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

const MOCK_ORDER_AUDIT_EVENTS: OrderAuditEvent[] = [];

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

export const MOCK_ORDERS: Order[] = [
  SARAH_ORDER_FEELTRU, SARAH_ORDER_VSC,
  JAMES_ORDER_VSC, MIRIAM_ORDER_VSC,
  EMMA_ORDER_FEELTRU, ZARA_ORDER_FEELTRU,
  HELEN_ORDER_FEELTRU_INTERVENTION,
  NINA_ORDER_VSC_EXPIRED,
  PRIYA_ORDER_FEELTRU_CANCELLED,
  ZARA_ORDER_FEELTRU_PX_PENDING,
];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Task-163 — Drop the "Self-reported BMI out of range" contextual flag from
// an order once a prescriber has reviewed the BMI photo evidence (i.e. the
// linked patient's `verification.bmi_verified_at` has been set). Called at
// every order read so the dashboard, queue, and order detail all see the
// cleared state without each caller needing to reconcile it themselves.
function normalizeSelfReportedBmiFlag(order: Order): void {
  if (!order.contextual_flags?.includes(SELF_REPORTED_BMI_FLAG)) return;
  const patient = MOCK_PATIENTS.find((p) => p.id === order.patient_id);
  const verifiedAt = patient?.verification.bmi_verified_at ?? null;
  if (!verifiedAt) return;
  order.contextual_flags = filterSelfReportedBmiFlag(
    order.contextual_flags,
    verifiedAt,
  );
}

export async function listOrders(
  clinic_id: ClinicId,
  opts?: { status?: OrderStatus; patient_id?: string }
): Promise<Order[]> {
  await delay();
  let results = scopedToClinic(MOCK_ORDERS, clinic_id);
  if (opts?.status) results = results.filter((o) => o.status === opts.status);
  if (opts?.patient_id) results = results.filter((o) => o.patient_id === opts.patient_id);
  results.forEach(normalizeSelfReportedBmiFlag);
  return results;
}

export async function getOrder(clinic_id: ClinicId, id: string): Promise<Order> {
  await delay();
  const o = MOCK_ORDERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!o) throw new APIError('NOT_FOUND', 'Order not found');
  normalizeSelfReportedBmiFlag(o);
  return o;
}

export async function getClinicalCheckQueue(clinic_id: ClinicId): Promise<Order[]> {
  return listOrders(clinic_id, { status: 'clinical_check' });
}

// ---------------------------------------------------------------------------
// decideOrder — BLD-4.4 (Wave 3) + BLD-4.6.1 intervention_raised_at (Wave 4)
// ---------------------------------------------------------------------------

export async function decideOrder(
  clinic_id: ClinicId,
  id: string,
  decision: 'approved' | 'declined' | 'queried',
  rationale: string
): Promise<Order> {
  // Layer 3 — Audit: log every attempt before any validation
  console.log('[AUDIT]', {
    event_type: 'clinical_decision_attempt',
    clinic_id,
    order_id: id,
    user_id: CURRENT_USER.id,
    decision_attempted: decision,
    rationale,
    timestamp: NOW,
  });

  await delay(400);
  const o = MOCK_ORDERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!o) throw new APIError('NOT_FOUND', 'Order not found');

  // Layer 2 — Data guard: validate before applying any decision
  if (o.status !== 'clinical_check') {
    console.log('[AUDIT]', {
      event_type: 'clinical_decision_result',
      outcome: 'safety_violation',
      reason: 'not_in_clinical_check',
      order_id: id,
      user_id: CURRENT_USER.id,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Cannot act on this order: it is not in clinical_check status');
  }

  if (decision === 'approved') {
    const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === o.patient_id);
    const hasHighUnacknowledgedFlag = patient?.flags.some(
      (f) => f.severity === 'high' && f.code !== 'B4_acknowledged'
    ) ?? false;

    if (hasHighUnacknowledgedFlag) {
      console.log('[AUDIT]', {
        event_type: 'clinical_decision_result',
        outcome: 'safety_violation',
        reason: 'high_severity_flag_unacknowledged',
        order_id: id,
        user_id: CURRENT_USER.id,
        timestamp: NOW,
      });
      throw new APIError('SAFETY_VIOLATION', 'Cannot approve: patient has an unacknowledged high-severity clinical flag');
    }

    // Task-81 — Block approval until GLP-1 higher-dose px upload is attached.
    // Mirrors the dose-escalation evidence gate: if the intake flagged this order
    // as awaiting the patient's current prescription ("Px upload pending"), the
    // prescriber cannot approve until px_upload is non-null.
    const pxUploadPending = o.contextual_flags?.includes('Px upload pending') ?? false;
    if (pxUploadPending && o.px_upload == null) {
      console.log('[AUDIT]', {
        event_type: 'clinical_decision_result',
        outcome: 'safety_violation',
        reason: 'px_upload_required',
        order_id: id,
        user_id: CURRENT_USER.id,
        timestamp: NOW,
      });
      throw new APIError('SAFETY_VIOLATION', 'Cannot approve: GLP-1 prescription upload required from patient before approval');
    }

    const hasDoseEscalation = o.dose_escalation_gate?.is_dose_escalation === true;
    const hasPriorDoseEvidence = o.dose_escalation_gate?.prior_evidence_uploaded === true;
    if (hasDoseEscalation && !hasPriorDoseEvidence) {
      console.log('[AUDIT]', {
        event_type: 'clinical_decision_result',
        outcome: 'safety_violation',
        reason: 'dose_escalation_no_prior_evidence',
        order_id: id,
        user_id: CURRENT_USER.id,
        timestamp: NOW,
      });
      throw new APIError('SAFETY_VIOLATION', 'Cannot approve: dose escalation requires prior dose evidence in questionnaire');
    }

    // Layer 2 — BLD-4.4 clinical note gate
    const clinic = getClinicSync(clinic_id);
    const approvalNoteExists = MOCK_CLINICAL_NOTES.some(
      (n) =>
        n.approval_gate_for_order_id === id &&
        n.clinic_id === clinic_id &&
        n.body.length >= clinic.config.clinical_note_min_chars,
    );
    if (!approvalNoteExists) {
      console.log('[AUDIT]', {
        event_type: 'clinical_decision_result',
        outcome:    'safety_violation',
        reason:     'clinical_note_required',
        actor_id:   CURRENT_USER.id,
        target_id:  id,
        timestamp:  NOW,
      });
      throw new APIError('SAFETY_VIOLATION', 'clinical_note_required');
    }
  }

  o.clinical_decision = {
    prescriber_user_id: CURRENT_USER.id,
    decision,
    decided_at: NOW,
    rationale,
  };

  // BLD-4.6.1 — set intervention_raised_at when decision='queried' (order enters on_hold)
  if (decision === 'queried') {
    o.intervention_raised_at = NOW;
    o.status = 'on_hold';
  } else {
    o.status = decision === 'approved' ? 'approved' : 'declined';
  }

  o.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'clinical_decision_result',
    outcome: decision,
    order_id: id,
    user_id: CURRENT_USER.id,
    new_status: o.status,
    intervention_raised_at: o.intervention_raised_at,
    timestamp: NOW,
  });

  // Task-167 — durable spine: double-write the success line above into
  // the audit_events table so the order's Activity tab and global Activity
  // page can render the decision without scraping the rotating pino log.
  void recordAudit({
    clinic_id,
    actor: CURRENT_USER,
    entity: { type: 'order', id },
    event_type: `order_${decision}`,
    summary: `Order ${id} ${decision} by ${CURRENT_USER.full_name}.`,
    after: {
      decision,
      new_status: o.status,
      rationale,
      intervention_raised_at: o.intervention_raised_at,
    },
  });

  // CLARIFY-1 (Wave 5) — Auto-trigger GP letter on order approval (DEC-22 §8).
  // "Letter enters Owed queue when AND ONLY WHEN: patient consented + first treatment approved."
  // createGPLetter is the single source of truth for DEC-22 lifecycle classification.
  // Auto-trigger failure MUST NOT block the order approval — wrapped in try/catch.
  if (decision === 'approved') {
    try {
      const letter = await createGPLetter(clinic_id, {
        patient_id: o.patient_id,
        anchor_order_id: o.id,
        prescriber_id: o.clinical_decision?.prescriber_user_id ?? CURRENT_USER.id,
        auto_triggered: true,
      });
      console.log('[AUDIT]', {
        event_type: 'gp_letter_auto_triggered',
        clinic_id,
        order_id: id,
        gp_letter_id: letter.id,
        lifecycle_status: letter.lifecycle_status,
        actor_id: CURRENT_USER.id,
        timestamp: NOW,
      });
      void recordAudit({
        clinic_id,
        actor: 'system',
        entity: { type: 'gp_letter', id: letter.id },
        event_type: 'gp_letter_auto_triggered',
        summary: `GP letter ${letter.id} auto-triggered by approval of ${id}.`,
        after: { lifecycle_status: letter.lifecycle_status, anchor_order_id: id },
      });
    } catch (err) {
      console.log('[AUDIT]', {
        event_type: 'gp_letter_auto_trigger_failed',
        clinic_id,
        order_id: id,
        error: err instanceof Error ? err.message : String(err),
        actor_id: CURRENT_USER.id,
        timestamp: NOW,
      });
      // Auto-trigger failure does not throw — order approval already succeeded above.
    }
  }

  return o;
}

// ---------------------------------------------------------------------------
// reverseDecision — Task-71 + Task-158
//
// Two entry points share this fixture:
//   * Short quick-undo (~5s after deciding): the toast / detail-page Undo
//     button calls without a reason. We treat that as a misclick recovery.
//   * Long-window "Reverse decision" (Task-158): clinician (or a colleague)
//     reverses a still-pre-dispensing decision an arbitrary time later. A
//     mandatory rationale is required, captured as a clinical note and
//     stamped on the order's reversal_log so the activity timeline shows
//     who reversed it, when, and why.
//
// Either way the order is restored to 'clinical_check' so it pops back into
// the queue, and Task-109 side-effects (auto-triggered GP letter, approval
// gate clinical note) are tidied. The reversal_log entry captures any side
// effects that fired so the caller (UI) can surface them to the clinician
// instead of leaving them dangling silently.
// ---------------------------------------------------------------------------

export type ReverseDecisionResult = {
  order: Order;
  side_effects: {
    gp_letter_cancelled_id: string | null;
    clinical_notes_reversed_ids: string[];
  };
};

export async function reverseDecision(
  clinic_id: ClinicId,
  id: string,
  opts?: { reason?: string; clinical_note_id?: string | null },
): Promise<ReverseDecisionResult> {
  await delay(200);
  const o = MOCK_ORDERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!o) throw new APIError('NOT_FOUND', 'Order not found');
  if (!o.clinical_decision) {
    throw new APIError('VALIDATION', 'No decision to reverse on this order');
  }
  const reason = opts?.reason?.trim() || null;
  // Long-window path requires a non-trivial rationale so the audit entry is
  // meaningful. Quick-undo callers pass no reason at all and bypass the gate.
  if (opts && 'reason' in opts) {
    if (!reason || reason.length < 20) {
      throw new APIError(
        'VALIDATION',
        'A reversal reason of at least 20 characters is required.',
      );
    }
  }

  const priorDecision   = o.clinical_decision.decision;
  const priorDecidedAt  = o.clinical_decision.decided_at;
  const priorPrescriber = o.clinical_decision.prescriber_user_id;
  const priorRationale  = o.clinical_decision.rationale;

  o.clinical_decision = null;
  o.intervention_raised_at = null;
  o.status = 'clinical_check';
  o.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'clinical_decision_reversed',
    clinic_id,
    order_id: id,
    prior_decision: priorDecision,
    prior_prescriber_user_id: priorPrescriber,
    prior_decided_at: priorDecidedAt,
    user_id: CURRENT_USER.id,
    reason,
    timestamp: NOW,
  });
  void recordAudit({
    clinic_id,
    actor: CURRENT_USER,
    entity: { type: 'order', id },
    event_type: 'clinical_decision_reversed',
    summary: `Decision (${priorDecision}) reversed on ${id} by ${CURRENT_USER.full_name}.`,
    before: { decision: priorDecision, rationale: priorRationale ?? null },
    after: { status: 'clinical_check' },
  });

  const sideEffects: ReverseDecisionResult['side_effects'] = {
    gp_letter_cancelled_id: null,
    clinical_notes_reversed_ids: [],
  };

  // Task-109 — Side-effect cleanup for reversed approvals.
  // When the prior decision was 'approved', the system auto-triggered:
  //   1) a GP letter (DEC-22 / CLARIFY-1 in decideOrder above), and
  //   2) a clinical note recorded at the moment of approval.
  // Both should be tidied so they don't linger in the Owed queue or appear as
  // an authoritative note for a decision that no longer stands. We never hard-
  // delete (the audit trail must remain); we cancel the letter and stamp the
  // note as reversed.
  if (priorDecision === 'approved') {
    // 1) Cancel the auto-triggered GP letter, if it's still cancellable.
    const autoLetter = MOCK_GP_LETTERS.find(
      (l) =>
        l.clinic_id === clinic_id &&
        l.anchor_order_id === id &&
        l.auto_triggered === true &&
        l.lifecycle_status !== 'sent' &&
        l.lifecycle_status !== 'cancelled',
    );
    if (autoLetter) {
      const oldLifecycle = autoLetter.lifecycle_status;
      autoLetter.lifecycle_status = 'cancelled';
      autoLetter.cancel_reason =
        'Auto-cancelled: the prescriber reversed the approval that created this letter.';
      sideEffects.gp_letter_cancelled_id = autoLetter.id;
      console.log('[AUDIT]', {
        event_type: 'gp_letter_cancelled',
        outcome: 'success',
        reason: 'approval_reversed',
        clinic_id,
        letter_id: autoLetter.id,
        order_id: id,
        old_lifecycle_status: oldLifecycle,
        new_lifecycle_status: 'cancelled',
        actor_id: CURRENT_USER.id,
        timestamp: NOW,
      });
      void recordAudit({
        clinic_id,
        actor: CURRENT_USER,
        entity: { type: 'gp_letter', id: autoLetter.id },
        event_type: 'gp_letter_cancelled',
        summary: `GP letter ${autoLetter.id} auto-cancelled (approval of ${id} reversed).`,
        before: { lifecycle_status: oldLifecycle },
        after: { lifecycle_status: 'cancelled', reason: 'approval_reversed' },
      });
    }

    // 2) Mark the approval-gate clinical note(s) as reversed.
    for (const note of MOCK_CLINICAL_NOTES) {
      if (
        note.clinic_id === clinic_id &&
        note.approval_gate_for_order_id === id &&
        !note.reversed_at
      ) {
        note.reversed_at = NOW;
        note.reversed_by_user_id = CURRENT_USER.id;
        if (!note.tags.includes('reversed')) note.tags = [...note.tags, 'reversed'];
        note.updated_at = NOW;
        sideEffects.clinical_notes_reversed_ids.push(note.id);
        console.log('[AUDIT]', {
          event_type: 'clinical_note_reversed',
          outcome: 'success',
          reason: 'approval_reversed',
          clinic_id,
          note_id: note.id,
          order_id: id,
          actor_id: CURRENT_USER.id,
          timestamp: NOW,
        });
      }
    }
  }

  // Task-158 — Persist the reversal in an append-only log on the order so the
  // activity timeline can show that a decision was made, then reversed, and
  // by whom / why. Quick-undo entries have `reason: null` and are still
  // surfaced (so colleagues can see something happened) but without prose.
  const existingLog = o.reversal_log ?? [];
  o.reversal_log = [
    ...existingLog,
    {
      reversed_at: NOW,
      reversed_by_user_id: CURRENT_USER.id,
      prior_decision: priorDecision,
      prior_decided_at: priorDecidedAt,
      prior_prescriber_user_id: priorPrescriber,
      prior_rationale: priorRationale,
      reason,
      clinical_note_id: opts?.clinical_note_id ?? null,
      side_effects: {
        gp_letter_cancelled_id: sideEffects.gp_letter_cancelled_id,
        clinical_notes_reversed_ids: [...sideEffects.clinical_notes_reversed_ids],
      },
    },
  ];

  return { order: o, side_effects: sideEffects };
}

// ---------------------------------------------------------------------------
// acknowledgeWeightWarning — Task-99
// Lets a clinician acknowledge a concerning weight-warning chip with a short
// rationale so the wider team knows the trend was reviewed (and why a decision
// was still made). Persists the entry against the order and emits an audit
// event that powers the order activity timeline.
// ---------------------------------------------------------------------------

export async function acknowledgeWeightWarning(
  clinic_id: ClinicId,
  order_id: string,
  kind: 'weight_regain' | 'plateau' | 'rapid_loss' | 'bmi_below_threshold',
  rationale: string,
): Promise<Order> {
  await delay(200);
  const trimmed = rationale.trim();
  if (trimmed.length < 3) {
    throw new APIError('VALIDATION', 'Add a short rationale (at least 3 characters)');
  }
  const o = MOCK_ORDERS.find((x) => x.clinic_id === clinic_id && x.id === order_id);
  if (!o) throw new APIError('NOT_FOUND', 'Order not found');

  const existing = o.weight_warning_acknowledgements ?? [];
  // Task-135 — entries are append-only and may include reversed historical
  // rows. Only the latest non-reversed entry counts as "already acknowledged".
  const active = [...existing].reverse().find((a) => a.kind === kind && !a.reversed_at);
  if (active) {
    throw new APIError('VALIDATION', 'This warning has already been acknowledged');
  }
  o.weight_warning_acknowledgements = [
    ...existing,
    {
      kind,
      acknowledged_by_user_id: CURRENT_USER.id,
      acknowledged_at: NOW,
      rationale: trimmed,
    },
  ];
  o.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'weight_warning_acknowledged',
    clinic_id,
    order_id,
    warning_kind: kind,
    rationale: trimmed,
    actor_id: CURRENT_USER.id,
    timestamp: NOW,
  });

  // Return a shallow clone so React parents that hold the previous reference
  // (e.g. OrderDetailClient, ClinicalCheckSlideOver) re-render on setOrder.
  return { ...o };
}

// ---------------------------------------------------------------------------
// undoWeightWarningAcknowledgement — Task-135
// Lets a clinician reverse a weight-warning acknowledgement they (or a
// teammate) entered by mistake. The original acknowledgement row is retained
// — we just stamp it with reversed_at/reversed_by_user_id/reversal_reason so
// the audit timeline can show both events. The chip flips back to its
// unreviewed state and can be acknowledged again with a fresh rationale.
// ---------------------------------------------------------------------------

export async function undoWeightWarningAcknowledgement(
  clinic_id: ClinicId,
  order_id: string,
  kind: 'weight_regain' | 'plateau' | 'rapid_loss' | 'bmi_below_threshold',
  reason: string,
): Promise<Order> {
  await delay(200);
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    throw new APIError('VALIDATION', 'Add a short reason for undoing (at least 3 characters)');
  }
  const o = MOCK_ORDERS.find((x) => x.clinic_id === clinic_id && x.id === order_id);
  if (!o) throw new APIError('NOT_FOUND', 'Order not found');

  const entries = o.weight_warning_acknowledgements ?? [];
  let activeIdx = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].kind === kind && !entries[i].reversed_at) {
      activeIdx = i;
      break;
    }
  }
  if (activeIdx === -1) {
    throw new APIError('VALIDATION', 'There is no active acknowledgement to undo');
  }
  o.weight_warning_acknowledgements = entries.map((e, i) =>
    i === activeIdx
      ? {
          ...e,
          reversed_at: NOW,
          reversed_by_user_id: CURRENT_USER.id,
          reversal_reason: trimmed,
        }
      : e,
  );
  o.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'weight_warning_acknowledgement_undone',
    clinic_id,
    order_id,
    warning_kind: kind,
    reason: trimmed,
    actor_id: CURRENT_USER.id,
    timestamp: NOW,
  });

  return { ...o };
}

// ---------------------------------------------------------------------------
// editWeightWarningAcknowledgement — Task-135
// Lets a clinician amend the rationale they wrote on a weight-warning
// acknowledgement. The previous rationale is preserved in an `edits` history
// on the entry so nothing is silently overwritten, and the timeline can
// surface "rationale edited" as its own audit event.
// ---------------------------------------------------------------------------

export async function editWeightWarningAcknowledgement(
  clinic_id: ClinicId,
  order_id: string,
  kind: 'weight_regain' | 'plateau' | 'rapid_loss' | 'bmi_below_threshold',
  new_rationale: string,
): Promise<Order> {
  await delay(200);
  const trimmed = new_rationale.trim();
  if (trimmed.length < 3) {
    throw new APIError('VALIDATION', 'Add a short rationale (at least 3 characters)');
  }
  const o = MOCK_ORDERS.find((x) => x.clinic_id === clinic_id && x.id === order_id);
  if (!o) throw new APIError('NOT_FOUND', 'Order not found');

  const entries = o.weight_warning_acknowledgements ?? [];
  let activeIdx = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].kind === kind && !entries[i].reversed_at) {
      activeIdx = i;
      break;
    }
  }
  if (activeIdx === -1) {
    throw new APIError('VALIDATION', 'There is no active acknowledgement to edit');
  }
  const target = entries[activeIdx];
  if (target.rationale.trim() === trimmed) {
    throw new APIError('VALIDATION', 'The rationale is unchanged');
  }
  const previous_rationale = target.rationale;
  o.weight_warning_acknowledgements = entries.map((e, i) =>
    i === activeIdx
      ? {
          ...e,
          rationale: trimmed,
          edits: [
            ...(e.edits ?? []),
            {
              edited_by_user_id: CURRENT_USER.id,
              edited_at: NOW,
              previous_rationale,
              new_rationale: trimmed,
            },
          ],
        }
      : e,
  );
  o.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'weight_warning_acknowledgement_edited',
    clinic_id,
    order_id,
    warning_kind: kind,
    previous_rationale,
    new_rationale: trimmed,
    actor_id: CURRENT_USER.id,
    timestamp: NOW,
  });

  return { ...o };
}

// ---------------------------------------------------------------------------
// expireOrder — BLD-4.6.3 internal helper (called by detectOrderExpiry)
// Transitions a single order to 'expired'. Not exported directly —
// detectOrderExpiry owns the loop + effects.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// createIntakeOrder — Task 47 (patient intake form)
// Creates a new 'clinical_check' order from the patient intake form submission.
// ---------------------------------------------------------------------------

export async function createIntakeOrder(
  clinic_id: ClinicId,
  patient: {
    firstName: string;
    lastName: string;
    email: string;
    dob: string;
    phone: string;
    sex_at_birth: 'female' | 'male' | 'other';
  },
  address: { formatted?: string; line1: string; line2?: string; city: string; postcode: string },
  responses: Record<string, unknown>,
  biometrics: { height_cm: number; weight_kg: number; bmi: number },
): Promise<Order> {
  await delay(300);
  const suffix = String(Date.now()).slice(-6);
  const id = `ORD-INTAKE-${suffix}`;
  const patientId = `PT-INTAKE-${suffix}`;

  const slaWarnAt = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
  const slaBreachAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  // Task 61 — GLP-1 higher-dose patients must upload their current prescription
  // before a prescriber can approve. Surface the pending upload as a contextual
  // flag and start the order with px_upload === null.
  const isGlp1HigherDosePath =
    responses['ft_oq_9'] === 'yes' && responses['ft_oq_10'] === 'yes';

  // Task-60 — leading flag is "New intake" so the dashboard can distinguish
  // intake-form orders from regular new-patient orders.
  const contextualFlags = ['New intake', 'Awaiting ID verification', 'Awaiting BMI evidence'];
  if (isGlp1HigherDosePath) contextualFlags.push('Px upload pending');

  // Task-163 — sanity-check the self-reported BMI so prescribers see an
  // explicit flag when the patient's height/weight produces an obviously
  // suspect value (e.g. mis-typed units). The flag clears automatically
  // once a prescriber sets `verification.bmi_verified_at` via the BMI
  // evidence review (see filterSelfReportedBmiFlag).
  const selfReportedBmiFlag = evaluateSelfReportedBmi(biometrics.bmi);
  if (selfReportedBmiFlag) contextualFlags.push(selfReportedBmiFlag);

  // Task-60 — register a minimal Patient record so the order detail page
  // (which calls getPatient) resolves a real patient with a display name.
  // Task-77 — intake now collects sex at birth, phone, and structured
  // address fields, so persist them into the Patient record directly
  // instead of using placeholder defaults.
  const structuredAddress: { line1: string; line2?: string; city: string; postcode: string } = {
    line1: address.line1 || address.formatted || 'Not provided',
    city: address.city,
    postcode: address.postcode,
  };
  if (address.line2) structuredAddress.line2 = address.line2;

  const newPatient = {
    id: patientId,
    clinic_id,
    demographic: {
      full_name: `${patient.firstName} ${patient.lastName}`.trim(),
      dob: patient.dob,
      sex_at_birth: patient.sex_at_birth,
      ethnicity: 'Not stated',
      address: structuredAddress,
    },
    contact: { email: patient.email, phone: patient.phone, preferred_channel: 'email' as const },
    gp: null,
    baseline: {
      height_cm: biometrics.height_cm,
      baseline_weight_kg: biometrics.weight_kg,
      baseline_bmi: biometrics.bmi,
    },
    latest: { weight_kg: biometrics.weight_kg, bmi: biometrics.bmi, recorded_at: NOW },
    verification: { sumsub_id: '', identity_verified_at: null, bmi_verified_at: null },
    consents_given: [],
    flags: [],
    status: 'new' as const,
    vip: false,
    coach_id: null,
    intercom_user_id: null,
    created_at: NOW,
    updated_at: NOW,
  };
  MOCK_PATIENTS.push(newPatient);

  const order: Order = {
    id,
    clinic_id,
    patient_id: patientId,
    type: 'new',
    status: 'clinical_check',
    product: { medication: 'Mounjaro', dose: '2.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
    questionnaire_responses: responses,
    amendment_window: 'pre_approval',
    primed_order_id: null,
    primed_clinical_check_completed: false,
    ryft_authorisation_id: null,
    amount_charged: null,
    amount_authorised: 149.00,
    clinical_decision: null,
    sla_warn_at: slaWarnAt,
    sla_breach_at: slaBreachAt,
    g6_flags: [],
    contextual_flags: contextualFlags,
    intervention_raised_at: null,
    px_upload: null,
    px_upload_link: null,
    expired_at: null,
    created_at: NOW,
    updated_at: NOW,
  };

  MOCK_ORDERS.push(order);

  console.log('[AUDIT]', {
    event_type: 'intake_order_created',
    clinic_id,
    order_id: id,
    patient_id: patientId,
    patient_name: `${patient.firstName} ${patient.lastName}`,
    patient_email: patient.email,
    patient_phone: patient.phone,
    sex_at_birth: patient.sex_at_birth,
    address: structuredAddress,
    timestamp: NOW,
  });

  // Task-78 — notify the clinic's clinical-check inbox so staff don't have to
  // poll the queue. Non-blocking: a failed send must not block intake creation.
  try {
    await sendNewIntakeStaffEmail(order, patient);
  } catch (err) {
    console.log('[AUDIT]', {
      event_type: 'new_intake_staff_email_failed',
      clinic_id,
      order_id: id,
      error: err instanceof Error ? err.message : String(err),
      timestamp: NOW,
    });
  }

  // Task-80 — email a tokenised upload link for GLP-1 higher-dose patients so
  // they can finish the prescription upload later (even if they close the tab).
  // The link points at /feeltru/px-upload/<token>; the page POSTs to the
  // existing /px-upload endpoint via the token route.
  if (isGlp1HigherDosePath) {
    try {
      await sendPxUploadLinkEmail(order, patient);
    } catch (err) {
      console.log('[AUDIT]', {
        event_type: 'px_upload_link_email_failed',
        clinic_id,
        order_id: id,
        error: err instanceof Error ? err.message : String(err),
        timestamp: NOW,
      });
      // Non-blocking — the order is still created and the success-screen
      // upload path remains available.
    }
  }

  return order;
}

// ---------------------------------------------------------------------------
// Task-80 — Px upload "complete later" tokenised email link
// ---------------------------------------------------------------------------

const PX_UPLOAD_LINK_TTL_DAYS = 14;

function newPxUploadToken(): string {
  return randomBytes(24).toString('base64url');
}

function appBaseUrl(): string {
  // Prefer an explicit configured URL; otherwise fall back to Replit's dev
  // domain. In tests/Node where neither is set, fall back to a relative path
  // (which still works once the email is rendered in a browser).
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const replit = process.env.REPLIT_DEV_DOMAIN;
  if (replit) return `https://${replit}`;
  return '';
}

// ---------------------------------------------------------------------------
// Task-78 — Staff "new intake" notification
// Fires when createIntakeOrder runs. Sends a short transactional email to
// the clinic's clinical-check inbox linking straight to the order detail page
// so reviewers can act without polling the queue.
// Suppressed in dev/test: postmark.ts mock mode (default LIVERA_POSTMARK_LIVE
// unset) console-logs the call but performs no real HTTP request.
// ---------------------------------------------------------------------------

async function sendNewIntakeStaffEmail(
  order: Order,
  patient: { firstName: string; lastName: string; email: string },
): Promise<void> {
  const clinic = getClinicSync(order.clinic_id);
  const toEmail = clinic.config.clinical_check_inbox;
  if (!toEmail) return;

  const link = `${appBaseUrl()}/${order.clinic_id}/orders/${order.id}`;
  const patientName = `${patient.firstName} ${patient.lastName}`.trim();
  const subject = `New patient intake — ${patientName} (${order.id})`;
  const body =
    `A new patient intake has been submitted for clinical check.\n\n` +
    `Patient: ${patientName}\n` +
    `Patient email: ${patient.email}\n` +
    `Order: ${order.id}\n` +
    `Submitted: ${order.created_at}\n\n` +
    `Open the order to review:\n${link}\n`;

  const result = await sendStaffEmail({
    to_email: toEmail,
    subject,
    text_body: body,
    template: 'new_intake_staff',
  });

  console.log('[AUDIT]', {
    event_type:
      result.status === 'Delivered'
        ? 'new_intake_staff_email_sent'
        : 'new_intake_staff_email_failed',
    outcome: result.status,
    clinic_id: order.clinic_id,
    order_id: order.id,
    to_email: toEmail,
    message_id: result.message_id,
    error_message: result.error_message ?? null,
    timestamp: NOW,
  });
}

async function sendPxUploadLinkEmail(
  order: Order,
  patient: { firstName: string; lastName: string; email: string },
  options: { by_user_id?: string | null } = {},
): Promise<{ status: 'Delivered' | 'Bounced' | 'Failed'; message_id: string | null; error_message: string | null }> {
  const token = newPxUploadToken();
  const expiresAt = new Date(Date.now() + PX_UPLOAD_LINK_TTL_DAYS * 24 * 3600 * 1000).toISOString();
  const link = `${appBaseUrl()}/${order.clinic_id}/px-upload/${token}`;

  // Task-125 — preserve the *original* first-send timestamp across token
  // rotation so dashboards can show "days since first sent" accurately.
  const previousFirstSentAt = order.px_upload_link?.first_sent_at ?? null;
  // Task-178 — preserve every "initial send" + cool-down field across token
  // rotation so the Email-history view still shows the very first attempt
  // (and any prior suppressed attempts) after a resend rotates the link.
  //
  // Legacy backfill: pre-Task-178 link records only carry `sent_at` /
  // `first_sent_at` for the original send. If we just rolled `initial_*`
  // forward as undefined, the post-send stamping below would treat *this*
  // (resend) call as the initial attempt and overwrite the true original
  // timestamp. Backfill from existing link state so the original send
  // metadata survives the first post-Task-178 resend on a legacy record.
  const legacyInitialIso =
    order.px_upload_link?.first_sent_at ?? order.px_upload_link?.sent_at ?? null;
  const previousInitialAttemptedAt =
    order.px_upload_link?.initial_attempted_at
    ?? (legacyInitialIso ?? undefined);
  const previousInitialToEmail =
    order.px_upload_link?.initial_to_email
    ?? (legacyInitialIso ? order.px_upload_link?.to_email : undefined);
  const previousInitialSendStatus =
    order.px_upload_link?.initial_send_status
    // A legacy record only stamps `sent_at` on Delivered (see Task-80), so
    // an existing first_sent_at / sent_at implies the original send landed.
    ?? (legacyInitialIso ? 'Delivered' as const : undefined);
  const previousInitialSendErrorMessage =
    order.px_upload_link?.initial_send_error_message
    ?? (legacyInitialIso ? null : undefined);
  const previousInitialSendByUserId =
    order.px_upload_link?.initial_send_by_user_id
    ?? (legacyInitialIso ? null : undefined);
  const previousResends = order.px_upload_link?.resends ?? [];

  order.px_upload_link = {
    token,
    expires_at: expiresAt,
    sent_at: null,
    first_sent_at: previousFirstSentAt,
    consumed_at: null,
    email_message_id: null,
    to_email: patient.email,
    initial_attempted_at: previousInitialAttemptedAt,
    initial_to_email: previousInitialToEmail,
    initial_send_status: previousInitialSendStatus,
    initial_send_error_message: previousInitialSendErrorMessage,
    initial_send_by_user_id: previousInitialSendByUserId,
    resends: previousResends,
  };

  const subject = 'Action needed: upload your current GLP-1 prescription';
  const body =
    `Hi ${patient.firstName},\n\n` +
    `Thanks for submitting your application to FeelTru (order ${order.id}).\n\n` +
    `Because you're already on a GLP-1 medication and requested a higher starting ` +
    `dose, our prescriber needs to see your current prescription before they can ` +
    `approve your order.\n\n` +
    `Upload your prescription using this secure link:\n${link}\n\n` +
    `The link is unique to your order, can only be used once, and expires on ` +
    `${expiresAt.slice(0, 10)} (${PX_UPLOAD_LINK_TTL_DAYS} days from now).\n\n` +
    `If you already uploaded your prescription from the confirmation screen, you ` +
    `can ignore this email.\n\n` +
    `Thanks,\nThe FeelTru team`;

  const result = await sendPatientEmail({
    to_email: patient.email,
    subject,
    text_body: body,
    template: 'px_upload_link',
  });

  order.px_upload_link.email_message_id = result.message_id;
  // Only record sent_at when Postmark accepted the email — Bounced/Failed
  // results must not show up as "link emailed" on the activity timeline.
  if (result.status === 'Delivered') {
    order.px_upload_link.sent_at = NOW;
    // Task-125 — stamp first_sent_at exactly once, on the first successful
    // delivery. Subsequent resends preserve this value (see previousFirstSentAt).
    if (!order.px_upload_link.first_sent_at) {
      order.px_upload_link.first_sent_at = NOW;
    }
  }

  // Task-178 — Stamp the *first ever* send attempt for this order's px-upload
  // link exactly once. Preserved across token rotation (see preservation
  // block above), so a Bounced first send is still visible in the Email
  // history after staff successfully resend later.
  if (!order.px_upload_link.initial_attempted_at) {
    order.px_upload_link.initial_attempted_at = NOW;
    order.px_upload_link.initial_to_email = patient.email;
    order.px_upload_link.initial_send_status = result.status;
    order.px_upload_link.initial_send_error_message = result.error_message ?? null;
    order.px_upload_link.initial_send_by_user_id = options.by_user_id ?? null;
  }

  console.log('[AUDIT]', {
    event_type:
      result.status === 'Delivered'
        ? 'px_upload_link_email_sent'
        : 'px_upload_link_email_failed',
    outcome: result.status,
    clinic_id: order.clinic_id,
    order_id: order.id,
    to_email: patient.email,
    message_id: result.message_id,
    error_message: result.error_message ?? null,
    expires_at: expiresAt,
    timestamp: NOW,
  });

  return {
    status: result.status,
    message_id: result.message_id,
    error_message: result.error_message ?? null,
  };
}

// ---------------------------------------------------------------------------
// Task-91 — Staff-triggered resend of the Px upload link
// ---------------------------------------------------------------------------

/**
 * Re-issue the prescription upload link for an order whose patient has lost
 * the original email (or whose token has expired). Invalidates the previous
 * token by rotating it, records the resend on the activity timeline, and
 * audits the action under the current staff user.
 *
 * Refuses to send if:
 *   - the order doesn't require a Px upload (no contextual flag set), or
 *   - the patient has already uploaded (`px_upload != null`).
 */
export async function resendPxUploadLink(
  clinic_id: ClinicId,
  order_id: string,
): Promise<Order> {
  await delay(150);
  const order = MOCK_ORDERS.find(
    (o) => o.clinic_id === clinic_id && o.id === order_id,
  );
  if (!order) throw new APIError('NOT_FOUND', `Order ${order_id} not found`);

  if (order.px_upload != null) {
    throw new APIError(
      'INVALID_STATE',
      'Prescription has already been uploaded — no need to resend the link.',
    );
  }

  const pxUploadPending =
    order.contextual_flags?.includes('Px upload pending') ?? false;
  if (!pxUploadPending) {
    throw new APIError(
      'INVALID_STATE',
      'This order does not require a patient prescription upload.',
    );
  }

  const patient = MOCK_PATIENTS.find(
    (p) => p.clinic_id === clinic_id && p.id === order.patient_id,
  );
  if (!patient) {
    throw new APIError('NOT_FOUND', `Patient ${order.patient_id} not found`);
  }

  const previousExpired = order.px_upload_link
    ? new Date(order.px_upload_link.expires_at).getTime() < Date.now()
    : false;
  const previousResends = order.px_upload_link?.resends ?? [];

  // Task-126 — Cool-down to stop accidental double-clicks (or two staff acting
  // in parallel) from rotating the token and emailing the patient again.
  // The most recent send is either the latest resend or the initial email.
  // Task-178 — Failed resends carry sent_at = null; fall back to attempted_at
  // so a bounced resend still trips the cool-down on the next click.
  const lastResendEntry =
    previousResends.length > 0 ? previousResends[previousResends.length - 1] : null;
  const lastSendIso =
    lastResendEntry?.sent_at
    ?? lastResendEntry?.attempted_at
    ?? order.px_upload_link?.sent_at
    ?? null;
  const COOLDOWN_SECONDS = 60;
  if (lastSendIso) {
    const elapsedMs = Date.now() - new Date(lastSendIso).getTime();
    if (elapsedMs >= 0 && elapsedMs < COOLDOWN_SECONDS * 1000) {
      const remainingSeconds = Math.ceil(
        (COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000,
      );
      console.log('[AUDIT]', {
        event_type: 'px_upload_link_resend_suppressed',
        reason: 'cooldown',
        clinic_id,
        order_id,
        by_user_id: CURRENT_USER.id,
        last_sent_at: lastSendIso,
        cooldown_seconds: COOLDOWN_SECONDS,
        remaining_seconds: remainingSeconds,
        timestamp: NOW,
      });
      // Task-178 — Reuse the audit log (per task brief — "no new persistence
      // layer"). We push a `px_upload_link_resend_suppressed` event into the
      // in-memory audit feed so the Email-history view can render the
      // suppressed attempt without inventing a new field on `px_upload_link`.
      recordOrderAuditEvent({
        order_id,
        clinic_id,
        event_type: 'px_upload_link_resend_suppressed',
        actor_user_id: CURRENT_USER.id,
        occurred_at: NOW,
        payload: {
          reason: 'cooldown',
          to_email: order.px_upload_link?.to_email ?? null,
          cooldown_seconds: COOLDOWN_SECONDS,
          remaining_seconds: remainingSeconds,
        },
      });
      throw new APIError(
        'COOLDOWN',
        `A link was just emailed. Please wait ${remainingSeconds}s before resending so the patient isn't spammed.`,
      );
    }
  }

  console.log('[AUDIT]', {
    event_type: 'px_upload_link_resend_requested',
    clinic_id,
    order_id,
    by_user_id: CURRENT_USER.id,
    previous_expired: previousExpired,
    previous_token_prefix: order.px_upload_link?.token.slice(0, 8) ?? null,
    timestamp: NOW,
  });

  // sendPxUploadLinkEmail rotates the token (overwrites order.px_upload_link),
  // so the old token can no longer be used to upload.
  const fullName = patient.demographic.full_name.trim();
  const [firstName, ...rest] = fullName.split(/\s+/);
  const sendResult = await sendPxUploadLinkEmail(
    order,
    {
      firstName: firstName || fullName,
      lastName: rest.join(' '),
      email: patient.contact.email,
    },
    { by_user_id: CURRENT_USER.id },
  );

  if (order.px_upload_link) {
    order.px_upload_link.resends = [
      ...previousResends,
      {
        // Task-178 — `sent_at` mirrors top-level Task-80 semantics: only
        // populated for Delivered sends. Bounced/Failed attempts keep
        // sent_at = null and rely on `attempted_at` + `status` so the
        // Activity timeline and "Most recent resend" copy don't surface
        // them as successful sends.
        sent_at:
          sendResult.status === 'Delivered'
            ? order.px_upload_link.sent_at ?? NOW
            : null,
        attempted_at: NOW,
        to_email: order.px_upload_link.to_email,
        expires_at: order.px_upload_link.expires_at,
        previous_expired: previousExpired,
        by_user_id: CURRENT_USER.id,
        status: sendResult.status,
        error_message: sendResult.error_message ?? null,
      },
    ];
  }
  order.updated_at = NOW;

  return order;
}

// ---------------------------------------------------------------------------
// Task-92 — Scheduled reminder email reusing the original token.
//
// Called by the sendPxUploadReminders job for orders whose patients haven't
// uploaded yet. Two flavours:
//   - 'first' (48h after initial sent_at): friendly nudge.
//   - 'final' (within 24h of expires_at): last-chance, expiry-aware copy.
//
// Both reuse the existing px_upload_link.token so the patient follows the
// same secure URL they already received — no fresh token is minted.
// ---------------------------------------------------------------------------

export async function sendPxUploadReminderEmail(
  order: Order,
  patient: { firstName: string; lastName: string; email: string },
  kind: 'first' | 'final',
): Promise<{ status: 'Delivered' | 'Bounced' | 'Failed'; message_id: string | null; error_message: string | null }> {
  if (!order.px_upload_link) {
    throw new Error(`sendPxUploadReminderEmail: order ${order.id} has no px_upload_link`);
  }

  const link = order.px_upload_link;
  const url  = `${appBaseUrl()}/${order.clinic_id}/px-upload/${link.token}`;

  const subject =
    kind === 'final'
      ? 'Last chance: upload your GLP-1 prescription before the link expires'
      : 'Reminder: upload your GLP-1 prescription to complete your order';

  const intro =
    kind === 'final'
      ? `Your secure upload link expires on ${link.expires_at.slice(0, 10)} — that's less ` +
        `than 24 hours away. Once it expires we can't review your order.`
      : `Just a quick nudge — our prescriber is still waiting for a copy of your ` +
        `current GLP-1 prescription so they can review your order (${order.id}).`;

  const body =
    `Hi ${patient.firstName},\n\n` +
    `${intro}\n\n` +
    `Upload your prescription here:\n${url}\n\n` +
    `The link is the same one we sent before — it's unique to your order, can ` +
    `only be used once, and expires on ${link.expires_at.slice(0, 10)}.\n\n` +
    `If you've already uploaded your prescription, you can safely ignore this ` +
    `email.\n\n` +
    `Thanks,\nThe FeelTru team`;

  const result = await sendPatientEmail({
    to_email:  patient.email,
    subject,
    text_body: body,
    template:  kind === 'final' ? 'px_upload_link_final_reminder' : 'px_upload_link_reminder',
  });

  console.log('[AUDIT]', {
    event_type:
      result.status === 'Delivered'
        ? 'px_upload_link_reminder_sent'
        : 'px_upload_link_reminder_failed',
    outcome:       result.status,
    kind,
    clinic_id:     order.clinic_id,
    order_id:      order.id,
    patient_id:    order.patient_id,
    to_email:      patient.email,
    message_id:    result.message_id,
    error_message: result.error_message ?? null,
    expires_at:    link.expires_at,
    timestamp:     NOW,
  });

  return {
    status:        result.status,
    message_id:    result.message_id,
    error_message: result.error_message ?? null,
  };
}

// ---------------------------------------------------------------------------
// Task-130 — Manual px-upload reminder from Order Detail.
//
// Lets staff nudge a specific patient on demand (e.g. after a phone call)
// without waiting for the daily sendPxUploadReminders sweep. Reuses the same
// email helper and idempotency flags as the cron, so the next scheduled sweep
// won't double-send.
//
// Picks the kind in the same order the cron would:
//   - 'first' if the first-reminder flag is still unset
//   - 'final' if only the final-reminder flag remains unset
//   - throws INVALID_STATE if both reminders have already gone out
//
// Refuses to send if there's no link, the link is consumed/expired, the
// upload has already arrived, or no patient email is on file.
// Audits the staff actor_id (not 'system') on every attempt and outcome.
// ---------------------------------------------------------------------------

export async function sendPxUploadReminderNow(
  clinic_id: ClinicId,
  order_id: string,
  actor?: { user_id: string },
): Promise<{
  order:      Order;
  kind:       'first' | 'final';
  status:     'Delivered' | 'Bounced' | 'Failed';
  message_id: string | null;
}> {
  // Audit records the real caller from the route's session, falling back to
  // CURRENT_USER only for in-process callers (unit tests / scripts).
  const actorUserId = actor?.user_id ?? CURRENT_USER.id;

  console.log('[AUDIT]', {
    event_type: 'px_upload_link_manual_reminder_attempt',
    clinic_id,
    order_id,
    by_user_id: actorUserId,
    timestamp:  NOW,
  });

  await delay(200);

  const order = MOCK_ORDERS.find(
    (o) => o.clinic_id === clinic_id && o.id === order_id,
  );
  if (!order) throw new APIError('NOT_FOUND', `Order ${order_id} not found`);

  const link = order.px_upload_link;
  if (!link) {
    throw new APIError(
      'INVALID_STATE',
      'This order does not have a prescription upload link to remind about.',
    );
  }
  if (order.px_upload != null || link.consumed_at) {
    throw new APIError(
      'INVALID_STATE',
      'Prescription has already been uploaded — no reminder needed.',
    );
  }
  if (new Date(link.expires_at).getTime() <= new Date(NOW).getTime()) {
    throw new APIError(
      'INVALID_STATE',
      'Upload link has expired — send a fresh link instead.',
    );
  }

  let kind: 'first' | 'final';
  if (!link.reminder_sent_at)            kind = 'first';
  else if (!link.final_reminder_sent_at) kind = 'final';
  else {
    throw new APIError(
      'INVALID_STATE',
      'Both reminders have already been sent for this link.',
    );
  }

  const patient = MOCK_PATIENTS.find(
    (p) => p.clinic_id === clinic_id && p.id === order.patient_id,
  );
  const toEmail = patient?.contact.email ?? link.to_email ?? '';
  if (!toEmail) {
    throw new APIError(
      'INVALID_STATE',
      'No patient email on file to send the reminder to.',
    );
  }

  const fullName = patient?.demographic.full_name ?? '';
  const [firstName = 'there', ...rest] = fullName.split(/\s+/).filter(Boolean);
  const lastName = rest.join(' ');

  const sendResult = await sendPxUploadReminderEmail(
    order,
    { firstName, lastName, email: toEmail },
    kind,
  );

  console.log('[AUDIT]', {
    event_type:
      sendResult.status === 'Delivered'
        ? 'px_upload_link_manual_reminder_sent'
        : 'px_upload_link_manual_reminder_failed',
    outcome:    sendResult.status,
    kind,
    clinic_id,
    order_id,
    patient_id: order.patient_id,
    to_email:   toEmail,
    by_user_id: actorUserId,
    message_id: sendResult.message_id,
    timestamp:  NOW,
  });

  if (sendResult.status === 'Delivered') {
    // Same idempotency flag the cron flips, so the next sweep skips this order.
    if (kind === 'first') link.reminder_sent_at = NOW;
    else                  link.final_reminder_sent_at = NOW;
    order.updated_at = NOW;
  }

  return {
    order,
    kind,
    status:     sendResult.status,
    message_id: sendResult.message_id,
  };
}

// ---------------------------------------------------------------------------
// Task-179 — Manual retry of a *failed* px-upload reminder.
//
// Task-129 surfaces Postmark Bounced/Failed reminder attempts on the order
// timeline; previously the only path forward was waiting for the next daily
// cron sweep, which would simply re-fail against the same bad address.
//
// This helper lets staff supply a fresh recipient email and resend the same
// reminder (first or final). It reuses sendPxUploadReminderEmail and the
// same idempotency flags as the cron, so a successful retry stops further
// automated sends. The supplied email is also persisted onto px_upload_link
// (link.to_email) so any subsequent cron sweep for the *final* reminder
// targets the corrected address instead of the original bounced one.
//
// Outcome handling:
//   - Delivered → flip reminder_sent_at / final_reminder_sent_at, update
//                 link.to_email, and let the activity timeline render the
//                 success row alongside the prior failure.
//   - Bounced/Failed → push a new entry onto link.reminder_failures so the
//                      timeline shows another failed attempt with the new
//                      error message; staff can retry again.
//
// Refuses when:
//   - no order / no link / link consumed / link expired
//   - no prior failure of this kind to retry (would otherwise be a
//     duplicate of the cron's first send)
//   - the matching idempotency flag is already set (a successful send for
//     this kind has already landed)
//   - no recipient email supplied
// ---------------------------------------------------------------------------

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function retryFailedPxUploadReminder(
  clinic_id: ClinicId,
  order_id: string,
  args: { kind: 'first' | 'final'; to_email: string },
  actor?: { user_id: string },
): Promise<{
  order:      Order;
  kind:       'first' | 'final';
  status:     'Delivered' | 'Bounced' | 'Failed';
  message_id: string | null;
}> {
  const actorUserId = actor?.user_id ?? CURRENT_USER.id;
  const toEmail     = args.to_email.trim();

  console.log('[AUDIT]', {
    event_type: 'px_upload_link_reminder_retry_attempt',
    clinic_id,
    order_id,
    kind:       args.kind,
    to_email:   toEmail,
    by_user_id: actorUserId,
    timestamp:  NOW,
  });

  if (!toEmail || !EMAIL_PATTERN.test(toEmail)) {
    throw new APIError('INVALID_STATE', 'Please enter a valid recipient email.');
  }

  await delay(200);

  const order = MOCK_ORDERS.find(
    (o) => o.clinic_id === clinic_id && o.id === order_id,
  );
  if (!order) throw new APIError('NOT_FOUND', `Order ${order_id} not found`);

  const link = order.px_upload_link;
  if (!link) {
    throw new APIError(
      'INVALID_STATE',
      'This order does not have a prescription upload link to remind about.',
    );
  }
  if (order.px_upload != null || link.consumed_at) {
    throw new APIError(
      'INVALID_STATE',
      'Prescription has already been uploaded — no reminder needed.',
    );
  }
  if (new Date(link.expires_at).getTime() <= new Date(NOW).getTime()) {
    throw new APIError(
      'INVALID_STATE',
      'Upload link has expired — send a fresh link instead.',
    );
  }

  const alreadySent =
    (args.kind === 'first'  && link.reminder_sent_at != null) ||
    (args.kind === 'final'  && link.final_reminder_sent_at != null);
  if (alreadySent) {
    throw new APIError(
      'INVALID_STATE',
      `The ${args.kind} reminder has already been delivered.`,
    );
  }

  const hasFailureToRetry =
    (link.reminder_failures ?? []).some((f) => f.kind === args.kind);
  if (!hasFailureToRetry) {
    throw new APIError(
      'INVALID_STATE',
      `No failed ${args.kind} reminder on file to retry.`,
    );
  }

  const patient = MOCK_PATIENTS.find(
    (p) => p.clinic_id === clinic_id && p.id === order.patient_id,
  );
  const fullName = patient?.demographic.full_name ?? '';
  const [firstName = 'there', ...rest] = fullName.split(/\s+/).filter(Boolean);
  const lastName = rest.join(' ');

  const sendResult = await sendPxUploadReminderEmail(
    order,
    { firstName, lastName, email: toEmail },
    args.kind,
  );

  console.log('[AUDIT]', {
    event_type:
      sendResult.status === 'Delivered'
        ? 'px_upload_link_reminder_retry_sent'
        : 'px_upload_link_reminder_retry_failed',
    outcome:       sendResult.status,
    kind:          args.kind,
    clinic_id,
    order_id,
    patient_id:    order.patient_id,
    to_email:      toEmail,
    by_user_id:    actorUserId,
    message_id:    sendResult.message_id,
    timestamp:     NOW,
  });

  // Persist the corrected recipient on the link regardless of this
  // attempt's outcome. Staff have explicitly told us the previous
  // address was bad, so future cron sweeps (which now prefer
  // link.to_email — see sendPxUploadReminders) should target the new
  // address even if this immediate resend also failed transiently.
  link.to_email = toEmail;

  if (sendResult.status === 'Delivered') {
    // Flip the idempotency flag the cron uses so future sweeps skip
    // this order for this reminder kind.
    if (args.kind === 'first') link.reminder_sent_at = NOW;
    else                       link.final_reminder_sent_at = NOW;
    order.updated_at = NOW;
  } else {
    // Append a fresh failure entry so the timeline shows the new attempt
    // and its Postmark error alongside the original failure.
    if (!link.reminder_failures) link.reminder_failures = [];
    link.reminder_failures.push({
      kind:          args.kind,
      attempted_at:  NOW,
      to_email:      toEmail,
      status:        sendResult.status,
      error_message: sendResult.error_message ?? null,
    });
    order.updated_at = NOW;
  }

  return {
    order,
    kind:       args.kind,
    status:     sendResult.status,
    message_id: sendResult.message_id,
  };
}

/**
 * Resolve an order from a px-upload link token without consuming it.
 * Used by the patient-facing page to check validity before showing the
 * upload UI. Returns the order plus a status code.
 */
export async function getOrderByPxUploadToken(
  clinic_id: ClinicId,
  token: string,
): Promise<
  | { ok: true; order: Order }
  | { ok: false; reason: 'not_found' | 'expired' | 'consumed' }
> {
  await delay(100);
  const order = MOCK_ORDERS.find(
    (o) => o.clinic_id === clinic_id && o.px_upload_link?.token === token,
  );
  if (!order || !order.px_upload_link) return { ok: false, reason: 'not_found' };
  if (order.px_upload_link.consumed_at) return { ok: false, reason: 'consumed' };
  if (new Date(order.px_upload_link.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, order };
}

/**
 * Consume a px-upload link token and attach the upload to its order.
 * Single-use: marks the token as consumed on success. Reusing a consumed
 * token throws SAFETY_VIOLATION so the patient sees a clear error.
 */
export async function attachPxUploadByToken(
  clinic_id: ClinicId,
  token: string,
  upload: { filename: string; size: number; content_type: string; object_path: string },
): Promise<Order> {
  console.log('[AUDIT]', {
    event_type: 'px_upload_link_attempt',
    clinic_id,
    token_prefix: token.slice(0, 8),
    filename: upload.filename,
    size: upload.size,
    content_type: upload.content_type,
    timestamp: NOW,
  });

  const lookup = await getOrderByPxUploadToken(clinic_id, token);
  if (!lookup.ok) {
    console.log('[AUDIT]', {
      event_type: 'px_upload_link_result',
      outcome: 'safety_violation',
      reason: lookup.reason,
      token_prefix: token.slice(0, 8),
      timestamp: NOW,
    });
    const msg =
      lookup.reason === 'expired'
        ? 'This upload link has expired. Please contact FeelTru for a new link.'
        : lookup.reason === 'consumed'
        ? 'This upload link has already been used. If you need to replace the file, please contact FeelTru.'
        : 'This upload link is not valid.';
    throw new APIError('SAFETY_VIOLATION', msg);
  }

  const order = await attachPxUpload(clinic_id, lookup.order.id, upload, {
    user_id: null,
    source: 'email_link',
  });
  if (order.px_upload_link) order.px_upload_link.consumed_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'px_upload_link_result',
    outcome: 'success',
    clinic_id,
    order_id: order.id,
    token_prefix: token.slice(0, 8),
    timestamp: NOW,
  });

  return order;
}

// ---------------------------------------------------------------------------
// attachPxUpload — Task 61 (GLP-1 higher-dose prescription upload)
// Attaches a patient-uploaded prescription document to an order from the
// intake success screen. Triggered when responses[ft_oq_9]==='yes' AND
// responses[ft_oq_10]==='yes'.
//
// 3-layer safety chain:
//   Layer 1 (UI): file picker scoped to images/PDFs, button hidden otherwise.
//   Layer 2 (here): validate file size + content type; reject anything else.
//   Layer 3 (audit): every attempt + outcome logged under [AUDIT].
// ---------------------------------------------------------------------------

export const PX_UPLOAD_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
export const PX_UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Resolve an order by (clinic_id, order_id) and enforce that it sits on the
 * GLP-1 higher-dose path (the only path that may receive a px upload). Throws
 * an APIError on mismatch — used by both the presigned-URL endpoint and the
 * finalize endpoint so a guessed order_id can't be used to smuggle a file in.
 */
export function findOrderForPxUpload(clinic_id: ClinicId, order_id: string): Order {
  const order = MOCK_ORDERS.find((o) => o.clinic_id === clinic_id && o.id === order_id);
  if (!order) throw new APIError('NOT_FOUND', `Order '${order_id}' not found`);
  const isGlp1HigherDosePath =
    order.questionnaire_responses?.['ft_oq_9'] === 'yes' &&
    order.questionnaire_responses?.['ft_oq_10'] === 'yes';
  if (!isGlp1HigherDosePath) {
    throw new APIError(
      'SAFETY_VIOLATION',
      'Prescription upload is only accepted for GLP-1 higher-dose patients.',
    );
  }
  return order;
}

export async function attachPxUpload(
  clinic_id: ClinicId,
  order_id: string,
  upload: { filename: string; size: number; content_type: string; object_path: string },
  actor?: { user_id: string | null; source: 'success_screen' | 'email_link' | 'staff_upload' },
): Promise<Order> {
  // Task-85 — default to the patient success-screen path (preserves prior behaviour
  // for the patient intake route which doesn't pass actor info).
  const actorSource = actor?.source ?? 'success_screen';
  const actorUserId = actor?.user_id ?? null;

  // Task-119 — Detect replacement of an existing px_upload so the audit log can
  // capture both the file being swapped out and the new uploader. Resolved
  // before the attempt audit fires so the prior metadata is preserved even if
  // validation fails.
  const existingOrder = MOCK_ORDERS.find((o) => o.clinic_id === clinic_id && o.id === order_id);
  const priorUpload = existingOrder?.px_upload ?? null;
  const isReplacement = priorUpload != null;

  console.log('[AUDIT]', {
    event_type: 'px_upload_attempt',
    clinic_id,
    order_id,
    filename: upload.filename,
    size: upload.size,
    content_type: upload.content_type,
    object_path: upload.object_path,
    source: actorSource,
    actor_user_id: actorUserId,
    is_replacement: isReplacement,
    replaced_from: priorUpload
      ? {
          filename: priorUpload.filename,
          size: priorUpload.size,
          content_type: priorUpload.content_type,
          uploaded_at: priorUpload.uploaded_at,
          object_path: priorUpload.object_path,
          source: priorUpload.source ?? null,
          uploaded_by_user_id: priorUpload.uploaded_by_user_id ?? null,
        }
      : null,
    timestamp: NOW,
  });

  await delay(200);

  let order: Order;
  try {
    order = findOrderForPxUpload(clinic_id, order_id);
  } catch (err) {
    const reason = err instanceof APIError && err.code === 'NOT_FOUND'
      ? 'order_not_found'
      : 'not_glp1_higher_dose_path';
    console.log('[AUDIT]', {
      event_type: 'px_upload_result',
      outcome: 'safety_violation',
      reason,
      order_id,
      timestamp: NOW,
    });
    throw err;
  }

  if (!upload.object_path.startsWith('/objects/')) {
    throw new APIError('VALIDATION', 'object_path must start with /objects/');
  }

  if (!PX_UPLOAD_ALLOWED_TYPES.includes(upload.content_type)) {
    console.log('[AUDIT]', {
      event_type: 'px_upload_result',
      outcome: 'safety_violation',
      reason: 'invalid_content_type',
      order_id,
      content_type: upload.content_type,
      timestamp: NOW,
    });
    throw new APIError('INVALID_FILE_TYPE', 'Prescription must be an image (JPG, PNG, WebP, HEIC) or PDF.');
  }

  if (upload.size <= 0 || upload.size > PX_UPLOAD_MAX_BYTES) {
    console.log('[AUDIT]', {
      event_type: 'px_upload_result',
      outcome: 'safety_violation',
      reason: 'invalid_size',
      order_id,
      size: upload.size,
      timestamp: NOW,
    });
    throw new APIError('INVALID_FILE_SIZE', 'Prescription file must be between 1 byte and 10 MB.');
  }

  order.px_upload = {
    filename: upload.filename,
    size: upload.size,
    content_type: upload.content_type,
    uploaded_at: NOW,
    object_path: upload.object_path,
    source: actorSource,
    uploaded_by_user_id: actorUserId,
  };

  // Task-171 — Persist replacement history on the order so the Order Detail
  // UI can render a "Replacement history" without scraping audit logs. We
  // append the prior file's filename plus the new uploader/source/timestamp,
  // mirroring what the [AUDIT] log already captured above. Successive
  // replacements append in chronological order.
  if (isReplacement && priorUpload) {
    order.px_upload_history = [
      ...(order.px_upload_history ?? []),
      {
        replaced_at: NOW,
        replaced_filename: priorUpload.filename,
        replaced_by_user_id: actorUserId,
        replaced_by_source: actorSource,
      },
    ];
  }

  // Surface a contextual flag for the clinical-check queue so prescribers can see
  // at-a-glance that the patient supplied evidence for the higher-dose request.
  const flags = new Set(order.contextual_flags ?? []);
  flags.delete('Px upload pending');
  flags.add('Px upload received');
  order.contextual_flags = Array.from(flags);
  order.updated_at = NOW;

  void recordAudit({
    clinic_id,
    actor: actorUserId
      ? { id: actorUserId, role: actorSource === 'staff_upload' ? 'Admin' : 'patient' }
      : 'system',
    entity: { type: 'order', id: order_id },
    event_type: 'px_upload_attached',
    summary: `Prescription upload ${isReplacement ? 'replaced' : 'attached'} to ${order_id} (${upload.filename}).`,
    before: isReplacement && priorUpload
      ? { filename: priorUpload.filename, size: priorUpload.size }
      : null,
    after: {
      filename: upload.filename,
      size: upload.size,
      content_type: upload.content_type,
      source: actorSource,
    },
  });

  console.log('[AUDIT]', {
    event_type: 'px_upload_result',
    outcome: 'success',
    order_id,
    filename: upload.filename,
    size: upload.size,
    source: actorSource,
    actor_user_id: actorUserId,
    // Task-119 — preserve the prior file metadata on the success audit so
    // reviewers can see what was swapped out alongside the new uploader.
    is_replacement: isReplacement,
    replaced_from: priorUpload
      ? {
          filename: priorUpload.filename,
          size: priorUpload.size,
          content_type: priorUpload.content_type,
          uploaded_at: priorUpload.uploaded_at,
          object_path: priorUpload.object_path,
          source: priorUpload.source ?? null,
          uploaded_by_user_id: priorUpload.uploaded_by_user_id ?? null,
        }
      : null,
    timestamp: NOW,
  });

  return order;
}

export function expireOrderMutation(order: Order): void {
  order.status = 'expired';
  order.expired_at = NOW;
  order.updated_at = NOW;
  console.log('[AUDIT]', {
    event_type:  'order_expired',
    outcome:     'success',
    actor_id:    'system',
    order_id:    order.id,
    clinic_id:   order.clinic_id,
    expired_at:  NOW,
    reason:      '6_day_timeout',
    timestamp:   NOW,
  });
}

// ---------------------------------------------------------------------------
// createAmendment — BLD-5.3 (Wave 4)
// Amendment window enforcement + DEC-28 Pharmacy Comms fork.
// DEC-01: both clinics use pre_dispensed; 403 at dispatched or later.
// Allowed window: clinical_check | on_hold | approved | in_dispensing
// ---------------------------------------------------------------------------

export async function createAmendment(
  clinic_id: ClinicId,
  order_id: string,
  type: 'dose_change' | 'cancellation' | 'refund' | 'reschedule' | 'address_change' | 'dose_escalation',
  reason: string,
): Promise<import('../types').Amendment> {
  // Layer 3 — Audit: log every attempt
  console.log('[AUDIT]', {
    event_type:   'amendment_create_attempt',
    clinic_id,
    order_id,
    amendment_type: type,
    user_id:      CURRENT_USER.id,
    reason,
    timestamp:    NOW,
  });

  await delay(300);

  // Layer 2 — resolve order
  const order = MOCK_ORDERS.find((o) => o.clinic_id === clinic_id && o.id === order_id);
  if (!order) throw new APIError('NOT_FOUND', `Order '${order_id}' not found`);

  // Layer 1+2 — amendment window gate (DEC-01: pre_dispensed for both clinics)
  // Allowed: clinical_check, on_hold (intervention), approved, in_dispensing
  // Closed:  dispatched, delivered, expired, cancelled, declined
  const AMENDMENT_ALLOWED_STATUSES: Order['status'][] = [
    'clinical_check', 'on_hold', 'approved', 'in_dispensing',
  ];
  if (!AMENDMENT_ALLOWED_STATUSES.includes(order.status)) {
    console.log('[AUDIT]', {
      event_type:  'amendment_create_result',
      outcome:     'safety_violation',
      reason:      'amendment_window_expired',
      order_id,
      order_status: order.status,
      user_id:     CURRENT_USER.id,
      timestamp:   NOW,
    });
    throw new APIError(
      'WINDOW_CLOSED',
      `Amendment window closed — order is ${order.status}. Amendments can only be raised before dispatch.`,
    );
  }

  // Build the amendment record
  const { MOCK_AMENDMENTS } = await import('./amendments');
  const amendment: import('../types').Amendment = {
    id: `AMEND-${String(MOCK_AMENDMENTS.length + 1).padStart(3, '0')}`,
    clinic_id,
    order_id,
    type,
    status: 'requested',
    requested_by: { actor_type: 'admin', actor_id: CURRENT_USER.id },
    requested_at: NOW,
    details: { reason },
    decided_by: null,
    decided_at: null,
    decision_rationale: null,
  };
  MOCK_AMENDMENTS.push(amendment);

  // DEC-28 — Pharmacy Comms fork:
  // If Primed clinical check is NOT yet completed → amendment applied directly (no comms needed)
  // If Primed clinical check IS completed → create pharmacy_comm thread; amendment held until Primed approves
  if (order.primed_clinical_check_completed) {
    await createPharmacyCommThread(clinic_id, {
      anchor_type: 'order',
      anchor_id: order_id,
      topic: `amendment_${type}`,
      priority: type === 'cancellation' ? 'urgent' : 'routine',
      body: `Amendment request: ${type}. Reason: ${reason}. Order is post-Primed clinical check — amendment held pending Primed approval (DEC-28).`,
      amendment_id: amendment.id,
    });
    // Mark amendment as reviewing — pending Primed response
    amendment.status = 'reviewing';
    console.log('[AUDIT]', {
      event_type:      'amendment_pharmacy_comms_raised',
      outcome:         'reviewing',
      order_id,
      amendment_id:    amendment.id,
      primed_checked:  true,
      timestamp:       NOW,
    });
  } else {
    // Pre-Primed-check: amendment takes effect immediately
    amendment.status = 'approved';
    amendment.decided_by = 'system';
    amendment.decided_at = NOW;
    amendment.decision_rationale = 'Auto-approved: order is pre-Primed clinical check (DEC-28)';
    console.log('[AUDIT]', {
      event_type:      'amendment_auto_approved',
      outcome:         'approved',
      order_id,
      amendment_id:    amendment.id,
      primed_checked:  false,
      timestamp:       NOW,
    });
  }

  return amendment;
}

// ---------------------------------------------------------------------------
// cancelOrder — Task-38 (Post-approval cancellation & refund flow)
//
// Two-branch behaviour based on Ryft capture state:
//
//   amount_charged === null  → auth held, not captured. Call releaseAuth(),
//                              set status to 'cancelled'. No refund needed.
//
//   amount_charged !== null  → money already taken. Set status to 'cancelled',
//                              create a `type: 'refund'` amendment in `requested`
//                              status, and link refund_amendment_id on the order.
//                              The refund itself is processed later via the
//                              amendment-approval refund panel (refundPayment).
//
// 3-layer safety chain:
//   Layer 1 (UI): "Cancel Order" button hidden unless status ∈ {approved, in_dispensing}
//                 AND no dispatch date.
//   Layer 2 (here): re-validate status + dispatch date; throw SAFETY_VIOLATION on mismatch.
//   Layer 3 (audit): every attempt + outcome logged under [AUDIT].
// ---------------------------------------------------------------------------

const CANCEL_ALLOWED_STATUSES: OrderStatus[] = ['approved', 'in_dispensing'];

export async function cancelOrder(
  clinic_id: ClinicId,
  order_id: string,
  reason: string,
): Promise<{
  order: Order;
  refund_amendment: import('../types').Amendment | null;
  release_auth_failed?: { message: string };
}> {
  console.log('[AUDIT]', {
    event_type: 'order_cancel_attempt',
    clinic_id,
    order_id,
    user_id: CURRENT_USER.id,
    reason,
    timestamp: NOW,
  });

  await delay(300);

  const order = MOCK_ORDERS.find((o) => o.clinic_id === clinic_id && o.id === order_id);
  if (!order) throw new APIError('NOT_FOUND', `Order '${order_id}' not found`);

  if (!CANCEL_ALLOWED_STATUSES.includes(order.status)) {
    console.log('[AUDIT]', {
      event_type: 'order_cancel_result',
      outcome: 'safety_violation',
      reason: 'invalid_status',
      order_id,
      order_status: order.status,
      user_id: CURRENT_USER.id,
      timestamp: NOW,
    });
    throw new APIError(
      'SAFETY_VIOLATION',
      `Order cannot be cancelled — current status is '${order.status}'. Only approved or in_dispensing orders without a dispatch date can be cancelled.`,
    );
  }
  if (order.dispatched_at) {
    console.log('[AUDIT]', {
      event_type: 'order_cancel_result',
      outcome: 'safety_violation',
      reason: 'already_dispatched',
      order_id,
      user_id: CURRENT_USER.id,
      timestamp: NOW,
    });
    throw new APIError(
      'SAFETY_VIOLATION',
      'Order has already been dispatched and cannot be cancelled via Livera. Use the pharmacy courier-recall workflow.',
    );
  }
  if (!reason.trim() || reason.trim().length < 20) {
    throw new APIError(
      'VALIDATION',
      'Cancellation reason is required (minimum 20 characters).',
    );
  }

  // Apply cancellation
  order.status = 'cancelled';
  order.cancelled_at = NOW;
  order.cancellation_reason = reason.trim();
  order.updated_at = NOW;

  // Branch A — auth-release (no money taken)
  if (order.amount_charged == null) {
    let releaseAuthFailed: { message: string } | undefined;
    try {
      if (order.ryft_authorisation_id) {
        await releaseAuth(order.ryft_authorisation_id, order.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      releaseAuthFailed = { message };
      console.log('[AUDIT]', {
        event_type: 'order_cancel_release_auth_failed',
        order_id,
        error: message,
        timestamp: NOW,
      });
      // Order is still flipped to 'cancelled' (clinical intent), but we
      // surface the Ryft failure to operators so finance can manually
      // reconcile / retry the auth release.
    }
    console.log('[AUDIT]', {
      event_type: 'order_cancel_result',
      outcome: releaseAuthFailed ? 'cancelled_release_auth_failed' : 'cancelled_auth_released',
      order_id,
      user_id: CURRENT_USER.id,
      timestamp: NOW,
    });
    void recordAudit({
      clinic_id,
      actor: CURRENT_USER,
      entity: { type: 'order', id: order_id },
      event_type: 'order_cancelled',
      summary: `Order ${order_id} cancelled by ${CURRENT_USER.full_name} (no charge taken).`,
      before: { status: 'approved', amount_charged: null },
      after: {
        status: 'cancelled',
        reason: reason.trim(),
        release_auth_failed: releaseAuthFailed?.message ?? null,
      },
    });

    // Task-49 / Task-65 — auth-release branch: notify the patient that the
    // order was cancelled with no charge. Honours preferred_channel (SMS-first
    // for SMS-preferring patients, with email fallback). Failure does NOT
    // throw — the cancellation itself has already succeeded.
    try {
      const patient = MOCK_PATIENTS.find(
        (p) => p.clinic_id === clinic_id && p.id === order.patient_id,
      );
      const toEmail = patient?.contact.email ?? null;
      const toPhone = patient?.contact.phone ?? null;
      const preferred = patient?.contact.preferred_channel ?? 'email';

      if (!toEmail && !(preferred === 'sms' && toPhone)) {
        console.log('[AUDIT]', {
          event_type: 'patient_cancel_notification_skipped',
          reason: 'no_destination_on_record',
          order_id,
          patient_id: order.patient_id,
          preferred_channel: preferred,
          timestamp: NOW,
        });
      } else {
        const firstName = patient?.demographic.full_name?.split(' ')[0] ?? 'there';
        const subject = `Your order ${order.id} has been cancelled`;
        // When releaseAuth fails operators reconcile manually — don't promise
        // the patient their pre-auth has already dropped off in that case.
        const authCopy = releaseAuthFailed
          ? `No charge has been taken. If you can still see a pending ` +
            `authorisation on your card, it will drop off automatically within ` +
            `a few working days — we won't capture it.`
          : `No charge has been taken — the pre-authorisation on your card ` +
            `has been released and you'll see it disappear from your ` +
            `statement within a few working days.`;
        const emailBody =
          `Hi ${firstName},\n\n` +
          `We've cancelled order ${order.id}. ${authCopy}\n\n` +
          `Reason recorded: ${reason.trim()}\n\n` +
          `If you have any questions, just reply to this email.\n\n` +
          `Thanks,\nThe Livera team`;
        // Task-131 — branded HTML version snapshotted on the envelope and
        // sent to the patient. Plain-text body is kept as the text fallback.
        const emailHtml =
          `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;">` +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 0;"><tr><td align="center">` +
          `<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">` +
          `<tr><td style="background:#0a7e57;padding:20px 28px;color:#ffffff;font-weight:600;font-size:18px;">Livera</td></tr>` +
          `<tr><td style="padding:28px;font-size:15px;line-height:1.55;">` +
          `<p style="margin:0 0 14px;">Hi ${firstName},</p>` +
          `<p style="margin:0 0 14px;">We've cancelled order <strong>${order.id}</strong>. ${authCopy}</p>` +
          `<p style="margin:0 0 14px;"><span style="color:#6b7280;">Reason recorded:</span> ${reason.trim()}</p>` +
          `<p style="margin:0 0 20px;">If you have any questions, just reply to this email.</p>` +
          `<p style="margin:0;color:#6b7280;">Thanks,<br/>The Livera team</p>` +
          `</td></tr></table></td></tr></table></body></html>`;
        const smsBody = releaseAuthFailed
          ? `Livera: order ${order.id} cancelled. No charge taken; any ` +
            `pending pre-auth will drop off within a few working days.`
          : `Livera: order ${order.id} cancelled. No charge taken — your ` +
            `pre-auth has been released.`;

        const { notifications } = await notifyPatient({
          clinic_id,
          patient_id: order.patient_id,
          order_id:   order.id,
          type:       'order_cancelled_no_charge',
          template:   'order_cancelled_no_charge',
          preferred_channel: preferred,
          to_email:   toEmail,
          to_phone:   toPhone,
          email: { subject, body: emailBody, html: emailHtml },
          sms:   { body: smsBody },
          payload: {
            order_id:            order.id,
            reason:              reason.trim(),
            ryft_auth_id:        order.ryft_authorisation_id ?? null,
            release_auth_failed: releaseAuthFailed?.message ?? null,
          },
        });

        for (const notif of notifications) {
          console.log('[AUDIT]', {
            event_type:      'patient_cancel_notification_sent',
            outcome:         notif.status,
            channel:         notif.channel,
            order_id,
            patient_id:      order.patient_id,
            notification_id: notif.id,
            timestamp:       NOW,
          });
        }
      }
    } catch (err) {
      console.log('[AUDIT]', {
        event_type: 'patient_cancel_notification_failed',
        order_id,
        error: err instanceof Error ? err.message : String(err),
        timestamp: NOW,
      });
    }

    return { order, refund_amendment: null, release_auth_failed: releaseAuthFailed };
  }

  // Branch B — captured payment → create refund amendment in 'requested' status
  const { MOCK_AMENDMENTS } = await import('./amendments');
  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === order.patient_id);
  const cardLast4 = (patient && (patient as { card_last4?: string }).card_last4) || '4242';

  const refundAmendment: import('../types').Amendment = {
    id: `AMEND-${String(MOCK_AMENDMENTS.length + 1).padStart(3, '0')}`,
    clinic_id,
    order_id,
    type: 'refund',
    status: 'requested',
    requested_by: { actor_type: 'admin', actor_id: CURRENT_USER.id },
    requested_at: NOW,
    details: {
      reason,
      amount_gbp: order.amount_charged,
      refund_type: 'full',
      card_last4: cardLast4,
      origin: 'order_cancellation',
    },
    decided_by: null,
    decided_at: null,
    decision_rationale: null,
  };
  MOCK_AMENDMENTS.push(refundAmendment);
  order.refund_amendment_id = refundAmendment.id;

  console.log('[AUDIT]', {
    event_type: 'order_cancel_result',
    outcome: 'cancelled_refund_pending',
    order_id,
    amendment_id: refundAmendment.id,
    amount_gbp: order.amount_charged,
    user_id: CURRENT_USER.id,
    timestamp: NOW,
  });

  return { order, refund_amendment: refundAmendment };
}
