/**
 * backfillPxUploadReplacementHistory — Task-253.
 *
 * Task-171 starts persisting `Order.px_upload_history` whenever a
 * prescription file is swapped via attachPxUpload(). Orders that were
 * replaced one-or-more times *before* Task-171 shipped will not have
 * any history rows, even though the Task-119 [AUDIT] log captured every
 * swap (event_type 'px_upload_attempt' / 'px_upload_result' with
 * is_replacement=true, and the durable-spine row 'px_upload_attached'
 * carries the `before` snapshot).
 *
 * This one-shot backfill reconstructs `px_upload_history` from those
 * audit rows so the Order Detail "Replacement history" section shows
 * the complete chain for legacy orders too.
 *
 * Design rules
 *   - **Idempotent.** Each history row is keyed by replaced_at +
 *     replaced_filename; re-running the job (or running it after
 *     attachPxUpload has already appended via the live path) does not
 *     duplicate entries.
 *   - **No mocked audit rows.** The job accepts an iterable of audit
 *     events so the live caller can hand it the result of a real
 *     `select() from audit_events` query, and the fixture caller can
 *     hand it the in-memory `MOCK_ORDER_AUDIT_EVENTS` mirror. Either
 *     way the shape is the same.
 *   - **Skip silently** for events whose order has been deleted or
 *     whose payload is malformed — record the count for the report so
 *     on-call can spot orphans.
 *
 * Server-side only; safe to run from a one-off admin script or, in
 * fixture mode, from module init so the demo workspace shows the
 * historical chain without manual intervention.
 */

import type { Order } from '../types';
import { MOCK_ORDERS, MOCK_ORDER_AUDIT_EVENTS } from '../fixtures/orders';

export type PxReplacementSource = 'success_screen' | 'email_link' | 'staff_upload';

export type PxReplacementAuditEvent = {
  /** Order the replacement happened on (matches Order.id). */
  order_id: string;
  /** ISO timestamp the replacement landed. */
  occurred_at: string;
  /** New uploader (null = patient/system, then derive from source). */
  actor_user_id: string | null;
  /** Source of the *new* file that replaced the old one. */
  source: PxReplacementSource;
  /** Filename of the file that was swapped out. */
  replaced_filename: string;
};

export type BackfillPxResult = {
  considered:      number; // events examined
  appended:        number; // history entries actually added
  already_present: number; // events whose entry already existed (idempotent re-runs)
  missing_order:   number; // events whose order_id no longer resolves
};

/**
 * Adapter — pulls replacement events out of the in-memory audit mirror
 * (the same MOCK_ORDER_AUDIT_EVENTS array that Task-178 introduced).
 *
 * The audit pipeline records two events per swap (px_upload_attempt
 * then px_upload_result). We key off the successful *result* row so we
 * never reconstruct a history entry for a swap that ultimately failed
 * validation.
 */
export function readReplacementEventsFromOrderAudit(): PxReplacementAuditEvent[] {
  const out: PxReplacementAuditEvent[] = [];
  for (const evt of MOCK_ORDER_AUDIT_EVENTS) {
    if (evt.event_type !== 'px_upload_result') continue;
    const p = evt.payload as Record<string, unknown>;
    if (p.outcome !== 'success') continue;
    if (p.is_replacement !== true) continue;
    const replacedFrom = p.replaced_from as Record<string, unknown> | null | undefined;
    const replacedFilename = typeof replacedFrom?.filename === 'string'
      ? replacedFrom.filename
      : null;
    if (!replacedFilename) continue;
    const source = typeof p.source === 'string' ? p.source : null;
    if (source !== 'success_screen' && source !== 'email_link' && source !== 'staff_upload') {
      continue;
    }
    out.push({
      order_id:           evt.order_id,
      occurred_at:        evt.occurred_at,
      actor_user_id:      evt.actor_user_id,
      source,
      replaced_filename:  replacedFilename,
    });
  }
  return out;
}

export function backfillPxUploadReplacementHistory(
  events: Iterable<PxReplacementAuditEvent>,
  opts?: { orders?: Order[] },
): BackfillPxResult {
  const orders = opts?.orders ?? MOCK_ORDERS;
  const result: BackfillPxResult = {
    considered:      0,
    appended:        0,
    already_present: 0,
    missing_order:   0,
  };

  // Apply in chronological order so the resulting history reads
  // oldest-first, matching what attachPxUpload's live path produces.
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  );

  for (const evt of sorted) {
    result.considered += 1;
    const order = orders.find((o) => o.id === evt.order_id);
    if (!order) {
      result.missing_order += 1;
      console.log('[AUDIT]', {
        event_type: 'px_upload_history_backfill_skipped',
        reason:     'order_not_found',
        order_id:   evt.order_id,
      });
      continue;
    }

    const history = order.px_upload_history ?? [];
    const alreadyPresent = history.some(
      (h) =>
        h.replaced_at === evt.occurred_at &&
        h.replaced_filename === evt.replaced_filename,
    );
    if (alreadyPresent) {
      result.already_present += 1;
      continue;
    }

    order.px_upload_history = [
      ...history,
      {
        replaced_at:        evt.occurred_at,
        replaced_filename:  evt.replaced_filename,
        replaced_by_user_id: evt.actor_user_id,
        replaced_by_source: evt.source,
      },
    ];
    result.appended += 1;
    console.log('[AUDIT]', {
      event_type:        'px_upload_history_backfilled',
      order_id:          evt.order_id,
      replaced_filename: evt.replaced_filename,
      replaced_at:       evt.occurred_at,
      source:            evt.source,
    });
  }

  return result;
}
