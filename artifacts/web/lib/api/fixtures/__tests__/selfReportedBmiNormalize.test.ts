/**
 * Unit tests — normalizeSelfReportedBmiFlag via getOrder / listOrders (Task-163)
 *
 * Verifies that the "Self-reported BMI out of range" contextual flag raised at
 * intake is auto-stripped at read time once the linked patient's BMI photo
 * evidence has been verified (verification.bmi_verified_at is set).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MOCK_ORDERS, getOrder, listOrders } from '../orders';
import { MOCK_PATIENTS } from '../patients';
import { SELF_REPORTED_BMI_FLAG } from '@/lib/clinical/selfReportedBmi';
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

function seedFlaggedOrder(bmiVerifiedAt: string | null): { orderId: string; patientId: string } {
  const baseOrder = MOCK_ORDERS[0];
  const basePatient = MOCK_PATIENTS[0];
  const patientId = `PT-T163-${Date.now()}`;
  const orderId = `ORD-T163-${Date.now()}`;
  MOCK_PATIENTS.push({
    ...structuredClone(basePatient),
    id: patientId,
    verification: { ...basePatient.verification, bmi_verified_at: bmiVerifiedAt },
  });
  MOCK_ORDERS.push({
    ...structuredClone(baseOrder),
    id: orderId,
    patient_id: patientId,
    status: 'clinical_check',
    contextual_flags: ['New intake', 'Awaiting BMI evidence', SELF_REPORTED_BMI_FLAG],
  });
  return { orderId, patientId };
}

describe('normalizeSelfReportedBmiFlag', () => {
  it('keeps the flag on getOrder when BMI evidence is not yet verified', async () => {
    const { orderId } = seedFlaggedOrder(null);
    const o = await getOrder(MOCK_ORDERS[0].clinic_id, orderId);
    expect(o.contextual_flags).toContain(SELF_REPORTED_BMI_FLAG);
  });

  it('drops both BMI-evidence flags on getOrder once verified, but leaves unrelated flags', async () => {
    const { orderId } = seedFlaggedOrder('2026-05-18T10:00:00Z');
    const o = await getOrder(MOCK_ORDERS[0].clinic_id, orderId);
    // Task-247 — both BMI gates auto-clear after a prescriber confirms.
    expect(o.contextual_flags).not.toContain(SELF_REPORTED_BMI_FLAG);
    expect(o.contextual_flags).not.toContain('Awaiting BMI evidence');
    // Unrelated flags survive
    expect(o.contextual_flags).toEqual(expect.arrayContaining(['New intake']));
  });

  it('drops the flag on listOrders for verified patients', async () => {
    const { orderId } = seedFlaggedOrder('2026-05-18T10:00:00Z');
    const all = await listOrders(MOCK_ORDERS[0].clinic_id);
    const o = all.find((x) => x.id === orderId);
    expect(o).toBeDefined();
    expect(o!.contextual_flags).not.toContain(SELF_REPORTED_BMI_FLAG);
  });
});
