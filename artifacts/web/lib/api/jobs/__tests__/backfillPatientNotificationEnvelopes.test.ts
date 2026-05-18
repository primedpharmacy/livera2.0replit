/**
 * Unit tests — backfillPatientNotificationEnvelopes() (Task-132, Task-185).
 *
 * Covers:
 *   - Reconstructible older Email rows get an email_envelope populated from
 *     the originating order + patient + template.
 *   - Rows whose originating order is gone are flagged with
 *     email_envelope_unavailable_reason='order_not_found' instead of being
 *     silently skipped.
 *   - The job is idempotent — re-running it does not re-touch rows it
 *     already handled.
 *   - Rows that already have an envelope (e.g. newly recorded notifications)
 *     are skipped, so the retry job keeps seeing the original snapshot.
 *   - Task-185: rows whose envelope exists but is missing html_body get the
 *     branded HTML rendered when a renderer is known for the template, and
 *     are left text-only + logged when no renderer exists.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Fixtures transitively import lib/api/audit.ts, which loads @workspace/db
// dynamically at runtime — vitest's static analysis can't resolve it. Stub it
// out so the import graph compiles; recordAudit is fire-and-forget so this
// has no behavioural impact on the backfill code under test.
vi.mock('@workspace/db', () => ({
  db: { insert: () => ({ values: () => Promise.resolve() }) },
  auditEventsTable: { __mock: 'audit_events' },
}));

import {
  MOCK_PATIENT_NOTIFICATIONS,
  type PatientNotification,
} from '../../fixtures/patientNotifications';
import { backfillPatientNotificationEnvelopes } from '../backfillPatientNotificationEnvelopes';
import { renderPatientEmail } from '../../../integrations/emailTemplates';

function findRow(id: string): PatientNotification {
  const row = MOCK_PATIENT_NOTIFICATIONS.find((n) => n.id === id);
  if (!row) throw new Error(`fixture row ${id} missing`);
  return row;
}

describe('backfillPatientNotificationEnvelopes', () => {
  // The fixture rows the job operates on are shared module state, so we
  // reset just the legacy rows we own before each test rather than wiping
  // unrelated fixtures.
  beforeEach(() => {
    const reconstructible = findRow('NOTIF-LEGACY-001');
    reconstructible.email_envelope                    = null;
    reconstructible.email_envelope_unavailable_reason = null;

    const unrecoverable = findRow('NOTIF-LEGACY-002');
    unrecoverable.email_envelope                    = null;
    unrecoverable.email_envelope_unavailable_reason = null;

    // Task-185 — text-only envelope, HTML renderer available.
    const htmlBackfillable = findRow('NOTIF-LEGACY-003');
    if (htmlBackfillable.email_envelope) {
      htmlBackfillable.email_envelope.html_body = null;
    }
    htmlBackfillable.email_envelope_unavailable_reason = null;

    // Task-185 / Task-275 — text-only envelope for order_dispatched. Task-275
    // adds an HTML renderer for this template, so the backfill now populates
    // html_body on this row instead of logging it as unsupported.
    const htmlDispatched = findRow('NOTIF-LEGACY-004');
    if (htmlDispatched.email_envelope) {
      htmlDispatched.email_envelope.html_body = null;
    }
    htmlDispatched.email_envelope_unavailable_reason = null;
  });

  it('reconstructs envelopes for older rows whose order still exists', async () => {
    const result = await backfillPatientNotificationEnvelopes('feeltru');

    expect(result.backfilled.map((b) => b.notification_id)).toContain('NOTIF-LEGACY-001');

    const row = findRow('NOTIF-LEGACY-001');
    expect(row.email_envelope).not.toBeNull();
    expect(row.email_envelope?.template).toBe('order_approved');
    expect(row.email_envelope?.subject).toContain('ORD-00441');
    expect(row.email_envelope?.to_email).toBe('sarah.cookland@example.com');
    expect(row.email_envelope_unavailable_reason).toBeNull();
  });

  it('flags rows whose originating order has been removed', async () => {
    const result = await backfillPatientNotificationEnvelopes('feeltru');

    const flagged = result.unrecoverable.find(
      (u) => u.notification_id === 'NOTIF-LEGACY-002',
    );
    expect(flagged?.reason).toBe('order_not_found');

    const row = findRow('NOTIF-LEGACY-002');
    expect(row.email_envelope).toBeNull();
    expect(row.email_envelope_unavailable_reason).toBe('order_not_found');
  });

  it('is idempotent — a second run skips rows it already handled', async () => {
    await backfillPatientNotificationEnvelopes('feeltru');
    const second = await backfillPatientNotificationEnvelopes('feeltru');

    // Rows whose envelope state is fully resolved (backfilled or flagged) no
    // longer show up under backfilled/unrecoverable on the second run.
    expect(second.backfilled).toEqual([]);
    expect(second.unrecoverable).toEqual([]);
    // The HTML for LEGACY-003 was rendered on run 1, so the second run no
    // longer reports it as html_backfilled either.
    expect(
      second.html_backfilled.map((h) => h.notification_id),
    ).not.toContain('NOTIF-LEGACY-003');
  });

  it('does not overwrite envelopes captured at first-send time', async () => {
    const fresh = findRow('NOTIF-002'); // recorded with a real envelope
    const beforeSubject = fresh.email_envelope?.subject;

    await backfillPatientNotificationEnvelopes('feeltru');

    expect(fresh.email_envelope?.subject).toBe(beforeSubject);
    expect(fresh.email_envelope_unavailable_reason).toBeNull();
  });

  // Task-185 ----------------------------------------------------------------

  it('renders html_body for text-only envelopes when a template renderer is known', async () => {
    const result = await backfillPatientNotificationEnvelopes('feeltru');

    expect(
      result.html_backfilled.map((h) => h.notification_id),
    ).toContain('NOTIF-LEGACY-003');

    const row = findRow('NOTIF-LEGACY-003');
    expect(row.email_envelope?.html_body).toContain('<!doctype html>');
    expect(row.email_envelope?.html_body).toContain('ORD-00450');
    expect(row.email_envelope?.html_body).toContain('Livera');
    // The text body must remain untouched.
    expect(row.email_envelope?.text_body).toContain("We've cancelled order ORD-00450");
  });

  it('renders html_body for order_dispatched text-only envelopes (Task-275)', async () => {
    const result = await backfillPatientNotificationEnvelopes('feeltru');

    expect(
      result.html_backfilled.map((h) => h.notification_id),
    ).toContain('NOTIF-LEGACY-004');
    expect(
      result.html_unsupported.map((h) => h.notification_id),
    ).not.toContain('NOTIF-LEGACY-004');

    const row = findRow('NOTIF-LEGACY-004');
    const html = row.email_envelope?.html_body ?? '';
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('ORD-00441');
    // Tracking number from the payload must be surfaced in the branded body.
    expect(html).toContain('AB987654321GB');
    // Text body must remain intact.
    expect(row.email_envelope?.text_body).toContain('ORD-00441');
  });

  it('renders html_body that matches the live renderPatientEmail shell structure', async () => {
    await backfillPatientNotificationEnvelopes('feeltru');

    const row = findRow('NOTIF-LEGACY-003');
    const html = row.email_envelope?.html_body ?? '';

    // Backfilled HTML must match exactly what the live notification path
    // (orders.ts cancelOrder) would have produced for the same inputs — i.e.
    // the same shared shell + paragraph wording. Any branding drift in the
    // shared renderer is therefore picked up automatically.
    const expected = renderPatientEmail({
      heading: `Hi Sarah,`,
      paragraphs: [
        `We've cancelled order <strong>ORD-00450</strong>. ` +
          `No charge has been taken — the pre-authorisation on your card ` +
          `has been released and you'll see it disappear from your ` +
          `statement within a few working days.`,
        `<span style="color:#6b7280;">Reason recorded:</span> ` +
          `Patient changed their mind before dispatch.`,
        `If you have any questions, just reply to this email.`,
      ],
    }).html;

    expect(html).toBe(expected);
  });

  it('includes html_body when reconstructing an envelope from scratch for an HTML-supported template', async () => {
    // Promote LEGACY-001 to an HTML-supported template (order_cancelled_refund)
    // and clear its envelope so the reconstruction path runs with HTML.
    const row = findRow('NOTIF-LEGACY-001');
    row.template = 'order_cancelled_refund';
    row.payload = { order_id: 'ORD-00441', refunded_amount: 199, card_last4: '4242' };
    row.email_envelope = null;
    row.email_envelope_unavailable_reason = null;

    try {
      const result = await backfillPatientNotificationEnvelopes('feeltru');
      expect(
        result.backfilled.map((b) => b.notification_id),
      ).toContain('NOTIF-LEGACY-001');
      expect(
        result.html_backfilled.map((h) => h.notification_id),
      ).toContain('NOTIF-LEGACY-001');
      // Re-look up the row so TS doesn't keep the post-assignment `null`
      // narrowing across the async backfill call (which mutates in place).
      const updated = findRow('NOTIF-LEGACY-001');
      expect(updated.email_envelope?.html_body).toContain('£199.00');
      expect(updated.email_envelope?.html_body).toContain('4242');
    } finally {
      // Restore so other tests aren't affected.
      row.template = 'order_approved';
      row.payload = { order_id: 'ORD-00441' };
      row.email_envelope = null;
      row.email_envelope_unavailable_reason = null;
    }
  });
});
