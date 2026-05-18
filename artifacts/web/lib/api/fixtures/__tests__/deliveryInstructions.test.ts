/**
 * Unit tests — delivery instructions (Task-318).
 *
 * Covers:
 *   1. sanitiseDeliveryInstructions — trims, squashes CRLF, drops control
 *      chars, caps lines, rejects over-length, returns null on empty.
 *   2. initialDeliveryInstructions — wraps the patient text into the
 *      unreviewed shape stored on Order, returns null when blank.
 *   3. normalizeDeliveryInstructionsFlag — adds/removes the
 *      "Delivery instructions need review" contextual flag based on
 *      review_status.
 *   4. approve/reject/update mutators — flip review_status, append edits,
 *      and emit no-op on unchanged values.
 *   5. decideOrder — approving an order whose instruction is still
 *      unreviewed leaves the contextual flag in place so the queue surfaces
 *      it; once staff approves, normalize clears it.
 *   6. Primed payload gate — buildPrimedOrderPayload only ships
 *      delivery_instructions once review_status === 'approved' AND
 *      staff_value is non-empty.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  sanitiseDeliveryInstructions,
  initialDeliveryInstructions,
  normalizeDeliveryInstructionsFlag,
  approveDeliveryInstructions,
  rejectDeliveryInstructions,
  updateDeliveryInstructions,
  DELIVERY_INSTRUCTIONS_MAX_LEN,
  DELIVERY_INSTRUCTIONS_REVIEW_FLAG,
} from '../deliveryInstructions';
import { decideOrder, MOCK_ORDERS } from '../orders';
import { MOCK_CLINICAL_NOTES } from '../clinicalNotes';
import { buildPrimedOrderPayload } from '@/lib/integrations/primed';
import { CURRENT_USER, APIError } from '../../constants';
import type { ClinicalNote, Order, User } from '../../types';

const CLINIC: 'vsc' = 'vsc';
const PATIENT_ID = 'PT-00234';
const TEST_ORDER_ID = 'ORD-TEST-DI';

let ordersSnapshot: Order[];
let notesSnapshot: ClinicalNote[];

function snapshot() {
  ordersSnapshot = MOCK_ORDERS.map((o) => structuredClone(o));
  notesSnapshot = MOCK_CLINICAL_NOTES.map((n) => structuredClone(n));
}
function restore() {
  MOCK_ORDERS.splice(0, MOCK_ORDERS.length, ...ordersSnapshot.map((o) => structuredClone(o)));
  MOCK_CLINICAL_NOTES.splice(
    0, MOCK_CLINICAL_NOTES.length,
    ...notesSnapshot.map((n) => structuredClone(n)),
  );
}
snapshot();
beforeEach(restore);

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: TEST_ORDER_ID,
    clinic_id: CLINIC,
    patient_id: PATIENT_ID,
    type: 'new',
    status: 'clinical_check',
    product: { medication: 'Mounjaro', dose: '7.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
    payment: { amount: 18000, currency: 'GBP', captured_at: '2026-04-01T10:00:00Z' },
    g6_flags: [],
    contextual_flags: [],
    intervention_raised_at: null,
    px_upload: null,
    px_upload_link: null,
    expired_at: null,
    delivery_instructions: initialDeliveryInstructions('Leave with concierge'),
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    sla_breach_at: null,
    primed_order_id: null,
    primed_clinical_check_completed: false,
    ...overrides,
  } as Order;
}

function pushOrder(o: Order) {
  MOCK_ORDERS.push(o);
}

const ACTOR: User = CURRENT_USER;

// ── 1. sanitiser ─────────────────────────────────────────────────────────
describe('sanitiseDeliveryInstructions', () => {
  it('returns null for null/undefined/empty', () => {
    expect(sanitiseDeliveryInstructions(null)).toBeNull();
    expect(sanitiseDeliveryInstructions(undefined)).toBeNull();
    expect(sanitiseDeliveryInstructions('   ')).toBeNull();
    expect(sanitiseDeliveryInstructions('')).toBeNull();
  });

  it('squashes CRLF to \\n and strips control characters', () => {
    const cleaned = sanitiseDeliveryInstructions('hello\r\nworld\x07!');
    expect(cleaned).toBe('hello\nworld!');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitiseDeliveryInstructions('  leave at door  ')).toBe('leave at door');
  });

  it('caps to 5 lines', () => {
    const raw = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].join('\n');
    expect(sanitiseDeliveryInstructions(raw)).toBe('a\nb\nc\nd\ne');
  });

  it('rejects strings longer than the configured cap', () => {
    const tooLong = 'x'.repeat(DELIVERY_INSTRUCTIONS_MAX_LEN + 1);
    expect(() => sanitiseDeliveryInstructions(tooLong)).toThrow(APIError);
  });
});

// ── 2. initial wrapper ───────────────────────────────────────────────────
describe('initialDeliveryInstructions', () => {
  it('returns null when patient supplied nothing', () => {
    expect(initialDeliveryInstructions(null)).toBeNull();
    expect(initialDeliveryInstructions('   ')).toBeNull();
  });

  it('captures both patient_submitted and staff_value as the same starting value', () => {
    const di = initialDeliveryInstructions('Leave with concierge');
    expect(di).toMatchObject({
      patient_submitted: 'Leave with concierge',
      staff_value: 'Leave with concierge',
      review_status: 'unreviewed',
      reviewed_by_user_id: null,
      reviewed_at: null,
      edits: [],
    });
  });
});

// ── 3. flag normalisation ────────────────────────────────────────────────
describe('normalizeDeliveryInstructionsFlag', () => {
  it('adds the flag when unreviewed and not already present', () => {
    const o = buildOrder({ contextual_flags: [] });
    const out = normalizeDeliveryInstructionsFlag(o);
    expect(out.contextual_flags).toContain(DELIVERY_INSTRUCTIONS_REVIEW_FLAG);
  });

  it('removes the flag once approved', () => {
    const o = buildOrder({
      contextual_flags: [DELIVERY_INSTRUCTIONS_REVIEW_FLAG],
      delivery_instructions: {
        patient_submitted: 'x',
        staff_value: 'x',
        review_status: 'approved',
        reviewed_by_user_id: 'u1',
        reviewed_at: '2026-04-01T11:00:00Z',
        edits: [],
      },
    });
    const out = normalizeDeliveryInstructionsFlag(o);
    expect(out.contextual_flags).not.toContain(DELIVERY_INSTRUCTIONS_REVIEW_FLAG);
  });

  it('is a no-op when state already matches', () => {
    const o = buildOrder({ contextual_flags: [DELIVERY_INSTRUCTIONS_REVIEW_FLAG] });
    expect(normalizeDeliveryInstructionsFlag(o)).toBe(o);
  });

  it('leaves orders without instructions untouched', () => {
    const o = buildOrder({ delivery_instructions: null, contextual_flags: [] });
    const out = normalizeDeliveryInstructionsFlag(o);
    expect(out.contextual_flags).toEqual([]);
  });
});

// ── 4. mutators ──────────────────────────────────────────────────────────
describe('delivery instruction mutators', () => {
  it('approveDeliveryInstructions flips status and stamps reviewer', async () => {
    const o = buildOrder();
    pushOrder(o);
    const out = await approveDeliveryInstructions(CLINIC, TEST_ORDER_ID, undefined, ACTOR);
    expect(out.delivery_instructions?.review_status).toBe('approved');
    expect(out.delivery_instructions?.reviewed_by_user_id).toBe(ACTOR.id);
  });

  it('approveDeliveryInstructions can capture a final edit in the same click', async () => {
    const o = buildOrder();
    pushOrder(o);
    const out = await approveDeliveryInstructions(
      CLINIC, TEST_ORDER_ID, { staff_value: 'Leave at door' }, ACTOR,
    );
    expect(out.delivery_instructions?.staff_value).toBe('Leave at door');
    expect(out.delivery_instructions?.edits).toHaveLength(1);
    expect(out.delivery_instructions?.edits[0]).toMatchObject({
      from: 'Leave with concierge',
      to: 'Leave at door',
      edited_by_user_id: ACTOR.id,
    });
  });

  it('rejectDeliveryInstructions requires a reason and clears staff_value', async () => {
    const o = buildOrder();
    pushOrder(o);
    await expect(
      rejectDeliveryInstructions(CLINIC, TEST_ORDER_ID, { reason: '' }, ACTOR),
    ).rejects.toThrow(APIError);

    const out = await rejectDeliveryInstructions(
      CLINIC, TEST_ORDER_ID, { reason: 'Unsafe drop' }, ACTOR,
    );
    expect(out.delivery_instructions?.review_status).toBe('rejected');
    expect(out.delivery_instructions?.staff_value).toBeNull();
    expect(out.delivery_instructions?.edits[0]?.reason).toBe('Unsafe drop');
  });

  it('updateDeliveryInstructions appends an edit and is a no-op on unchanged value', async () => {
    const o = buildOrder();
    pushOrder(o);
    const first = await updateDeliveryInstructions(
      CLINIC, TEST_ORDER_ID, { staff_value: 'Leave at door' }, ACTOR,
    );
    expect(first.delivery_instructions?.staff_value).toBe('Leave at door');
    expect(first.delivery_instructions?.edits).toHaveLength(1);

    // Second call with same value → no new edit row, no audit churn.
    const second = await updateDeliveryInstructions(
      CLINIC, TEST_ORDER_ID, { staff_value: 'Leave at door' }, ACTOR,
    );
    expect(second.delivery_instructions?.edits).toHaveLength(1);
  });
});

// ── 5. decideOrder leaves flag on unreviewed instructions ────────────────
describe('decideOrder × unreviewed delivery instructions', () => {
  function seedApprovalNote(orderId: string) {
    MOCK_CLINICAL_NOTES.push({
      id: `NOTE-DI-${orderId}`,
      patient_id: PATIENT_ID,
      order_id: orderId,
      clinic_id: CLINIC,
      author_user_id: 'user_qadir',
      author_role: 'Prescriber',
      body: 'Approval rationale for delivery-instructions regression test — long enough to clear gate.',
      created_at: '2026-04-01T10:30:00Z',
      updated_at: '2026-04-01T10:30:00Z',
      edit_history: [],
      approval_gate_for_order_id: orderId,
      ai_drafted: false,
      ai_draft_accepted_at: null,
      ai_draft_edited_by: null,
      ai_prompt_version_id: null,
      ai_draft_original: null,
      ai_draft_edits: [],
      final_note: null,
      tags: ['clinical_check'],
      visibility: 'clinical_team',
    } as unknown as ClinicalNote);
  }

  it('keeps the contextual flag when approving with an unreviewed instruction', async () => {
    const o = buildOrder({ contextual_flags: [DELIVERY_INSTRUCTIONS_REVIEW_FLAG] });
    pushOrder(o);
    seedApprovalNote(TEST_ORDER_ID);
    const out = await decideOrder(CLINIC, TEST_ORDER_ID, 'approved', 'OK to dispatch.');
    expect(out.status).toBe('approved');
    expect(out.contextual_flags).toContain(DELIVERY_INSTRUCTIONS_REVIEW_FLAG);
  });
});

// ── 6. Primed payload gate ────────────────────────────────────────────────
describe('buildPrimedOrderPayload delivery_instructions gate', () => {
  it('omits the field when review_status !== approved', () => {
    const o = buildOrder();
    const payload = buildPrimedOrderPayload(o);
    expect(payload.delivery_instructions).toBeUndefined();
  });

  it('omits the field when approved but staff_value is null', () => {
    const o = buildOrder({
      delivery_instructions: {
        patient_submitted: 'x',
        staff_value: null,
        review_status: 'approved',
        reviewed_by_user_id: 'u1',
        reviewed_at: '2026-04-01T11:00:00Z',
        edits: [],
      },
    });
    expect(buildPrimedOrderPayload(o).delivery_instructions).toBeUndefined();
  });

  it('includes the field when approved and non-empty', () => {
    const o = buildOrder({
      delivery_instructions: {
        patient_submitted: 'Leave with concierge',
        staff_value: 'Leave with concierge',
        review_status: 'approved',
        reviewed_by_user_id: 'u1',
        reviewed_at: '2026-04-01T11:00:00Z',
        edits: [],
      },
    });
    expect(buildPrimedOrderPayload(o).delivery_instructions).toBe('Leave with concierge');
  });
});
