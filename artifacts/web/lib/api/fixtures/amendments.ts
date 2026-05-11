/**
 * Livera amendment fixtures — extracted from mock.ts (Mini-wave 6a cleanup).
 * DEC-38: refunds flow through amendments, not tasks.
 * Contains: MOCK_AMENDMENTS, listAmendments, getAmendment, decideAmendment.
 */

import type { ClinicId, Amendment } from '../types';
import { delay, APIError, scopedToClinic, CURRENT_USER } from '../constants';
import { MOCK_ORDERS } from './orders';
import { MOCK_PATIENTS } from './patients';

export const MOCK_AMENDMENTS: Amendment[] = [
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

export async function listAmendments(
  clinic_id: ClinicId,
  opts?: { status?: Amendment['status']; type?: Amendment['type'] }
): Promise<Amendment[]> {
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
