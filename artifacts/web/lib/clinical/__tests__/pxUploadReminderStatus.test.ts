/**
 * Task-180 — computeReminderStatus distils the px_upload_link reminder trail
 * (reminder_sent_at / final_reminder_sent_at + reminder_failures) into the
 * pill state shown on the prescriber queue. These tests pin the priority
 * order so a future change can't silently downgrade a bounced reminder to
 * "Reminded" and quietly hide a stuck order.
 */

import { describe, it, expect } from 'vitest';
import { computeReminderStatus } from '../pxUploadReminderStatus';
import type { Order } from '../../api/types';

function makeOrder(link: Order['px_upload_link']): Order {
  return {
    id: 'ORD-TEST',
    clinic_id: 'feeltru',
    patient_id: 'PT-TEST',
    type: 'new',
    status: 'clinical_check',
    product: { medication: 'Mounjaro', dose: '2.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
    questionnaire_responses: {},
    amendment_window: 'pre_approval',
    primed_order_id: null,
    primed_clinical_check_completed: false,
    ryft_authorisation_id: 'ryft_test',
    amount_charged: null,
    amount_authorised: null,
    clinical_decision: null,
    sla_warn_at: '2026-05-18T11:00:00Z',
    sla_breach_at: '2026-05-19T11:00:00Z',
    g6_flags: [],
    intervention_raised_at: null,
    expired_at: null,
    px_upload: null,
    px_upload_link: link,
    created_at: '2026-05-18T08:00:00Z',
    updated_at: '2026-05-18T08:00:00Z',
  };
}

describe('computeReminderStatus', () => {
  it('returns null when there is no px_upload_link', () => {
    expect(computeReminderStatus(makeOrder(null))).toBeNull();
  });

  it('returns null when no reminder has been sent and none has failed', () => {
    const link = {
      token: 't', expires_at: '2026-05-25T08:00:00Z',
      sent_at: '2026-05-15T08:00:00Z', consumed_at: null,
      email_message_id: null, to_email: 'a@b.co',
    } satisfies Order['px_upload_link'];
    expect(computeReminderStatus(makeOrder(link))).toBeNull();
  });

  it('reports "first" once the 48h nudge has landed', () => {
    const link = {
      token: 't', expires_at: '2026-05-25T08:00:00Z',
      sent_at: '2026-05-15T08:00:00Z', consumed_at: null,
      email_message_id: null, to_email: 'a@b.co',
      reminder_sent_at: '2026-05-17T08:00:00Z',
    } satisfies Order['px_upload_link'];
    const s = computeReminderStatus(makeOrder(link));
    expect(s?.state).toBe('first');
    expect(s?.sentCount).toBe(1);
    expect(s?.failureCount).toBe(0);
  });

  it('reports "final" once the last-chance nudge has landed', () => {
    const link = {
      token: 't', expires_at: '2026-05-25T08:00:00Z',
      sent_at: '2026-05-15T08:00:00Z', consumed_at: null,
      email_message_id: null, to_email: 'a@b.co',
      reminder_sent_at: '2026-05-17T08:00:00Z',
      final_reminder_sent_at: '2026-05-24T08:00:00Z',
    } satisfies Order['px_upload_link'];
    const s = computeReminderStatus(makeOrder(link));
    expect(s?.state).toBe('final');
    expect(s?.sentCount).toBe(2);
  });

  it('reports "bounced" when a failed attempt has no matching successful send', () => {
    const link = {
      token: 't', expires_at: '2026-05-25T08:00:00Z',
      sent_at: '2026-05-15T08:00:00Z', consumed_at: null,
      email_message_id: null, to_email: 'a@b.co',
      reminder_failures: [
        { kind: 'first', attempted_at: '2026-05-17T08:00:00Z', to_email: 'a@b.co',
          status: 'Bounced', error_message: 'mailbox not found' },
      ],
    } satisfies Order['px_upload_link'];
    const s = computeReminderStatus(makeOrder(link));
    expect(s?.state).toBe('bounced');
    expect(s?.failureCount).toBe(1);
    expect(s?.latestFailure?.error_message).toBe('mailbox not found');
  });

  it('downgrades a resolved past bounce — first eventually succeeded → "first"', () => {
    const link = {
      token: 't', expires_at: '2026-05-25T08:00:00Z',
      sent_at: '2026-05-15T08:00:00Z', consumed_at: null,
      email_message_id: null, to_email: 'a@b.co',
      reminder_sent_at: '2026-05-18T08:00:00Z',
      reminder_failures: [
        { kind: 'first', attempted_at: '2026-05-17T08:00:00Z', to_email: 'a@b.co',
          status: 'Bounced', error_message: 'transient' },
      ],
    } satisfies Order['px_upload_link'];
    const s = computeReminderStatus(makeOrder(link));
    expect(s?.state).toBe('first');
    expect(s?.failureCount).toBe(1); // still surfaced in the hover summary
    expect(s?.sentCount).toBe(1);
  });

  it('picks the most recent failure as latestFailure', () => {
    const link = {
      token: 't', expires_at: '2026-05-25T08:00:00Z',
      sent_at: '2026-05-15T08:00:00Z', consumed_at: null,
      email_message_id: null, to_email: 'a@b.co',
      reminder_failures: [
        { kind: 'first', attempted_at: '2026-05-17T08:00:00Z', to_email: 'a@b.co',
          status: 'Bounced', error_message: 'older' },
        { kind: 'final', attempted_at: '2026-05-24T08:00:00Z', to_email: 'a@b.co',
          status: 'Failed', error_message: 'newer' },
      ],
    } satisfies Order['px_upload_link'];
    const s = computeReminderStatus(makeOrder(link));
    expect(s?.state).toBe('bounced');
    expect(s?.latestFailure?.error_message).toBe('newer');
  });
});
