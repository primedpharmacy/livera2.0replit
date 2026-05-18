/**
 * Unit tests — backfillPatientNotificationEnvelopes() (Task-132).
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
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MOCK_PATIENT_NOTIFICATIONS,
  type PatientNotification,
} from '../../fixtures/patientNotifications';
import { backfillPatientNotificationEnvelopes } from '../backfillPatientNotificationEnvelopes';

function findRow(id: string): PatientNotification {
  const row = MOCK_PATIENT_NOTIFICATIONS.find((n) => n.id === id);
  if (!row) throw new Error(`fixture row ${id} missing`);
  return row;
}

describe('backfillPatientNotificationEnvelopes', () => {
  // The fixture rows the job operates on are shared module state, so we
  // reset just the two legacy rows we own before each test rather than
  // wiping unrelated fixtures.
  beforeEach(() => {
    const reconstructible = findRow('NOTIF-LEGACY-001');
    reconstructible.email_envelope                    = null;
    reconstructible.email_envelope_unavailable_reason = null;

    const unrecoverable = findRow('NOTIF-LEGACY-002');
    unrecoverable.email_envelope                    = null;
    unrecoverable.email_envelope_unavailable_reason = null;
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

    // The two legacy rows we own are no longer "considered" (they've either
    // been backfilled or flagged), so they don't show up again.
    expect(second.backfilled).toEqual([]);
    expect(second.unrecoverable).toEqual([]);
  });

  it('does not overwrite envelopes captured at first-send time', async () => {
    const fresh = findRow('NOTIF-002'); // recorded with a real envelope
    const beforeSubject = fresh.email_envelope?.subject;

    await backfillPatientNotificationEnvelopes('feeltru');

    expect(fresh.email_envelope?.subject).toBe(beforeSubject);
    expect(fresh.email_envelope_unavailable_reason).toBeNull();
  });
});
