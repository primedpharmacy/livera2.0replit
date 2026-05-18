/**
 * Unit tests — confirmBmiEvidence / rejectBmiEvidence (Task-247)
 *
 * Verifies that the prescriber-facing BMI photo review actions:
 *   - Set / clear `verification.bmi_verified_at` on the patient
 *   - Cause `normalizeSelfReportedBmiFlag` to drop the
 *     "Self-reported BMI out of range" flag at the next order read
 *   - Refuse the action for non-prescriber actors (SAFETY_VIOLATION)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MOCK_ORDERS, getOrder } from '../orders';
import {
  MOCK_PATIENTS,
  confirmBmiEvidence,
  rejectBmiEvidence,
} from '../patients';
import { SELF_REPORTED_BMI_FLAG } from '@/lib/clinical/selfReportedBmi';
import { USERS_REGISTRY, APIError } from '../../constants';
import type { Order, Patient } from '../../types';

let ordersSnapshot: Order[];
let patientsSnapshot: Patient[];

beforeEach(() => {
  ordersSnapshot = MOCK_ORDERS.map((o) => structuredClone(o));
  patientsSnapshot = MOCK_PATIENTS.map((p) => structuredClone(p));
});

afterEach(() => {
  MOCK_ORDERS.splice(0, MOCK_ORDERS.length, ...ordersSnapshot.map((o) => structuredClone(o)));
  MOCK_PATIENTS.splice(0, MOCK_PATIENTS.length, ...patientsSnapshot.map((p) => structuredClone(p)));
});

function seedUnverifiedFlaggedOrder(): { orderId: string; patientId: string; clinicId: Order['clinic_id'] } {
  const baseOrder = MOCK_ORDERS[0];
  const basePatient = MOCK_PATIENTS[0];
  const patientId = `PT-T247-${Date.now()}`;
  const orderId = `ORD-T247-${Date.now()}`;
  MOCK_PATIENTS.push({
    ...structuredClone(basePatient),
    id: patientId,
    verification: { ...basePatient.verification, bmi_verified_at: null },
  });
  MOCK_ORDERS.push({
    ...structuredClone(baseOrder),
    id: orderId,
    patient_id: patientId,
    status: 'clinical_check',
    contextual_flags: ['Awaiting BMI evidence', SELF_REPORTED_BMI_FLAG],
  });
  return { orderId, patientId, clinicId: baseOrder.clinic_id };
}

// Pick a prescriber from the user registry so the permission check passes.
const PRESCRIBER = Object.values(USERS_REGISTRY).find((u) =>
  u.roles.includes('Prescriber'),
)!;
const COACH = Object.values(USERS_REGISTRY).find((u) =>
  u.roles.includes('Coach') && !u.roles.includes('Prescriber'),
)!;

function seedAwaitingOnlyOrder(): { orderId: string; patientId: string; clinicId: Order['clinic_id'] } {
  const baseOrder = MOCK_ORDERS[0];
  const basePatient = MOCK_PATIENTS[0];
  const patientId = `PT-T247B-${Date.now()}`;
  const orderId = `ORD-T247B-${Date.now()}`;
  MOCK_PATIENTS.push({
    ...structuredClone(basePatient),
    id: patientId,
    verification: { ...basePatient.verification, bmi_verified_at: null },
  });
  MOCK_ORDERS.push({
    ...structuredClone(baseOrder),
    id: orderId,
    patient_id: patientId,
    status: 'clinical_check',
    // Only the intake gate — no self-reported BMI flag. Common case for
    // normal-BMI intake orders.
    contextual_flags: ['Awaiting BMI evidence'],
  });
  return { orderId, patientId, clinicId: baseOrder.clinic_id };
}

describe('confirmBmiEvidence', () => {
  it('clears "Awaiting BMI evidence" when it is the only BMI flag present', async () => {
    const { orderId, patientId, clinicId } = seedAwaitingOnlyOrder();
    await confirmBmiEvidence(clinicId, patientId, PRESCRIBER);
    const order = await getOrder(clinicId, orderId);
    expect(order.contextual_flags).not.toContain('Awaiting BMI evidence');
  });

  it('sets verification.bmi_verified_at and clears both BMI-evidence flags at next read', async () => {
    const { orderId, patientId, clinicId } = seedUnverifiedFlaggedOrder();
    const updated = await confirmBmiEvidence(clinicId, patientId, PRESCRIBER);
    expect(updated.verification.bmi_verified_at).toBeTruthy();

    const order = await getOrder(clinicId, orderId);
    // Task-247 — both gates clear in lockstep after a prescriber signs off.
    expect(order.contextual_flags).not.toContain(SELF_REPORTED_BMI_FLAG);
    expect(order.contextual_flags).not.toContain('Awaiting BMI evidence');
  });

  it('throws SAFETY_VIOLATION when actor lacks decide/orders permission', async () => {
    const { patientId, clinicId } = seedUnverifiedFlaggedOrder();
    await expect(confirmBmiEvidence(clinicId, patientId, COACH)).rejects.toBeInstanceOf(APIError);
  });
});

describe('rejectBmiEvidence', () => {
  it('restores both BMI gate flags after the real confirm → read → reject → read sequence', async () => {
    const { orderId, patientId, clinicId } = seedUnverifiedFlaggedOrder();

    await confirmBmiEvidence(clinicId, patientId, PRESCRIBER);
    // Read between confirm and reject the same way the UI does — this is
    // the scenario that previously broke when normalisation mutated the
    // fixture in place (Task-247 reviewer feedback).
    const afterConfirm = await getOrder(clinicId, orderId);
    expect(afterConfirm.contextual_flags).not.toContain(SELF_REPORTED_BMI_FLAG);
    expect(afterConfirm.contextual_flags).not.toContain('Awaiting BMI evidence');

    const rejected = await rejectBmiEvidence(clinicId, patientId, PRESCRIBER);
    expect(rejected.verification.bmi_verified_at).toBeNull();

    const afterReject = await getOrder(clinicId, orderId);
    expect(afterReject.contextual_flags).toContain(SELF_REPORTED_BMI_FLAG);
    expect(afterReject.contextual_flags).toContain('Awaiting BMI evidence');
  });

  it('throws SAFETY_VIOLATION when actor lacks decide/orders permission', async () => {
    const { patientId, clinicId } = seedUnverifiedFlaggedOrder();
    await expect(rejectBmiEvidence(clinicId, patientId, COACH)).rejects.toBeInstanceOf(APIError);
  });
});
