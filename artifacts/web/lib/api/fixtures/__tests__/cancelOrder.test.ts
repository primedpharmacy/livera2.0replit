/**
 * Unit tests — cancelOrder() (Task-38)
 *
 * Covers Task-51 unit coverage requirements:
 *   - Branches on amount_charged (auth release vs refund amendment)
 *   - Validates status (only approved / in_dispensing, not dispatched)
 *   - Validates cancellation reason length (>= 20 chars)
 *   - Creates a refund amendment linked back to the order on captured orders
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { cancelOrder, MOCK_ORDERS } from '../orders';
import { MOCK_AMENDMENTS } from '../amendments';
import type { Order, Amendment } from '../../types';
import { APIError } from '../../constants';

// ── Snapshot/restore helpers ────────────────────────────────────────────────
// cancelOrder mutates MOCK_ORDERS and MOCK_AMENDMENTS in place, so each test
// runs against a deep-cloned baseline that is restored before every case.

let ordersSnapshot: Order[];
let amendmentsSnapshot: Amendment[];

function snapshot() {
  ordersSnapshot = MOCK_ORDERS.map((o) => structuredClone(o));
  amendmentsSnapshot = MOCK_AMENDMENTS.map((a) => structuredClone(a));
}

function restore() {
  MOCK_ORDERS.splice(0, MOCK_ORDERS.length, ...ordersSnapshot.map((o) => structuredClone(o)));
  MOCK_AMENDMENTS.splice(0, MOCK_AMENDMENTS.length, ...amendmentsSnapshot.map((a) => structuredClone(a)));
}

snapshot();

beforeEach(() => {
  restore();
});

// ── Fixtures used directly by the tests ─────────────────────────────────────
// JAMES_ORDER_VSC (ORD-00438): approved + amount_charged=179 → refund branch
// MIRIAM_ORDER_VSC (ORD-00422): clinical_check + no charge → safety violation
// EMMA_ORDER_FEELTRU (ORD-00447): dispatched → safety violation
const APPROVED_CAPTURED_ID = 'ORD-00438';
const CLINICAL_CHECK_ID    = 'ORD-00422';
const DISPATCHED_ID        = 'ORD-00447';
const VALID_REASON         = 'Patient requested cancellation due to relocation overseas.';

describe('cancelOrder() — status validation', () => {
  it('throws SAFETY_VIOLATION when the order is not approved or in_dispensing', async () => {
    await expect(cancelOrder('vsc', CLINICAL_CHECK_ID, VALID_REASON))
      .rejects.toMatchObject({ code: 'SAFETY_VIOLATION' });
  });

  it('throws SAFETY_VIOLATION when the order has already been dispatched', async () => {
    // Flip Emma's order to in_dispensing so the *status* check passes and we
    // hit the dispatched_at guard specifically.
    const emma = MOCK_ORDERS.find((o) => o.id === DISPATCHED_ID)!;
    emma.status = 'in_dispensing';
    await expect(cancelOrder('feeltru', DISPATCHED_ID, VALID_REASON))
      .rejects.toMatchObject({ code: 'SAFETY_VIOLATION', message: expect.stringContaining('dispatched') });
  });

  it('throws NOT_FOUND for an unknown order id', async () => {
    await expect(cancelOrder('vsc', 'ORD-DOES-NOT-EXIST', VALID_REASON))
      .rejects.toBeInstanceOf(APIError);
  });
});

describe('cancelOrder() — reason validation', () => {
  it('rejects an empty reason', async () => {
    await expect(cancelOrder('vsc', APPROVED_CAPTURED_ID, '   '))
      .rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects a reason shorter than 20 characters', async () => {
    await expect(cancelOrder('vsc', APPROVED_CAPTURED_ID, 'too short'))
      .rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('cancelOrder() — auth-release branch (amount_charged == null)', () => {
  it('cancels without creating a refund amendment when no payment was captured', async () => {
    // Build a fresh captured-free approved order so we can verify the branch
    // without depending on seed mutability.
    const order: Order = {
      ...MOCK_ORDERS.find((o) => o.id === APPROVED_CAPTURED_ID)!,
      id: 'ORD-TEST-AUTH',
      amount_charged: null,
      status: 'approved',
      dispatched_at: undefined,
      refund_amendment_id: undefined,
    };
    MOCK_ORDERS.push(order);

    const beforeAmendmentCount = MOCK_AMENDMENTS.length;
    const result = await cancelOrder(order.clinic_id, order.id, VALID_REASON);

    expect(result.order.status).toBe('cancelled');
    expect(result.order.cancelled_at).toBeTruthy();
    expect(result.order.cancellation_reason).toBe(VALID_REASON);
    expect(result.refund_amendment).toBeNull();
    expect(result.order.refund_amendment_id).toBeUndefined();
    expect(MOCK_AMENDMENTS.length).toBe(beforeAmendmentCount);
  });
});

describe('cancelOrder() — refund-amendment branch (amount_charged != null)', () => {
  it('flips the order to cancelled and creates a linked refund amendment', async () => {
    const beforeAmendmentCount = MOCK_AMENDMENTS.length;

    const result = await cancelOrder('vsc', APPROVED_CAPTURED_ID, VALID_REASON);

    expect(result.order.status).toBe('cancelled');
    expect(result.order.cancelled_at).toBeTruthy();
    expect(result.order.cancellation_reason).toBe(VALID_REASON);
    expect(result.refund_amendment).not.toBeNull();

    const amend = result.refund_amendment!;
    expect(amend.type).toBe('refund');
    expect(amend.status).toBe('requested');
    expect(amend.order_id).toBe(APPROVED_CAPTURED_ID);
    expect(amend.details.amount_gbp).toBe(179);
    expect(amend.details.refund_type).toBe('full');
    expect(amend.details.origin).toBe('order_cancellation');

    expect(result.order.refund_amendment_id).toBe(amend.id);
    expect(MOCK_AMENDMENTS.length).toBe(beforeAmendmentCount + 1);
    expect(MOCK_AMENDMENTS.some((a) => a.id === amend.id)).toBe(true);
  });
});
