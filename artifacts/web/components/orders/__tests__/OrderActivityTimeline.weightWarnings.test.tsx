/**
 * Task-190 — OrderActivityTimeline renders weight-warning ack / edit / undo
 * as three separate audit entries (Task-99 + Task-135).
 *
 * Pins the append-only contract on the timeline itself: the original
 * acknowledgement, every rationale edit, and any reversal each get their own
 * dot + title so reviewers can read the full history without losing prior
 * context.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OrderActivityTimeline } from '../OrderActivityTimeline';
import type { Order } from '@/types';

function makeOrder(
  acks: NonNullable<Order['weight_warning_acknowledgements']>,
): Order {
  return {
    id: 'ORD-TW1',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    type: 'reorder',
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
    contextual_flags: [],
    intervention_raised_at: null,
    px_upload: null,
    px_upload_link: null,
    weight_warning_acknowledgements: acks,
    expired_at: null,
    created_at: '2026-05-09T08:00:00Z',
    updated_at: '2026-05-11T08:00:00Z',
  };
}

describe('OrderActivityTimeline — Task-190 weight-warning history', () => {
  afterEach(() => cleanup());

  it('renders ack → edit → undo as three separate entries', () => {
    const order = makeOrder([
      {
        kind: 'plateau',
        acknowledged_by_user_id: 'user_qadir',
        acknowledged_at: '2026-05-10T09:00:00Z',
        rationale: 'Original rationale here.',
        edits: [
          {
            edited_by_user_id: 'user_qadir',
            edited_at: '2026-05-10T10:00:00Z',
            previous_rationale: 'Original rationale here.',
            new_rationale: 'Updated rationale after further review.',
          },
        ],
        reversed_at: '2026-05-10T11:00:00Z',
        reversed_by_user_id: 'user_qadir',
        reversal_reason: 'Acknowledged the wrong chip by mistake.',
      },
    ]);

    render(<OrderActivityTimeline order={order} />);

    expect(
      screen.getByText('Weight warning acknowledged — plateau'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Weight warning rationale edited — plateau'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Weight warning acknowledgement undone — plateau'),
    ).toBeInTheDocument();

    // The original rationale survives intact on the ack entry, and the edit
    // entry surfaces both the new and previous text — nothing silently
    // overwritten.
    expect(screen.getByText('Original rationale here.')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Updated to: “Updated rationale after further review\.” · Previously: “Original rationale here\.”/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Acknowledged the wrong chip by mistake.'),
    ).toBeInTheDocument();
  });

  it('renders nothing weight-warning related when there are no acknowledgements', () => {
    render(<OrderActivityTimeline order={makeOrder([])} />);
    expect(screen.queryByText(/Weight warning/)).not.toBeInTheDocument();
  });
});
