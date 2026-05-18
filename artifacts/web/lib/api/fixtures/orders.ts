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
import { createGPLetter } from './gpLetters'; // CLARIFY-1 (Wave 5) — auto-trigger on approval
import { releaseAuth } from '@/lib/integrations/ryft'; // Task-38 — auth-release branch
import { notifyPatient } from '@/lib/integrations/patientNotify'; // Task-49 + Task-65
import { sendPatientEmail } from '@/lib/integrations/postmark'; // Task-80 — px-upload email link
import { randomBytes } from 'crypto';

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

export const MOCK_ORDERS: Order[] = [
  SARAH_ORDER_FEELTRU, SARAH_ORDER_VSC,
  JAMES_ORDER_VSC, MIRIAM_ORDER_VSC,
  EMMA_ORDER_FEELTRU, ZARA_ORDER_FEELTRU,
  HELEN_ORDER_FEELTRU_INTERVENTION,
  NINA_ORDER_VSC_EXPIRED,
  PRIYA_ORDER_FEELTRU_CANCELLED,
];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listOrders(
  clinic_id: ClinicId,
  opts?: { status?: OrderStatus; patient_id?: string }
): Promise<Order[]> {
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
// reverseDecision — Task-71: Undo a clinical decision within the toast window.
// Restores the order to 'clinical_check' so it pops back into the queue.
// Side-effects from the original decision (auto-triggered GP letter, clinical
// note) are intentionally left in place — clinicians can address those via the
// normal flows. The audit log captures the reversal for traceability.
// ---------------------------------------------------------------------------

export async function reverseDecision(
  clinic_id: ClinicId,
  id: string,
): Promise<Order> {
  await delay(200);
  const o = MOCK_ORDERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!o) throw new APIError('NOT_FOUND', 'Order not found');
  if (!o.clinical_decision) {
    throw new APIError('VALIDATION', 'No decision to reverse on this order');
  }
  const prior = o.clinical_decision.decision;
  o.clinical_decision = null;
  o.intervention_raised_at = null;
  o.status = 'clinical_check';
  o.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'clinical_decision_reversed',
    clinic_id,
    order_id: id,
    prior_decision: prior,
    user_id: CURRENT_USER.id,
    timestamp: NOW,
  });

  return o;
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
  patient: { firstName: string; lastName: string; email: string; dob: string },
  address: string,
  responses: Record<string, unknown>,
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

  // Task-60 — register a minimal Patient record so the order detail page
  // (which calls getPatient) resolves a real patient with a display name.
  // Address is stored as line1 only — the intake form sends a single
  // formatted address string, and we don't parse it back into components.
  const newPatient = {
    id: patientId,
    clinic_id,
    demographic: {
      full_name: `${patient.firstName} ${patient.lastName}`.trim(),
      dob: patient.dob,
      sex_at_birth: 'female' as const,
      ethnicity: 'Not stated',
      address: { line1: address || 'Not provided', city: '', postcode: '' },
    },
    contact: { email: patient.email, phone: '', preferred_channel: 'email' as const },
    gp: null,
    baseline: { height_cm: 0, baseline_weight_kg: 0, baseline_bmi: 0 },
    latest:   { weight_kg: 0, bmi: 0, recorded_at: NOW },
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
    address,
    timestamp: NOW,
  });

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

async function sendPxUploadLinkEmail(
  order: Order,
  patient: { firstName: string; lastName: string; email: string },
): Promise<void> {
  const token = newPxUploadToken();
  const expiresAt = new Date(Date.now() + PX_UPLOAD_LINK_TTL_DAYS * 24 * 3600 * 1000).toISOString();
  const link = `${appBaseUrl()}/${order.clinic_id}/px-upload/${token}`;

  order.px_upload_link = {
    token,
    expires_at: expiresAt,
    sent_at: null,
    consumed_at: null,
    email_message_id: null,
    to_email: patient.email,
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
  upload: { filename: string; size: number; content_type: string; data_url?: string },
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

  const order = await attachPxUpload(clinic_id, lookup.order.id, upload);
  if (order.px_upload) order.px_upload.source = 'email_link';
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

const PX_UPLOAD_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const PX_UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const PX_UPLOAD_INLINE_DATA_URL_LIMIT = 2 * 1024 * 1024; // 2 MB — keep mock store light

export async function attachPxUpload(
  clinic_id: ClinicId,
  order_id: string,
  upload: { filename: string; size: number; content_type: string; data_url?: string },
): Promise<Order> {
  console.log('[AUDIT]', {
    event_type: 'px_upload_attempt',
    clinic_id,
    order_id,
    filename: upload.filename,
    size: upload.size,
    content_type: upload.content_type,
    timestamp: NOW,
  });

  await delay(200);

  const order = MOCK_ORDERS.find((o) => o.clinic_id === clinic_id && o.id === order_id);
  if (!order) throw new APIError('NOT_FOUND', `Order '${order_id}' not found`);

  // Layer 2 — only accept uploads for orders on the GLP-1 higher-dose path.
  // Anything else is rejected so a guessed order_id can't be used to attach files.
  const isGlp1HigherDosePath =
    order.questionnaire_responses?.['ft_oq_9'] === 'yes' &&
    order.questionnaire_responses?.['ft_oq_10'] === 'yes';
  if (!isGlp1HigherDosePath) {
    console.log('[AUDIT]', {
      event_type: 'px_upload_result',
      outcome: 'safety_violation',
      reason: 'not_glp1_higher_dose_path',
      order_id,
      timestamp: NOW,
    });
    throw new APIError(
      'SAFETY_VIOLATION',
      'Prescription upload is only accepted for GLP-1 higher-dose patients.',
    );
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
    data_url: upload.size <= PX_UPLOAD_INLINE_DATA_URL_LIMIT ? upload.data_url : undefined,
  };

  // Surface a contextual flag for the clinical-check queue so prescribers can see
  // at-a-glance that the patient supplied evidence for the higher-dose request.
  const flags = new Set(order.contextual_flags ?? []);
  flags.delete('Px upload pending');
  flags.add('Px upload received');
  order.contextual_flags = Array.from(flags);
  order.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'px_upload_result',
    outcome: 'success',
    order_id,
    filename: upload.filename,
    size: upload.size,
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
          email: { subject, body: emailBody },
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
