/**
 * OrderActivityTimeline — Task-92 reminder rendering.
 *
 * Pins that:
 *   - When `px_upload_link.reminder_sent_at` is set, the timeline shows
 *     "Px upload reminder emailed to patient".
 *   - When `px_upload_link.final_reminder_sent_at` is set, the timeline shows
 *     "Final Px upload reminder emailed to patient".
 *   - When neither flag is set, neither entry renders.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OrderActivityTimeline } from '../OrderActivityTimeline';
import type { Order } from '@/types';

function makeOrder(overrides: Partial<NonNullable<Order['px_upload_link']>> = {}): Order {
  return {
    id: 'ORD-T1',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
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
      sent_at: '2026-05-09T08:00:00Z',
      consumed_at: null,
      email_message_id: 'mid',
      to_email: 'patient@example.com',
      reminder_sent_at: null,
      final_reminder_sent_at: null,
      ...overrides,
    },
    expired_at: null,
    created_at: '2026-05-09T08:00:00Z',
    updated_at: '2026-05-09T08:00:00Z',
  };
}

describe('OrderActivityTimeline — Task-92 reminders', () => {
  afterEach(() => cleanup());

  it('renders a reminder entry when reminder_sent_at is set', () => {
    render(<OrderActivityTimeline order={makeOrder({ reminder_sent_at: '2026-05-11T08:00:00Z' })} />);
    expect(screen.getByText('Px upload reminder emailed to patient')).toBeInTheDocument();
    expect(screen.queryByText('Final Px upload reminder emailed to patient')).not.toBeInTheDocument();
  });

  it('renders a final reminder entry when final_reminder_sent_at is set', () => {
    render(
      <OrderActivityTimeline
        order={makeOrder({
          reminder_sent_at: '2026-05-11T08:00:00Z',
          final_reminder_sent_at: '2026-05-24T10:00:00Z',
        })}
      />,
    );
    expect(screen.getByText('Final Px upload reminder emailed to patient')).toBeInTheDocument();
    expect(screen.getByText('Px upload reminder emailed to patient')).toBeInTheDocument();
  });

  it('renders neither reminder entry when both flags are null', () => {
    render(<OrderActivityTimeline order={makeOrder()} />);
    expect(screen.queryByText('Px upload reminder emailed to patient')).not.toBeInTheDocument();
    expect(screen.queryByText('Final Px upload reminder emailed to patient')).not.toBeInTheDocument();
  });
});
