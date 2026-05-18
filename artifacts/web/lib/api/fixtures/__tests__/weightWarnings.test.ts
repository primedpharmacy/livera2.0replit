/**
 * Unit tests — weight-warning acknowledgement flow (Task-99 + Task-135)
 *
 * Covers Task-190:
 *   - acknowledgeWeightWarning happy path + validation (short rationale,
 *     duplicate active acknowledgement, unknown order)
 *   - editWeightWarningAcknowledgement appends an edit record while
 *     preserving the original rationale; rejects unchanged / short text
 *   - undoWeightWarningAcknowledgement stamps the row as reversed without
 *     dropping it, and re-acknowledging appends a fresh entry
 *   - Append-only invariant: edits, undos and re-acknowledgements all leave
 *     the prior history in place so the timeline can replay every step
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  acknowledgeWeightWarning,
  editWeightWarningAcknowledgement,
  undoWeightWarningAcknowledgement,
  MOCK_ORDERS,
} from '../orders';
import { CURRENT_USER } from '../../constants';
import type { Order } from '../../types';

const TARGET_ORDER_ID = 'ORD-00438';
const TARGET_CLINIC = 'vsc';

let ordersSnapshot: Order[];

function snapshot() {
  ordersSnapshot = MOCK_ORDERS.map((o) => structuredClone(o));
}

function restore() {
  MOCK_ORDERS.splice(
    0,
    MOCK_ORDERS.length,
    ...ordersSnapshot.map((o) => structuredClone(o)),
  );
}

snapshot();

beforeEach(() => {
  restore();
  // Always start with a clean slate on the target order so each test owns the
  // acknowledgement history it creates.
  const o = MOCK_ORDERS.find((x) => x.id === TARGET_ORDER_ID)!;
  o.weight_warning_acknowledgements = [];
});

function getOrder(): Order {
  return MOCK_ORDERS.find((x) => x.id === TARGET_ORDER_ID)!;
}

describe('acknowledgeWeightWarning()', () => {
  it('appends a new acknowledgement entry with the actor + rationale', async () => {
    const updated = await acknowledgeWeightWarning(
      TARGET_CLINIC,
      TARGET_ORDER_ID,
      'plateau',
      'Patient stable on review, continuing plan.',
    );
    const entries = updated.weight_warning_acknowledgements ?? [];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'plateau',
      acknowledged_by_user_id: CURRENT_USER.id,
      rationale: 'Patient stable on review, continuing plan.',
    });
  });

  it('rejects rationales shorter than 3 characters', async () => {
    await expect(
      acknowledgeWeightWarning(TARGET_CLINIC, TARGET_ORDER_ID, 'plateau', '  a '),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(getOrder().weight_warning_acknowledgements).toEqual([]);
  });

  it('rejects acknowledging the same kind twice while an active entry exists', async () => {
    await acknowledgeWeightWarning(
      TARGET_CLINIC,
      TARGET_ORDER_ID,
      'plateau',
      'First acknowledgement.',
    );
    await expect(
      acknowledgeWeightWarning(
        TARGET_CLINIC,
        TARGET_ORDER_ID,
        'plateau',
        'Second acknowledgement.',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(getOrder().weight_warning_acknowledgements).toHaveLength(1);
  });

  it('throws NOT_FOUND when the order does not exist', async () => {
    await expect(
      acknowledgeWeightWarning(TARGET_CLINIC, 'ORD-DOES-NOT-EXIST', 'plateau', 'Reviewed.'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('editWeightWarningAcknowledgement()', () => {
  beforeEach(async () => {
    await acknowledgeWeightWarning(
      TARGET_CLINIC,
      TARGET_ORDER_ID,
      'plateau',
      'Original rationale here.',
    );
  });

  it('updates the rationale and appends an edit record with the previous text', async () => {
    const updated = await editWeightWarningAcknowledgement(
      TARGET_CLINIC,
      TARGET_ORDER_ID,
      'plateau',
      'Updated rationale after further review.',
    );
    const entry = (updated.weight_warning_acknowledgements ?? [])[0];
    expect(entry.rationale).toBe('Updated rationale after further review.');
    expect(entry.edits).toHaveLength(1);
    expect(entry.edits![0]).toMatchObject({
      previous_rationale: 'Original rationale here.',
      new_rationale: 'Updated rationale after further review.',
      edited_by_user_id: CURRENT_USER.id,
    });
  });

  it('preserves prior edits when the rationale is amended a second time', async () => {
    await editWeightWarningAcknowledgement(
      TARGET_CLINIC,
      TARGET_ORDER_ID,
      'plateau',
      'First edit.',
    );
    const updated = await editWeightWarningAcknowledgement(
      TARGET_CLINIC,
      TARGET_ORDER_ID,
      'plateau',
      'Second edit.',
    );
    const entry = (updated.weight_warning_acknowledgements ?? [])[0];
    expect(entry.edits).toHaveLength(2);
    expect(entry.edits![0].previous_rationale).toBe('Original rationale here.');
    expect(entry.edits![1].previous_rationale).toBe('First edit.');
    expect(entry.rationale).toBe('Second edit.');
  });

  it('rejects an empty/short new rationale', async () => {
    await expect(
      editWeightWarningAcknowledgement(TARGET_CLINIC, TARGET_ORDER_ID, 'plateau', ' '),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects an unchanged rationale', async () => {
    await expect(
      editWeightWarningAcknowledgement(
        TARGET_CLINIC,
        TARGET_ORDER_ID,
        'plateau',
        'Original rationale here.',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects editing when there is no active acknowledgement for the kind', async () => {
    await expect(
      editWeightWarningAcknowledgement(
        TARGET_CLINIC,
        TARGET_ORDER_ID,
        'rapid_loss',
        'New rationale.',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('undoWeightWarningAcknowledgement()', () => {
  beforeEach(async () => {
    await acknowledgeWeightWarning(
      TARGET_CLINIC,
      TARGET_ORDER_ID,
      'plateau',
      'Original rationale here.',
    );
  });

  it('stamps the row as reversed without removing it', async () => {
    const updated = await undoWeightWarningAcknowledgement(
      TARGET_CLINIC,
      TARGET_ORDER_ID,
      'plateau',
      'Acknowledged the wrong chip by mistake.',
    );
    const entries = updated.weight_warning_acknowledgements ?? [];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      rationale: 'Original rationale here.',
      reversed_by_user_id: CURRENT_USER.id,
      reversal_reason: 'Acknowledged the wrong chip by mistake.',
    });
    expect(entries[0].reversed_at).toBeTruthy();
  });

  it('rejects an empty/short reason', async () => {
    await expect(
      undoWeightWarningAcknowledgement(TARGET_CLINIC, TARGET_ORDER_ID, 'plateau', ''),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects undoing when there is no active acknowledgement to reverse', async () => {
    await undoWeightWarningAcknowledgement(
      TARGET_CLINIC,
      TARGET_ORDER_ID,
      'plateau',
      'First undo.',
    );
    await expect(
      undoWeightWarningAcknowledgement(
        TARGET_CLINIC,
        TARGET_ORDER_ID,
        'plateau',
        'Second undo.',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('allows re-acknowledging the same kind after an undo (entries are append-only)', async () => {
    await undoWeightWarningAcknowledgement(
      TARGET_CLINIC,
      TARGET_ORDER_ID,
      'plateau',
      'Reversed in error.',
    );
    const updated = await acknowledgeWeightWarning(
      TARGET_CLINIC,
      TARGET_ORDER_ID,
      'plateau',
      'Fresh review — happy to proceed.',
    );
    const entries = updated.weight_warning_acknowledgements ?? [];
    expect(entries).toHaveLength(2);
    expect(entries[0].reversed_at).toBeTruthy();
    expect(entries[1].reversed_at).toBeFalsy();
    expect(entries[1].rationale).toBe('Fresh review — happy to proceed.');
  });
});
