/**
 * Unit tests — decideOrder() px-upload approval gate (Task-81 / Task-86)
 *
 * Mirrors the dose-escalation evidence gate: a prescriber cannot approve an
 * order that carries the "Px upload pending" contextual flag until a
 * prescription file has been attached via attachPxUpload(). The gate is a
 * hard SAFETY_VIOLATION — these tests pin its behaviour so future changes to
 * decideOrder cannot silently weaken it.
 *
 * Covered cases:
 *   1. Approving an order with "Px upload pending" + px_upload === null
 *      throws SAFETY_VIOLATION with the patient-facing message.
 *   2. Once attachPxUpload() populates px_upload, the same order can be
 *      approved (px_upload check passes, gate clears the flag).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { decideOrder, attachPxUpload, MOCK_ORDERS } from '../orders';
import { MOCK_CLINICAL_NOTES } from '../clinicalNotes';
import type { Order, ClinicalNote } from '../../types';
import { APIError } from '../../constants';

// ── Snapshot / restore ─────────────────────────────────────────────────────
// decideOrder + attachPxUpload mutate MOCK_ORDERS and MOCK_CLINICAL_NOTES in
// place; clone a baseline so each case starts from the same fixture state.

let ordersSnapshot: Order[];
let notesSnapshot: ClinicalNote[];

function snapshot() {
  ordersSnapshot = MOCK_ORDERS.map((o) => structuredClone(o));
  notesSnapshot  = MOCK_CLINICAL_NOTES.map((n) => structuredClone(n));
}

function restore() {
  MOCK_ORDERS.splice(0, MOCK_ORDERS.length, ...ordersSnapshot.map((o) => structuredClone(o)));
  MOCK_CLINICAL_NOTES.splice(0, MOCK_CLINICAL_NOTES.length, ...notesSnapshot.map((n) => structuredClone(n)));
}

snapshot();

beforeEach(() => {
  restore();
});

// Test order id — pushed into MOCK_ORDERS in each test below.
const TEST_ORDER_ID = 'ORD-TEST-PXGATE';
const CLINIC: 'vsc' = 'vsc';
// PT-00234 (James, vsc clinic) has no flags — clean target for the px gate
// test so the high-severity check passes and we hit the px_upload branch.
const PATIENT_ID = 'PT-00234';

function buildPxPendingOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: TEST_ORDER_ID,
    clinic_id: CLINIC,
    patient_id: PATIENT_ID,
    type: 'new',
    status: 'clinical_check',
    product: { medication: 'Mounjaro', dose: '7.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
    // GLP-1 higher-dose path — required by findOrderForPxUpload so the
    // attachPxUpload step is allowed to run.
    questionnaire_responses: { ft_oq_9: 'yes', ft_oq_10: 'yes' },
    amendment_window: 'pre_approval',
    primed_order_id: null,
    primed_clinical_check_completed: false,
    ryft_authorisation_id: null,
    amount_charged: null,
    amount_authorised: 149.0,
    clinical_decision: null,
    sla_warn_at: '2026-05-18T10:00:00Z',
    sla_breach_at: '2026-05-19T10:00:00Z',
    g6_flags: [],
    // The gate trigger — created at intake when ft_oq_9 === ft_oq_10 === 'yes'.
    contextual_flags: ['New intake', 'Px upload pending'],
    intervention_raised_at: null,
    px_upload: null,
    px_upload_link: null,
    expired_at: null,
    created_at: '2026-05-18T08:00:00Z',
    updated_at: '2026-05-18T08:00:00Z',
    ...overrides,
  };
}

function seedApprovalNote(orderId: string): void {
  // decideOrder('approved') requires an approval-gate clinical note >= the
  // clinic's clinical_note_min_chars (40 for vsc) to pass the layer-2 check.
  MOCK_CLINICAL_NOTES.push({
    id: `NOTE-PXGATE-${orderId}`,
    patient_id: PATIENT_ID,
    order_id: orderId,
    clinic_id: CLINIC,
    author_user_id: 'user_qadir',
    author_role: 'Prescriber',
    body: 'Approval rationale for px-upload gate regression test — sufficient length to satisfy min-chars gate.',
    created_at: '2026-05-18T09:00:00Z',
    updated_at: '2026-05-18T09:00:00Z',
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
  });
}

describe('decideOrder() — px-upload approval gate (Task-81)', () => {
  it('throws SAFETY_VIOLATION when approving with "Px upload pending" and px_upload === null', async () => {
    const order = buildPxPendingOrder();
    MOCK_ORDERS.push(order);
    // Seed the approval note too, to guarantee we are hitting the px-upload
    // branch specifically and not the clinical-note gate later in the chain.
    seedApprovalNote(order.id);

    await expect(decideOrder(CLINIC, order.id, 'approved', 'Looks good'))
      .rejects.toMatchObject({
        code: 'SAFETY_VIOLATION',
        message: expect.stringContaining('prescription upload required'),
      });

    // Order must remain in clinical_check — the violation should not mutate state.
    const persisted = MOCK_ORDERS.find((o) => o.id === order.id)!;
    expect(persisted.status).toBe('clinical_check');
    expect(persisted.clinical_decision).toBeNull();
  });

  it('allows approval once attachPxUpload has populated px_upload', async () => {
    const order = buildPxPendingOrder();
    MOCK_ORDERS.push(order);
    seedApprovalNote(order.id);

    // Sanity: gate is armed — same SAFETY_VIOLATION as the first test.
    await expect(decideOrder(CLINIC, order.id, 'approved', 'Looks good'))
      .rejects.toMatchObject({
        code: 'SAFETY_VIOLATION',
        message: expect.stringContaining('prescription upload required'),
      });

    // Attach a prescription file — this populates px_upload and swaps the
    // "Px upload pending" contextual flag for "Px upload received".
    const updated = await attachPxUpload(CLINIC, order.id, {
      filename: 'current-prescription.pdf',
      size: 128 * 1024,
      content_type: 'application/pdf',
      object_path: '/objects/uploads/test-pxgate-fixture',
    });
    expect(updated.px_upload).not.toBeNull();
    expect(updated.contextual_flags).toContain('Px upload received');
    expect(updated.contextual_flags).not.toContain('Px upload pending');

    // Same order can now be approved — gate clears.
    const decided = await decideOrder(
      CLINIC,
      order.id,
      'approved',
      'Prescription reviewed — approve',
    );
    expect(decided.status).toBe('approved');
    expect(decided.clinical_decision?.decision).toBe('approved');
  });
});
