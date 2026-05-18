/**
 * ClinicalCheckClient — Task-280.
 *
 * Pins the row-level "Acknowledge weight warning" affordance:
 *   • A row with at least one unacknowledged weight warning renders an
 *     "Acknowledge" button right next to the amber "N weight" pill.
 *   • Activating it opens a small inline rationale form, calls the same
 *     acknowledgement mock used by the slide-over flow, and patches the
 *     row in-place — flipping the amber pill to the muted "Weight
 *     reviewed" indicator without a page reload.
 *   • A teammate's existing acknowledgement on a different warning kind
 *     is preserved (we only acknowledge still-unacknowledged kinds).
 *   • Clicking the button never opens the slide-over (the propagation
 *     guard on the button stops the row's onClick from firing).
 */

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the acknowledgement mock so we don't depend on MOCK_ORDERS containing
// our synthetic fixtures. The handler still gets to fan-out across each
// kind and patches local state via the returned order.
const acknowledgeSpy = vi.fn();
vi.mock('@/lib/api/mock', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/mock')>('@/lib/api/mock');
  return {
    ...actual,
    acknowledgeWeightWarning: (...args: unknown[]) => acknowledgeSpy(...args),
  };
});

import { ClinicalCheckClient } from '../ClinicalCheckClient';
import type { Order, Clinic } from '@/types';

const clinic = {
  id: 'feeltru',
  config: {
    default_slas: { approval_warn_hours: 6, approval_breach_hours: 24 },
    questionnaire_order: [],
    questionnaire_reorder: [],
    weight_warning_thresholds: {
      bmi_continuation_floor: 27.5,
      rapid_loss_kg_per_week: 2,
      plateau_tolerance_kg: 0.3,
      plateau_min_readings: 3,
    },
  },
} as unknown as Clinic;

function makeOrder(overrides: Partial<Order> & Pick<Order, 'id' | 'patient_id'>): Order {
  return {
    clinic_id: 'feeltru',
    type: 'reorder',
    status: 'clinical_check',
    product: { medication: 'Mounjaro', dose: '5mg', strength: 'pre-filled pen', plan: '4 weeks' },
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
    expired_at: null,
    px_upload: null,
    px_upload_link: null,
    created_at: '2026-05-11T07:00:00Z',
    updated_at: '2026-05-11T07:00:00Z',
    ...overrides,
  } as Order;
}

// Weight regain — two readings, latest heavier than the previous one.
const REGAIN_HISTORY: NonNullable<Order['weight_history']> = [
  { recorded_at: '2026-04-20T08:00:00Z', weight_kg: 95.0, bmi: 30.1 },
  { recorded_at: '2026-05-04T08:00:00Z', weight_kg: 96.5, bmi: 30.6 },
];

const patientNames = {
  'PT-PENDING': 'Pending Patient',
};

function getRowFor(name: string): HTMLElement {
  const nameNode = screen.getByText(name);
  const row = nameNode.closest('tr');
  if (!row) throw new Error(`No <tr> found for ${name}`);
  return row;
}

