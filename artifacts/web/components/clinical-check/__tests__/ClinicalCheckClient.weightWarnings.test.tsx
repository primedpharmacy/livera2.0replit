/**
 * ClinicalCheckClient — Task-192.
 *
 * Pins the queue-level weight-warning indicators introduced in Task-136:
 *   • A row with concerning weight warnings that have NOT all been
 *     acknowledged renders an amber "N weight" pill.
 *   • A row where every concerning weight warning has been acknowledged
 *     renders the muted "Weight reviewed" pill.
 *   • The "Hide weight-warning reviewed" toggle filters fully-reviewed
 *     rows out of the queue while leaving unack'd rows visible.
 *   • Unacknowledged-warning rows sort above fully-reviewed rows even
 *     when the reviewed row is older (so the urgency boost wins over
 *     the oldest-first tiebreaker).
 *
 * These behaviours are spread across ClinicalCheckClient (toggle + sort)
 * and OrderListTable (pill rendering), so we render ClinicalCheckClient
 * end-to-end to cover the wiring between them.
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

// Minimal Clinic fixture — only the config fields ClinicalCheckClient and
// OrderListTable actually read. Cast through unknown so we don't have to
// stand up every unrelated config block (rule engines, comms, etc.).
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

// Weight history that triggers a `weight_regain` warning (latest reading
// is heavier than the previous one). Two readings is enough — extra
// detectors (plateau, rapid loss) need 3+ readings or large deltas.
const REGAIN_HISTORY: NonNullable<Order['weight_history']> = [
  { recorded_at: '2026-04-20T08:00:00Z', weight_kg: 95.0, bmi: 30.1 },
  { recorded_at: '2026-05-04T08:00:00Z', weight_kg: 96.5, bmi: 30.6 },
];

const patientNames = {
  'PT-PENDING': 'Pending Patient',
  'PT-REVIEWED': 'Reviewed Patient',
};

function renderQueue() {
  // The reviewed order was created EARLIER than the pending one, so under
  // the plain oldest-first tiebreaker it would sort first. The urgency
  // boost for unacknowledged warnings must flip that order.
  const reviewed = makeOrder({
    id: 'ORD-REVIEWED',
    patient_id: 'PT-REVIEWED',
    created_at: '2026-05-10T06:00:00Z',
    weight_history: REGAIN_HISTORY,
    weight_warning_acknowledgements: [
      {
        kind: 'weight_regain',
        acknowledged_by_user_id: 'USR-DR1',
        acknowledged_at: '2026-05-10T09:00:00Z',
        rationale: 'Discussed at follow-up — patient on holiday, agreed safe to continue.',
      },
    ],
  });
  const pending = makeOrder({
    id: 'ORD-PENDING',
    patient_id: 'PT-PENDING',
    created_at: '2026-05-11T06:00:00Z',
    weight_history: REGAIN_HISTORY,
    weight_warning_acknowledgements: null,
  });
  return render(
    <ClinicalCheckClient
      orders={[reviewed, pending]}
      clinic={clinic}
      clinicId="feeltru"
      patientNames={patientNames}
    />,
  );
}

function getRowFor(name: string): HTMLElement {
  // Each row's first cell shows the patient's display name; the closest
  // <tr> is the row we're interested in.
  const nameNode = screen.getByText(name);
  const row = nameNode.closest('tr');
  if (!row) throw new Error(`No <tr> found for ${name}`);
  return row;
}

describe('ClinicalCheckClient — weight-warning queue indicators (Task-192)', () => {
  afterEach(() => cleanup());

  it('shows the amber "N weight" pill on the unack\'d row and the muted "Weight reviewed" pill on the acknowledged row', () => {
    renderQueue();

    const pendingRow = getRowFor('Pending Patient');
    const pendingPill = within(pendingRow).getByText(/^\s*1 weight\s*$/);
    expect(pendingPill).toBeInTheDocument();
    expect(pendingPill).toHaveAttribute(
      'title',
      '1 concerning weight warning pending review',
    );

    const reviewedRow = getRowFor('Reviewed Patient');
    const reviewedPill = within(reviewedRow).getByText('Weight reviewed');
    expect(reviewedPill).toBeInTheDocument();
    expect(reviewedPill).toHaveAttribute(
      'title',
      'All 1 weight warning acknowledged',
    );

    // Cross-check: the muted pill must NOT appear on the pending row,
    // and the amber pill must NOT appear on the reviewed row.
    expect(within(pendingRow).queryByText('Weight reviewed')).not.toBeInTheDocument();
    expect(within(reviewedRow).queryByText(/^\s*\d+ weight\s*$/)).not.toBeInTheDocument();
  });

  it('sorts orders with unacknowledged warnings above fully-reviewed orders, beating the oldest-first tiebreaker', () => {
    renderQueue();

    const rows = screen.getAllByRole('row');
    // [0] is the <thead> row, [1..] are body rows in render order.
    const bodyRows = rows.slice(1);
    expect(bodyRows).toHaveLength(2);
    expect(within(bodyRows[0]).getByText('Pending Patient')).toBeInTheDocument();
    expect(within(bodyRows[1]).getByText('Reviewed Patient')).toBeInTheDocument();
  });

  it('hides fully-reviewed rows when the "Hide weight-warning reviewed" toggle is on, keeping unack\'d rows visible', async () => {
    const user = userEvent.setup();
    renderQueue();

    // Both rows visible by default.
    expect(screen.getByText('Reviewed Patient')).toBeInTheDocument();
    expect(screen.getByText('Pending Patient')).toBeInTheDocument();

    const toggle = screen.getByRole('checkbox', { name: /hide weight-warning reviewed/i });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);
    expect(toggle).toBeChecked();

    expect(screen.queryByText('Reviewed Patient')).not.toBeInTheDocument();
    expect(screen.getByText('Pending Patient')).toBeInTheDocument();

    // Toggling back off restores the reviewed row.
    await user.click(toggle);
    expect(screen.getByText('Reviewed Patient')).toBeInTheDocument();
  });
});
