/**
 * OrderActivityTimeline — Task-177 resend audit trail rendering.
 *
 * Pins that:
 *   - Every entry in `px_upload_link.resends` produces its own timeline row.
 *   - Each row shows the staff member's full name (looked up via
 *     USERS_REGISTRY), the timestamp, and disambiguates "Resend N of M" so
 *     reviewers can see how many times the patient has been chased.
 *   - Resends whose `previous_expired` flag is true use the
 *     "re-issued (previous link had expired)" title; the others use the
 *     plain "resent to patient" title.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OrderActivityTimeline } from '../OrderActivityTimeline';
import { USERS_REGISTRY } from '@/lib/api/mock';
import type { Order } from '@/types';

function makeOrder(resends: NonNullable<NonNullable<Order['px_upload_link']>['resends']>): Order {
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
      resends,
    },
    expired_at: null,
    created_at: '2026-05-09T08:00:00Z',
    updated_at: '2026-05-09T08:00:00Z',
  };
}

describe('OrderActivityTimeline — Task-177 resend audit trail', () => {
  afterEach(() => cleanup());

  it('renders one timeline entry per resend with staff name and attempt index', () => {
    const staffId = Object.keys(USERS_REGISTRY)[0];
    const staffName = USERS_REGISTRY[staffId].full_name;

    render(
      <OrderActivityTimeline
        order={makeOrder([
          {
            sent_at: '2026-05-10T08:00:00Z',
            to_email: 'patient@example.com',
            expires_at: '2026-05-24T08:00:00Z',
            previous_expired: false,
            by_user_id: staffId,
          },
          {
            sent_at: '2026-05-12T08:00:00Z',
            to_email: 'patient@example.com',
            expires_at: '2026-05-26T08:00:00Z',
            previous_expired: false,
            by_user_id: staffId,
          },
          {
            sent_at: '2026-05-20T08:00:00Z',
            to_email: 'patient@example.com',
            expires_at: '2026-06-03T08:00:00Z',
            previous_expired: true,
            by_user_id: staffId,
          },
        ])}
      />,
    );

    expect(screen.getAllByText('Px upload link resent to patient')).toHaveLength(2);
    expect(
      screen.getByText('Px upload link re-issued (previous link had expired)'),
    ).toBeInTheDocument();

    expect(screen.getByText(/Resend 1 of 3/)).toBeInTheDocument();
    expect(screen.getByText(/Resend 2 of 3/)).toBeInTheDocument();
    expect(screen.getByText(/Resend 3 of 3/)).toBeInTheDocument();

    const staffMentions = screen.getAllByText(new RegExp(`by ${staffName}`));
    expect(staffMentions.length).toBeGreaterThanOrEqual(3);
  });

  it('does not render any resend entries when the resends array is empty', () => {
    render(<OrderActivityTimeline order={makeOrder([])} />);
    expect(screen.queryByText(/Px upload link resent to patient/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Px upload link re-issued/),
    ).not.toBeInTheDocument();
  });
});
