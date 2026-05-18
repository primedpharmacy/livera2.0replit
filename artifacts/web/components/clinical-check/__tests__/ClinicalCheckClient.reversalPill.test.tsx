/**
 * ClinicalCheckClient — Task-238.
 *
 * Pins the queue-level "Reversed from <decision>" pill that surfaces on
 * clinical-check rows when an order is back in the queue because a prior
 * decision was reversed. Renders ClinicalCheckClient end-to-end so the
 * test pins the wiring between client + OrderListTable.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

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

const patientNames = {
  'PT-FRESH': 'Fresh Patient',
  'PT-REVERSED': 'Reversed Patient',
};

function renderQueue() {
  const fresh = makeOrder({ id: 'ORD-FRESH', patient_id: 'PT-FRESH' });
  const reversed = makeOrder({
    id: 'ORD-REVERSED',
    patient_id: 'PT-REVERSED',
    reversal_log: [
      {
        reversed_at: '2026-05-12T09:30:00Z',
        reversed_by_user_id: 'user_claire',
        prior_decision: 'approved',
        prior_decided_at: '2026-05-11T08:00:00Z',
        prior_prescriber_user_id: 'user_mobeen',
        prior_rationale: 'Looked fine on first pass.',
        reason: 'Patient phoned in disclosing recent ED diagnosis — needs re-review.',
        clinical_note_id: 'NOTE-1',
      },
    ],
  });
  return render(
    <ClinicalCheckClient
      orders={[fresh, reversed]}
      clinic={clinic}
      clinicId="feeltru"
      patientNames={patientNames}
    />,
  );
}

function getRowFor(name: string): HTMLElement {
  const row = screen.getByText(name).closest('tr');
  if (!row) throw new Error(`No <tr> found for ${name}`);
  return row;
}

describe('ClinicalCheckClient — reversal pill (Task-238)', () => {
  afterEach(() => cleanup());

  it('renders the "Reversed from <decision> by <reverser>" pill only on rows whose order has a reversal_log entry', () => {
    renderQueue();
    const reversedRow = getRowFor('Reversed Patient');
    const pill = within(reversedRow).getByText(
      /Reversed from approved by Claire Moynehan/,
    );
    expect(pill).toBeInTheDocument();

    const freshRow = getRowFor('Fresh Patient');
    expect(within(freshRow).queryByText(/Reversed from/)).not.toBeInTheDocument();
  });

  it('reveals the written reason on hover', async () => {
    const user = userEvent.setup();
    renderQueue();
    const reversedRow = getRowFor('Reversed Patient');
    const pill = within(reversedRow).getByText(
      /Reversed from approved by Claire Moynehan/,
    );
    await user.hover(pill);
    const tooltip = await within(reversedRow).findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Claire Moynehan');
    expect(tooltip).toHaveTextContent(
      'Patient phoned in disclosing recent ED diagnosis — needs re-review.',
    );
  });
});
