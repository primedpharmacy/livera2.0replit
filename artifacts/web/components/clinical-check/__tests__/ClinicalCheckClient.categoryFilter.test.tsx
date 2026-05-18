/**
 * ClinicalCheckClient — Task-256.
 *
 * Pins the safety-category filter above the Clinical Check queue:
 *   • Category chips render only for categories present in the current
 *     sub-queue, each with a count of orders carrying a flagged answer
 *     in that category.
 *   • Clicking a chip narrows the queue to only orders flagged with that
 *     category; clicking additional chips widens the selection (OR).
 *   • The filter co-exists with the existing chip filters (e.g. "Flagged
 *     only") rather than replacing them.
 *   • A "Clear" affordance resets the selection.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

import { ClinicalCheckClient } from '../ClinicalCheckClient';
import type { Order, Clinic, QuestionItem } from '@/types';

const QUESTIONS: QuestionItem[] = [
  {
    id: 'q_heart',
    label: 'Any history of heart disease?',
    type: 'yes_no',
    required: true,
    order: 1,
    safety_flag: true,
    safety_category: 'cardiac',
  },
  {
    id: 'q_mh',
    label: 'Any current mental health concerns?',
    type: 'yes_no',
    required: true,
    order: 2,
    safety_flag: true,
    safety_category: 'mental_health',
  },
  {
    id: 'q_allergy',
    label: 'Any known drug allergies?',
    type: 'yes_no',
    required: true,
    order: 3,
    safety_flag: true,
    safety_category: 'allergy',
  },
];

const clinic = {
  id: 'feeltru',
  config: {
    default_slas: { approval_warn_hours: 6, approval_breach_hours: 24 },
    questionnaire_order: QUESTIONS,
    questionnaire_reorder: QUESTIONS,
    weight_warning_thresholds: {
      bmi_continuation_floor: 27.5,
      rapid_loss_kg_per_week: 2,
      plateau_tolerance_kg: 0.3,
      plateau_min_readings: 3,
    },
  },
} as unknown as Clinic;

function makeOrder(
  overrides: Partial<Order> & Pick<Order, 'id' | 'patient_id'>,
): Order {
  return {
    clinic_id: 'feeltru',
    type: 'new',
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
  'PT-CARDIAC': 'Cardiac Patient',
  'PT-MENTAL': 'Mental Patient',
  'PT-ALLERGY': 'Allergy Patient',
  'PT-CLEAN': 'Clean Patient',
};

function renderQueue() {
  const cardiac = makeOrder({
    id: 'ORD-CARDIAC',
    patient_id: 'PT-CARDIAC',
    created_at: '2026-05-10T06:00:00Z',
    questionnaire_responses: { q_heart: 'yes', q_mh: 'no', q_allergy: 'no' },
  });
  const mental = makeOrder({
    id: 'ORD-MENTAL',
    patient_id: 'PT-MENTAL',
    created_at: '2026-05-10T07:00:00Z',
    questionnaire_responses: { q_heart: 'no', q_mh: 'yes', q_allergy: 'no' },
  });
  const allergy = makeOrder({
    id: 'ORD-ALLERGY',
    patient_id: 'PT-ALLERGY',
    created_at: '2026-05-10T08:00:00Z',
    questionnaire_responses: { q_heart: 'no', q_mh: 'no', q_allergy: 'yes' },
  });
  const clean = makeOrder({
    id: 'ORD-CLEAN',
    patient_id: 'PT-CLEAN',
    created_at: '2026-05-10T09:00:00Z',
    questionnaire_responses: { q_heart: 'no', q_mh: 'no', q_allergy: 'no' },
  });
  return render(
    <ClinicalCheckClient
      orders={[cardiac, mental, allergy, clean]}
      clinic={clinic}
      clinicId="feeltru"
      patientNames={patientNames}
    />,
  );
}

describe('ClinicalCheckClient — safety category filter (Task-256)', () => {
  afterEach(() => cleanup());

  it('renders a chip per present category with a count, hiding categories that have no orders', () => {
    renderQueue();

    const cardiacChip = screen.getByRole('button', { name: /Cardiac/ });
    const mentalChip  = screen.getByRole('button', { name: /Mental health/ });
    const allergyChip = screen.getByRole('button', { name: /Allergy/ });
    expect(cardiacChip).toHaveTextContent('1');
    expect(mentalChip).toHaveTextContent('1');
    expect(allergyChip).toHaveTextContent('1');

    // Pregnancy/safeguarding/medication have no flagged orders → no chip.
    expect(screen.queryByRole('button', { name: /Pregnancy/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Safeguarding/ })).toBeNull();
  });

  it('narrows the queue to a single category when its chip is clicked, and unions categories on additional clicks', () => {
    renderQueue();

    // All four orders visible by default.
    expect(screen.getByText('Cardiac Patient')).toBeInTheDocument();
    expect(screen.getByText('Mental Patient')).toBeInTheDocument();
    expect(screen.getByText('Allergy Patient')).toBeInTheDocument();
    expect(screen.getByText('Clean Patient')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cardiac/ }));
    expect(screen.getByText('Cardiac Patient')).toBeInTheDocument();
    expect(screen.queryByText('Mental Patient')).not.toBeInTheDocument();
    expect(screen.queryByText('Allergy Patient')).not.toBeInTheDocument();
    expect(screen.queryByText('Clean Patient')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mental health/ }));
    expect(screen.getByText('Cardiac Patient')).toBeInTheDocument();
    expect(screen.getByText('Mental Patient')).toBeInTheDocument();
    expect(screen.queryByText('Allergy Patient')).not.toBeInTheDocument();
    expect(screen.queryByText('Clean Patient')).not.toBeInTheDocument();

    // "Clear" resets to the full queue.
    fireEvent.click(screen.getByRole('button', { name: /Clear/ }));
    expect(screen.getByText('Clean Patient')).toBeInTheDocument();
  });

  it('composes with the existing "Flagged only" chip — only orders matching BOTH the category and the chip survive', () => {
    renderQueue();

    // Filter to cardiac → 1 order. Then click "Review needed" which keeps
    // orders with flagged answers — should still be the same single order.
    fireEvent.click(screen.getByRole('button', { name: /Cardiac/ }));
    fireEvent.click(screen.getByRole('button', { name: /Review needed/ }));

    expect(screen.getByText('Cardiac Patient')).toBeInTheDocument();
    expect(screen.queryByText('Mental Patient')).not.toBeInTheDocument();
    expect(screen.queryByText('Allergy Patient')).not.toBeInTheDocument();
    expect(screen.queryByText('Clean Patient')).not.toBeInTheDocument();
  });
});
