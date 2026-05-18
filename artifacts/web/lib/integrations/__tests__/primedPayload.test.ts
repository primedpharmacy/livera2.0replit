/**
 * Primed payload — delivery_instructions gating (Task-318).
 *
 * Locks down the contract that the courier note is shipped to Primed
 * ONLY when a staff reviewer has approved a non-empty value. Every other
 * state (unreviewed / rejected / approved-but-empty) must omit the field
 * from the payload entirely (never send an empty string).
 */
import { describe, it, expect } from 'vitest';
import { buildPrimedOrderPayload } from '../primed';
import type { Order } from '@/lib/api/types';

function baseOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ORD-PRIMED-1',
    clinic_id: 'vsc',
    patient_id: 'PT-00234',
    type: 'new',
    status: 'approved',
    product: { medication: 'Mounjaro', dose: '7.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
    g6_flags: [],
    contextual_flags: [],
    intervention_raised_at: null,
    px_upload: null,
    px_upload_link: null,
    expired_at: null,
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    ...overrides,
  } as unknown as Order;
}

describe('buildPrimedOrderPayload — delivery_instructions gate', () => {
  it('omits the field when the order has no delivery instructions at all', () => {
    const out = buildPrimedOrderPayload(baseOrder({ delivery_instructions: null }));
    expect(out).not.toHaveProperty('delivery_instructions');
  });

  it('omits the field when review_status is unreviewed', () => {
    const out = buildPrimedOrderPayload(baseOrder({
      delivery_instructions: {
        patient_submitted: 'Leave with concierge',
        staff_value: 'Leave with concierge',
        review_status: 'unreviewed',
        reviewed_by_user_id: null,
        reviewed_at: null,
        edits: [],
      },
    }));
    expect(out).not.toHaveProperty('delivery_instructions');
  });

  it('omits the field when review_status is rejected', () => {
    const out = buildPrimedOrderPayload(baseOrder({
      delivery_instructions: {
        patient_submitted: 'Leave with concierge',
        staff_value: null,
        review_status: 'rejected',
        reviewed_by_user_id: 'u1',
        reviewed_at: '2026-04-01T11:00:00Z',
        edits: [],
      },
    }));
    expect(out).not.toHaveProperty('delivery_instructions');
  });

  it('omits the field when approved but staff_value is empty', () => {
    const out = buildPrimedOrderPayload(baseOrder({
      delivery_instructions: {
        patient_submitted: 'Leave with concierge',
        staff_value: '',
        review_status: 'approved',
        reviewed_by_user_id: 'u1',
        reviewed_at: '2026-04-01T11:00:00Z',
        edits: [],
      },
    }));
    expect(out).not.toHaveProperty('delivery_instructions');
  });

  it('includes the staff value once approved with non-empty content', () => {
    const out = buildPrimedOrderPayload(baseOrder({
      delivery_instructions: {
        patient_submitted: 'Leave with concierge',
        staff_value: 'Leave with concierge (lobby desk)',
        review_status: 'approved',
        reviewed_by_user_id: 'u1',
        reviewed_at: '2026-04-01T11:00:00Z',
        edits: [],
      },
    }));
    expect(out.delivery_instructions).toBe('Leave with concierge (lobby desk)');
  });

  it('still echoes the core order identifiers', () => {
    const out = buildPrimedOrderPayload(baseOrder({ delivery_instructions: null }));
    expect(out).toMatchObject({
      order_id: 'ORD-PRIMED-1',
      clinic_id: 'vsc',
      patient_id: 'PT-00234',
    });
  });
});