describe('ClinicalCheckClient — row-level acknowledge weight warning (Task-280)', () => {
  beforeEach(() => {
    acknowledgeSpy.mockReset();
  });
  afterEach(() => cleanup());

  it('acknowledges the row\'s unacknowledged warning from the queue and flips the pill to reviewed without a page reload', async () => {
    const user = userEvent.setup();
    const pending = makeOrder({
      id: 'ORD-PENDING',
      patient_id: 'PT-PENDING',
      weight_history: REGAIN_HISTORY,
      weight_warning_acknowledgements: null,
    });

    // Stub the mock to return the order with a fresh acknowledgement on
    // the weight_regain kind so the parent's setOrders call moves the row
    // into the "reviewed" branch on the next render.
    acknowledgeSpy.mockImplementation(
      async (
        _clinicId: string,
        _orderId: string,
        kind: 'weight_regain' | 'plateau' | 'rapid_loss' | 'bmi_below_threshold',
        rationale: string,
      ) => ({
        ...pending,
        weight_warning_acknowledgements: [
          {
            kind,
            acknowledged_by_user_id: 'USR-CURRENT',
            acknowledged_at: '2026-05-12T09:00:00Z',
            rationale,
          },
        ],
      }),
    );

    render(
      <ClinicalCheckClient
        orders={[pending]}
        clinic={clinic}
        clinicId="feeltru"
        patientNames={patientNames}
      />,
    );

    // Sanity — the amber pill is on the row to start with.
    const row = getRowFor('Pending Patient');
    expect(within(row).getByText(/^\s*1 weight\s*$/)).toBeInTheDocument();
    expect(within(row).queryByText('Weight reviewed')).not.toBeInTheDocument();

    // Open the row-level acknowledge popover.
    const ackBtn = within(row).getByRole('button', { name: /acknowledge weight warning/i });
    await user.click(ackBtn);

    // Slide-over must NOT have opened — the button stops propagation. The
    // slide-over renders a "Clinical Check" heading inside the panel.
    expect(screen.queryByRole('heading', { name: /clinical check/i })).not.toBeInTheDocument();

    const dialog = await screen.findByRole('dialog', { name: /acknowledge weight warning/i });
    const textarea = within(dialog).getByRole('textbox');
    await user.type(textarea, 'Patient on holiday — discussed at follow-up.');
    await user.click(within(dialog).getByRole('button', { name: /save acknowledgement/i }));

    // The mock was called exactly once (only the weight_regain kind was
    // unacknowledged) with the captured rationale + clinic thresholds.
    await waitFor(() => expect(acknowledgeSpy).toHaveBeenCalledTimes(1));
    expect(acknowledgeSpy).toHaveBeenCalledWith(
      'feeltru',
      'ORD-PENDING',
      'weight_regain',
      'Patient on holiday — discussed at follow-up.',
      clinic.config.weight_warning_thresholds,
    );

    // The row updated in place — amber pill is gone, muted "Weight reviewed"
    // pill is now visible, no full re-render or navigation was required.
    const updatedRow = getRowFor('Pending Patient');
    await waitFor(() =>
      expect(within(updatedRow).getByText('Weight reviewed')).toBeInTheDocument(),
    );
    expect(within(updatedRow).queryByText(/^\s*1 weight\s*$/)).not.toBeInTheDocument();
  });

  it('preserves a teammate\'s prior acknowledgement on a different warning kind (only acknowledges still-unack\'d kinds)', async () => {
    const user = userEvent.setup();

    // Build a history that triggers BOTH weight_regain and plateau warnings:
    //   - 3 readings all within 0.3kg of each other (plateau threshold)
    //   - latest reading heavier than the previous one (weight regain)
    const REGAIN_AND_PLATEAU: NonNullable<Order['weight_history']> = [
      { recorded_at: '2026-04-13T08:00:00Z', weight_kg: 95.0, bmi: 30.1 },
      { recorded_at: '2026-04-20T08:00:00Z', weight_kg: 94.9, bmi: 30.1 },
      { recorded_at: '2026-05-04T08:00:00Z', weight_kg: 95.1, bmi: 30.1 },
    ];
    const teammateAck = {
      kind: 'plateau' as const,
      acknowledged_by_user_id: 'USR-DR-OTHER',
      acknowledged_at: '2026-05-05T09:00:00Z',
      rationale: 'Reviewed plateau at last consult.',
    };
    const order = makeOrder({
      id: 'ORD-MIXED',
      patient_id: 'PT-PENDING',
      weight_history: REGAIN_AND_PLATEAU,
      weight_warning_acknowledgements: [teammateAck],
    });

    acknowledgeSpy.mockImplementation(
      async (
        _clinicId: string,
        _orderId: string,
        kind: 'weight_regain' | 'plateau' | 'rapid_loss' | 'bmi_below_threshold',
        rationale: string,
      ) => ({
        ...order,
        weight_warning_acknowledgements: [
          teammateAck,
          {
            kind,
            acknowledged_by_user_id: 'USR-CURRENT',
            acknowledged_at: '2026-05-12T09:00:00Z',
            rationale,
          },
        ],
      }),
    );

    render(
      <ClinicalCheckClient
        orders={[order]}
        clinic={clinic}
        clinicId="feeltru"
        patientNames={patientNames}
      />,
    );

    const row = getRowFor('Pending Patient');
    await user.click(within(row).getByRole('button', { name: /acknowledge weight warning/i }));

    const dialog = await screen.findByRole('dialog', { name: /acknowledge weight warning/i });
    await user.type(within(dialog).getByRole('textbox'), 'OK to proceed.');
    await user.click(within(dialog).getByRole('button', { name: /save acknowledgement/i }));

    // Only the still-unack'd kind (weight_regain) is sent — the teammate's
    // existing plateau acknowledgement is never re-submitted.
    await waitFor(() => expect(acknowledgeSpy).toHaveBeenCalledTimes(1));
    const calledKinds = acknowledgeSpy.mock.calls.map((c) => c[2]);
    expect(calledKinds).toEqual(['weight_regain']);
    expect(calledKinds).not.toContain('plateau');
  });
});
