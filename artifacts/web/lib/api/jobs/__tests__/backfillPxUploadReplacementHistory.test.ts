/**
 * Unit tests — backfillPxUploadReplacementHistory (Task-253).
 *
 * Covers:
 *   - Reconstructs px_upload_history from px_upload_result audit rows
 *     (outcome=success, is_replacement=true) in chronological order.
 *   - Idempotent: re-running the job does not duplicate entries.
 *   - Plays nicely with the live attachPxUpload path: if a history
 *     entry already exists for an audit event, it is not re-appended.
 *   - Skips events whose order has been deleted (records missing_order).
 *   - The fixture boot-time backfill (orders.ts) actually populated
 *     the legacy ORD-00452 seed.
 */

import { describe, it, expect } from 'vitest';

import {
  backfillPxUploadReplacementHistory,
  readReplacementEventsFromOrderAudit,
  type PxReplacementAuditEvent,
} from '../backfillPxUploadReplacementHistory';
import { MOCK_ORDERS } from '../../fixtures/orders';
import type { Order } from '../../types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ORD-BACKFILL-TEST',
    clinic_id: 'feeltru',
    patient_id: 'PT-00378',
    type: 'new',
    status: 'clinical_check',
    product: { medication: 'Mounjaro', dose: '2.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
    questionnaire_responses: {},
    amendment_window: 'pre_approval',
    primed_order_id: null,
    primed_clinical_check_completed: false,
    ryft_authorisation_id: null,
    amount_charged: null,
    amount_authorised: 149.0,
    clinical_decision: null,
    sla_warn_at: '2026-05-17T10:00:00Z',
    sla_breach_at: '2026-05-18T10:00:00Z',
    g6_flags: [],
    contextual_flags: [],
    intervention_raised_at: null,
    expired_at: null,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    ...overrides,
  } as Order;
}

describe('backfillPxUploadReplacementHistory', () => {
  it('reconstructs history entries from audit events in chronological order', () => {
    const order = makeOrder({ id: 'ORD-T1' });
    const events: PxReplacementAuditEvent[] = [
      {
        order_id: 'ORD-T1',
        occurred_at: '2026-04-10T12:00:00Z',
        actor_user_id: 'user_claire',
        source: 'staff_upload',
        replaced_filename: 'mid-rx.pdf',
      },
      {
        order_id: 'ORD-T1',
        occurred_at: '2026-04-09T09:00:00Z',
        actor_user_id: null,
        source: 'email_link',
        replaced_filename: 'first-rx.jpg',
      },
    ];

    const result = backfillPxUploadReplacementHistory(events, { orders: [order] });

    expect(result).toMatchObject({
      considered: 2,
      appended: 2,
      already_present: 0,
      missing_order: 0,
    });
    expect(order.px_upload_history).toEqual([
      {
        replaced_at: '2026-04-09T09:00:00Z',
        replaced_filename: 'first-rx.jpg',
        replaced_by_user_id: null,
        replaced_by_source: 'email_link',
      },
      {
        replaced_at: '2026-04-10T12:00:00Z',
        replaced_filename: 'mid-rx.pdf',
        replaced_by_user_id: 'user_claire',
        replaced_by_source: 'staff_upload',
      },
    ]);
  });

  it('is idempotent — re-running does not duplicate entries', () => {
    const order = makeOrder({ id: 'ORD-T2' });
    const events: PxReplacementAuditEvent[] = [
      {
        order_id: 'ORD-T2',
        occurred_at: '2026-04-09T09:00:00Z',
        actor_user_id: 'user_claire',
        source: 'staff_upload',
        replaced_filename: 'first-rx.jpg',
      },
    ];

    const first = backfillPxUploadReplacementHistory(events, { orders: [order] });
    expect(first.appended).toBe(1);
    expect(order.px_upload_history).toHaveLength(1);

    const second = backfillPxUploadReplacementHistory(events, { orders: [order] });
    expect(second).toMatchObject({ considered: 1, appended: 0, already_present: 1 });
    expect(order.px_upload_history).toHaveLength(1);
  });

  it('does not re-append entries the live attachPxUpload path already wrote', () => {
    const order = makeOrder({
      id: 'ORD-T3',
      px_upload_history: [
        {
          replaced_at: '2026-04-09T09:00:00Z',
          replaced_filename: 'first-rx.jpg',
          replaced_by_user_id: 'user_claire',
          replaced_by_source: 'staff_upload',
        },
      ],
    });
    const events: PxReplacementAuditEvent[] = [
      {
        order_id: 'ORD-T3',
        occurred_at: '2026-04-09T09:00:00Z',
        actor_user_id: 'user_claire',
        source: 'staff_upload',
        replaced_filename: 'first-rx.jpg',
      },
    ];
    const result = backfillPxUploadReplacementHistory(events, { orders: [order] });
    expect(result).toMatchObject({ appended: 0, already_present: 1 });
    expect(order.px_upload_history).toHaveLength(1);
  });

  it('records missing_order when an audit row references a deleted order', () => {
    const result = backfillPxUploadReplacementHistory(
      [
        {
          order_id: 'ORD-DOES-NOT-EXIST',
          occurred_at: '2026-04-09T09:00:00Z',
          actor_user_id: null,
          source: 'email_link',
          replaced_filename: 'gone.jpg',
        },
      ],
      { orders: [] },
    );
    expect(result).toMatchObject({ considered: 1, appended: 0, missing_order: 1 });
  });

  it('boot-time backfill populated the legacy ORD-00452 seed with both replacements', () => {
    const legacy = MOCK_ORDERS.find((o) => o.id === 'ORD-00452');
    expect(legacy).toBeDefined();
    expect(legacy!.px_upload_history).toHaveLength(2);
    // Chronological order (oldest first), matches what attachPxUpload writes today.
    expect(legacy!.px_upload_history![0]).toMatchObject({
      replaced_at: '2026-05-05T11:14:00Z',
      replaced_filename: 'leila-rx-initial.jpg',
      replaced_by_source: 'email_link',
      replaced_by_user_id: null,
    });
    expect(legacy!.px_upload_history![1]).toMatchObject({
      replaced_at: '2026-05-06T15:42:00Z',
      replaced_filename: 'leila-rx-v2.jpg',
      replaced_by_source: 'staff_upload',
      replaced_by_user_id: 'user_claire',
    });
  });

  it('readReplacementEventsFromOrderAudit surfaces the legacy seed rows', () => {
    const events = readReplacementEventsFromOrderAudit();
    const forLegacy = events.filter((e) => e.order_id === 'ORD-00452');
    expect(forLegacy).toHaveLength(2);
    // Re-running the backfill on the live MOCK_ORDERS is now a no-op
    // (the boot-time call already populated it) — proves idempotency
    // against the real fixture state, not just synthetic orders.
    const reRun = backfillPxUploadReplacementHistory(forLegacy);
    expect(reRun.appended).toBe(0);
    expect(reRun.already_present).toBe(2);
  });
});
