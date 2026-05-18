/**
 * OrderActivityTimeline — Task-268 auto-chase history rendering.
 *
 * Pins that:
 *   - Each entry in `px_upload_link.auto_resends` renders as its own
 *     timeline row, attributed to the system (not a staff member), with
 *     a "New single-use link · expires …" subtext.
 *   - Failed auto-resends render as a distinct error row carrying the
 *     Postmark error message inline (mirroring how `reminder_failures`
 *     surfaces delivery failures).
 *   - `auto_chase_escalated_at` renders as its own "escalated for call"
 *     row separate from the routine auto-resends above it.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OrderActivityTimeline } from '../OrderActivityTimeline';
import type { Order } from '@/types';

type PxLink = NonNullable<Order['px_upload_link']>;

function makeOrder(overrides: Partial<PxLink>): Order {
  return {
    id: 'ORD-T268',
    clinic_id: 'feeltru',
    patient_id: 'PT-00268',
    type: 'new',
    status: 'clinical_check',
    product: { medication: 'Mounjaro', dose: '2.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
    questionnaire_responses: {},
    amendment_window: 'pre_approval',
    primed_order_id: null,
    primed_clinical_check_completed: false,
    ryft_authorisation_id: null,
    amount_charged: null,
    amount_authorised: 149,
    clinical_decision: null,
    sla_warn_at: '2026-05-12T08:00:00Z',
    sla_breach_at: '2026-05-13T08:00:00Z',
    g6_flags: [],
    contextual_flags: ['Px upload pending'],
    intervention_raised_at: null,
    px_upload: null,
    px_upload_link: {
      token: 'tok-x',
      expires_at: '2026-05-25T08:00:00Z',
      sent_at: '2026-05-01T08:00:00Z',
      consumed_at: null,
      email_message_id: 'mid',
      to_email: 'patient@example.com',
      reminder_sent_at: null,
      final_reminder_sent_at: null,
      ...overrides,
    },
    expired_at: null,
    created_at: '2026-05-01T08:00:00Z',
    updated_at: '2026-05-01T08:00:00Z',
  };
}

describe('OrderActivityTimeline — Task-268 auto-chase history', () => {
  afterEach(() => cleanup());

  it('renders one timeline entry per auto-resend, attributed to the system', () => {
    render(
      <OrderActivityTimeline
        order={makeOrder({
          auto_resends: [
            {
              sent_at: '2026-05-10T08:00:00Z',
              to_email: 'patient@example.com',
              expires_at: '2026-05-24T08:00:00Z',
              previous_expired: false,
              status: 'Delivered',
              error_message: null,
            },
            {
              sent_at: '2026-05-20T08:00:00Z',
              to_email: 'patient@example.com',
              expires_at: '2026-06-03T08:00:00Z',
              previous_expired: true,
              status: 'Delivered',
              error_message: null,
            },
          ],
        })}
      />,
    );

    expect(
      screen.getByText('System auto-resent Px upload link'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('System auto-resent Px upload link (previous link had expired)'),
    ).toBeInTheDocument();

    expect(screen.getByText(/Auto-resend 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText(/Auto-resend 2 of 2/)).toBeInTheDocument();

    const systemMentions = screen.getAllByText(/by system/);
    expect(systemMentions.length).toBeGreaterThanOrEqual(2);
  });

  it('renders failed auto-resends with the Postmark error message inline', () => {
    render(
      <OrderActivityTimeline
        order={makeOrder({
          auto_resends: [
            {
              sent_at: '2026-05-10T08:00:00Z',
              to_email: 'patient@example.com',
              expires_at: '2026-05-24T08:00:00Z',
              previous_expired: false,
              status: 'Bounced',
              error_message: 'Hard bounce: mailbox does not exist',
            },
          ],
        })}
      />,
    );

    expect(
      screen.getByText('System auto-resend of Px upload link failed to deliver'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Bounced/)).toBeInTheDocument();
    expect(screen.getByText(/by system/)).toBeInTheDocument();
    expect(
      screen.getByText('Hard bounce: mailbox does not exist'),
    ).toBeInTheDocument();
  });

  it('renders auto-chase escalation as its own distinct "call patient" row', () => {
    render(
      <OrderActivityTimeline
        order={makeOrder({
          auto_resends: [
            {
              sent_at: '2026-05-10T08:00:00Z',
              to_email: 'patient@example.com',
              expires_at: '2026-05-24T08:00:00Z',
              previous_expired: false,
              status: 'Delivered',
              error_message: null,
            },
            {
              sent_at: '2026-05-15T08:00:00Z',
              to_email: 'patient@example.com',
              expires_at: '2026-05-29T08:00:00Z',
              previous_expired: true,
              status: 'Delivered',
              error_message: null,
            },
          ],
          auto_chase_escalated_at: '2026-05-22T08:00:00Z',
        })}
      />,
    );

    expect(
      screen.getByText('Auto-chase escalated — staff to call patient'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Retry cap reached after 2 auto-resends/),
    ).toBeInTheDocument();
  });

  it('renders nothing auto-chase related when there are no auto_resends or escalation', () => {
    render(<OrderActivityTimeline order={makeOrder({})} />);
    expect(
      screen.queryByText(/System auto-resent Px upload link/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Auto-chase escalated/),
    ).not.toBeInTheDocument();
  });
});
