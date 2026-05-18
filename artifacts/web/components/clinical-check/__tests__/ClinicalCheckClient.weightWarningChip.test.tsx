/**
 * ClinicalCheckClient — Task-281.
 *
 * Pins the "Weight warning" filter chip in the clinical-check queue header:
 *   • The chip's count badge equals the number of orders in the *current
 *     sub-queue* that still have at least one unacknowledged weight warning.
 *   • The chip is disabled when that count is zero and clicking it has no
 *     effect on the visible rows.
 *   • Clicking the chip when the count is non-zero narrows the queue to
 *     only those orders.
 *   • Switching sub-queues (e.g. "Awaiting BMI") rescopes the count to the
 *     orders inside that sub-queue, not the full queue.
 *
 * The chip lives in ClinicalCheckClient itself, so we render the component
 * end-to-end and assert against the visible queue rows.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
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

// A weight history that triggers exactly one `weight_regain` warning. Two
// readings is enough — plateau/rapid-loss detectors need 3+ readings or a
// larger delta, so neither is fired here.
const REGAIN_HISTORY: NonNullable<Order['weight_history']> = [
  { recorded_at: '2026-04-20T08:00:00Z', weight_kg: 95.0, bmi: 30.1 },
  { recorded_at: '2026-05-04T08:00:00Z', weight_kg: 96.5, bmi: 30.6 },
];

function getChipButton(label: RegExp | string): HTMLButtonElement {
  return screen.getByRole('button', { name: label }) as HTMLButtonElement;
}

function getRowFor(name: string): HTMLElement {
  const nameNode = screen.getByText(name);
  const row = nameNode.closest('tr');
  if (!row) throw new Error(`No <tr> found for ${name}`);
  return row;
}

describe('ClinicalCheckClient — Weight warning chip (Task-281)', () => {
  afterEach(() => cleanup());

  it("shows a count equal to the number of orders in the current sub-queue with an unacknowledged weight warning", () => {
    // Two unack'd warning rows + one acknowledged row + one with no warnings
    // at all → chip count should be 2.
    const unackA = makeOrder({
      id: 'ORD-UNACK-A',
      patient_id: 'PT-UNACK-A',
      weight_history: REGAIN_HISTORY,
    });
    const unackB = makeOrder({
      id: 'ORD-UNACK-B',
      patient_id: 'PT-UNACK-B',
      weight_history: REGAIN_HISTORY,
    });
    const reviewed = makeOrder({
      id: 'ORD-REVIEWED',
      patient_id: 'PT-REVIEWED',
      weight_history: REGAIN_HISTORY,
      weight_warning_acknowledgements: [
        {
          kind: 'weight_regain',
          acknowledged_by_user_id: 'USR-DR1',
          acknowledged_at: '2026-05-10T09:00:00Z',
          rationale: 'Patient on holiday — agreed safe to continue.',
        },
      ],
    });
    const clean = makeOrder({ id: 'ORD-CLEAN', patient_id: 'PT-CLEAN' });

    render(
      <ClinicalCheckClient
        orders={[unackA, unackB, reviewed, clean]}
        clinic={clinic}
        clinicId="feeltru"
        patientNames={{
          'PT-UNACK-A': 'Unack A',
          'PT-UNACK-B': 'Unack B',
          'PT-REVIEWED': 'Reviewed Patient',
          'PT-CLEAN': 'Clean Patient',
        }}
      />,
    );

    const chip = getChipButton(/Weight warning/);
    expect(chip).not.toBeDisabled();
    expect(chip).toHaveTextContent('2');
  });

  it('disables the chip when no order in the current sub-queue has an unacknowledged weight warning, and a click does not filter the queue', () => {
    // Only acknowledged + clean rows → unack'd count is zero.
    const reviewed = makeOrder({
      id: 'ORD-REVIEWED',
      patient_id: 'PT-REVIEWED',
      weight_history: REGAIN_HISTORY,
      weight_warning_acknowledgements: [
        {
          kind: 'weight_regain',
          acknowledged_by_user_id: 'USR-DR1',
          acknowledged_at: '2026-05-10T09:00:00Z',
          rationale: 'Reviewed and safe.',
        },
      ],
    });
    const clean = makeOrder({ id: 'ORD-CLEAN', patient_id: 'PT-CLEAN' });

    render(
      <ClinicalCheckClient
        orders={[reviewed, clean]}
        clinic={clinic}
        clinicId="feeltru"
        patientNames={{
          'PT-REVIEWED': 'Reviewed Patient',
          'PT-CLEAN': 'Clean Patient',
        }}
      />,
    );

    const chip = getChipButton(/Weight warning/);
    expect(chip).toBeDisabled();
    // No count badge is rendered when count is 0.
    expect(chip).not.toHaveTextContent(/\d/);

    // Click is a no-op on a disabled chip — both rows stay visible.
    fireEvent.click(chip);
    expect(screen.getByText('Reviewed Patient')).toBeInTheDocument();
    expect(screen.getByText('Clean Patient')).toBeInTheDocument();
  });

  it('narrows the queue to only orders with an unacknowledged weight warning when clicked', () => {
    const unack = makeOrder({
      id: 'ORD-UNACK',
      patient_id: 'PT-UNACK',
      weight_history: REGAIN_HISTORY,
    });
    const reviewed = makeOrder({
      id: 'ORD-REVIEWED',
      patient_id: 'PT-REVIEWED',
      weight_history: REGAIN_HISTORY,
      weight_warning_acknowledgements: [
        {
          kind: 'weight_regain',
          acknowledged_by_user_id: 'USR-DR1',
          acknowledged_at: '2026-05-10T09:00:00Z',
          rationale: 'Reviewed and safe.',
        },
      ],
    });
    const clean = makeOrder({ id: 'ORD-CLEAN', patient_id: 'PT-CLEAN' });

    render(
      <ClinicalCheckClient
        orders={[unack, reviewed, clean]}
        clinic={clinic}
        clinicId="feeltru"
        patientNames={{
          'PT-UNACK': 'Unack Patient',
          'PT-REVIEWED': 'Reviewed Patient',
          'PT-CLEAN': 'Clean Patient',
        }}
      />,
    );

    // All three rows visible by default.
    expect(screen.getByText('Unack Patient')).toBeInTheDocument();
    expect(screen.getByText('Reviewed Patient')).toBeInTheDocument();
    expect(screen.getByText('Clean Patient')).toBeInTheDocument();

    fireEvent.click(getChipButton(/Weight warning/));

    expect(screen.getByText('Unack Patient')).toBeInTheDocument();
    expect(screen.queryByText('Reviewed Patient')).not.toBeInTheDocument();
    expect(screen.queryByText('Clean Patient')).not.toBeInTheDocument();
  });

  it('rescopes the chip count when the sub-queue changes (e.g. "Awaiting BMI")', () => {
    // Two unack'd warning orders in the full queue, but only ONE of them is
    // in the "Awaiting BMI" sub-queue. Switching to that sub-queue should
    // drop the chip count from 2 → 1.
    const unackAwaitingBmi = makeOrder({
      id: 'ORD-UNACK-BMI',
      patient_id: 'PT-UNACK-BMI',
      weight_history: REGAIN_HISTORY,
      contextual_flags: ['Awaiting BMI'],
    });
    const unackAllOnly = makeOrder({
      id: 'ORD-UNACK-ALL',
      patient_id: 'PT-UNACK-ALL',
      weight_history: REGAIN_HISTORY,
    });
    // A no-warning order also living in the BMI sub-queue, to prove the
    // count reflects unack'd warnings (not just sub-queue size).
    const cleanAwaitingBmi = makeOrder({
      id: 'ORD-CLEAN-BMI',
      patient_id: 'PT-CLEAN-BMI',
      contextual_flags: ['Awaiting BMI'],
    });

    render(
      <ClinicalCheckClient
        orders={[unackAwaitingBmi, unackAllOnly, cleanAwaitingBmi]}
        clinic={clinic}
        clinicId="feeltru"
        patientNames={{
          'PT-UNACK-BMI': 'Unack BMI Patient',
          'PT-UNACK-ALL': 'Unack All-Only Patient',
          'PT-CLEAN-BMI': 'Clean BMI Patient',
        }}
      />,
    );

    // Default sub-queue is "All" → chip counts both unack'd orders.
    expect(getChipButton(/Weight warning/)).toHaveTextContent('2');

    // Switch to the "Awaiting BMI" sub-queue. The sub-queue tab is rendered
    // as a button labelled with its title.
    fireEvent.click(screen.getByRole('button', { name: /Awaiting BMI/i }));

    const scopedChip = getChipButton(/Weight warning/);
    expect(scopedChip).toHaveTextContent('1');
    expect(scopedChip).not.toBeDisabled();

    // Clicking it should leave only the BMI-sub-queue order with an
    // unacknowledged warning visible.
    fireEvent.click(scopedChip);
    expect(screen.getByText('Unack BMI Patient')).toBeInTheDocument();
    expect(screen.queryByText('Unack All-Only Patient')).not.toBeInTheDocument();
    expect(screen.queryByText('Clean BMI Patient')).not.toBeInTheDocument();
  });

  it('disables the chip after switching to a sub-queue whose orders have no unacknowledged weight warnings', () => {
    // Unack'd warning lives in "All" only; "Awaiting BMI" sub-queue contains
    // only a clean order → chip should disable on switch.
    const unack = makeOrder({
      id: 'ORD-UNACK',
      patient_id: 'PT-UNACK',
      weight_history: REGAIN_HISTORY,
    });
    const cleanAwaitingBmi = makeOrder({
      id: 'ORD-CLEAN-BMI',
      patient_id: 'PT-CLEAN-BMI',
      contextual_flags: ['Awaiting BMI'],
    });

    render(
      <ClinicalCheckClient
        orders={[unack, cleanAwaitingBmi]}
        clinic={clinic}
        clinicId="feeltru"
        patientNames={{
          'PT-UNACK': 'Unack Patient',
          'PT-CLEAN-BMI': 'Clean BMI Patient',
        }}
      />,
    );

    expect(getChipButton(/Weight warning/)).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Awaiting BMI/i }));

    const scopedChip = getChipButton(/Weight warning/);
    expect(scopedChip).toBeDisabled();
    expect(scopedChip).not.toHaveTextContent(/\d/);
    // The clean BMI row is still visible — the chip didn't filter it out.
    expect(within(getRowFor('Clean BMI Patient'))).toBeTruthy();
  });
});
