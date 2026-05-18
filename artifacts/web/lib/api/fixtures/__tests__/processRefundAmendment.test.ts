/**
 * Unit tests — processRefundAmendment() (Task-38)
 *
 * Covers Task-51 unit coverage requirements:
 *   - Rejects users without can_refund (refund-authority gate)
 *   - Validates amount bounds (> 0, <= amount_charged/authorised; partial >= £1)
 *   - Stores ryft_refund_ref + refunded_amount_gbp on successful refunds
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { processRefundAmendment } from '../amendments';
import { MOCK_AMENDMENTS } from '../amendments';
import { MOCK_ORDERS } from '../orders';
import { CURRENT_USER } from '../../constants';
import type { Amendment, Order } from '../../types';

const originalCanRefund = CURRENT_USER.can_refund;
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
  CURRENT_USER.can_refund = true;
});

afterAll(() => {
  CURRENT_USER.can_refund = originalCanRefund;
});

// Fixture: AMEND-003 is the seeded refund amendment on ORD-00450 (£179, requested).
const REFUND_AMENDMENT_ID = 'AMEND-003';
const CLINIC = 'feeltru';

describe('processRefundAmendment() — refund authority gate', () => {
  it('throws FORBIDDEN when the user does not have can_refund', async () => {
    CURRENT_USER.can_refund = false;
    await expect(
      processRefundAmendment(CLINIC, REFUND_AMENDMENT_ID, {
        decision: 'approve',
        refund_type: 'full',
        amount_gbp: 179,
        reason: 'dispensing_fee',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('processRefundAmendment() — amount validation', () => {
  it('rejects a non-positive amount', async () => {
    await expect(
      processRefundAmendment(CLINIC, REFUND_AMENDMENT_ID, {
        decision: 'approve',
        refund_type: 'partial',
        amount_gbp: 0,
        reason: 'partial_use',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects an amount greater than the captured charge', async () => {
    await expect(
      processRefundAmendment(CLINIC, REFUND_AMENDMENT_ID, {
        decision: 'approve',
        refund_type: 'partial',
        amount_gbp: 999,
        reason: 'partial_use',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects partial refunds below the £1 minimum', async () => {
    await expect(
      processRefundAmendment(CLINIC, REFUND_AMENDMENT_ID, {
        decision: 'approve',
        refund_type: 'partial',
        amount_gbp: 0.5,
        reason: 'partial_use',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('processRefundAmendment() — approve path', () => {
  it('stores ryft_refund_ref + refunded_amount_gbp and marks the amendment applied', async () => {
    const updated = await processRefundAmendment(CLINIC, REFUND_AMENDMENT_ID, {
      decision: 'approve',
      refund_type: 'full',
      amount_gbp: 179,
      reason: 'dispensing_fee',
    });

    expect(updated.status).toBe('applied');
    expect(updated.decided_by).toBe(CURRENT_USER.id);
    expect(updated.decided_at).toBeTruthy();
    expect(updated.details.refund_type).toBe('full');
    expect(updated.details.refund_reason_code).toBe('dispensing_fee');
    expect(updated.details.refunded_amount_gbp).toBe(179);
    expect(typeof updated.details.ryft_refund_ref).toBe('string');
    expect(updated.details.ryft_refund_ref).toContain('ryft_ref_');
  });

  it('records a partial refund with the chosen amount', async () => {
    const updated = await processRefundAmendment(CLINIC, REFUND_AMENDMENT_ID, {
      decision: 'approve',
      refund_type: 'partial',
      amount_gbp: 50,
      reason: 'partial_use',
    });

    expect(updated.status).toBe('applied');
    expect(updated.details.refund_type).toBe('partial');
    expect(updated.details.refunded_amount_gbp).toBe(50);
  });
});

describe('processRefundAmendment() — reject path', () => {
  it('requires a rationale when rejecting', async () => {
    await expect(
      processRefundAmendment(CLINIC, REFUND_AMENDMENT_ID, {
        decision: 'reject',
        rationale: '   ',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('marks the amendment rejected with the stored rationale', async () => {
    const updated = await processRefundAmendment(CLINIC, REFUND_AMENDMENT_ID, {
      decision: 'reject',
      rationale: 'Outside policy — patient retained product for full course.',
    });

    expect(updated.status).toBe('rejected');
    expect(updated.decision_rationale).toContain('Outside policy');
    expect(updated.decided_by).toBe(CURRENT_USER.id);
  });
});
