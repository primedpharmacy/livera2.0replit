/**
 * OrderDetailClient — Task-171 / Task-252 replacement history.
 *
 * Pins the user-visible contract of the collapsible "Previous uploads"
 * section on the Patient-uploaded prescription card:
 *
 *   - Collapsed by default; the toggle shows the entry count.
 *   - Expanding reveals one row per `px_upload_history` entry, most-recent
 *     first, with the prior filename, the prior uploader + source label,
 *     and the swap-event line attributing the replacement.
 *   - Re-collapsing hides the rows again.
 *
 * The card lives deep inside OrderDetailClient (clinical_evidence tab —
 * which is the default tab). Heavy sibling cards / modals are stubbed so
 * the test renders quickly and is not coupled to their internals.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import type { Order, Patient, Clinic } from '@/types';
import { getClinicSync } from '@/lib/api/mock';

vi.mock('next/navigation', () => ({
  useParams: () => ({ clinic_id: 'feeltru' }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/feeltru/orders/ORD-RH1',
  notFound: () => {
    throw new Error('notFound');
  },
}));

// Skip the queue-prev/next prefetch entirely — it issues a network fetch
// against the orders listing on mount which we don't care about here.
vi.mock('@/lib/queueNavigation', () => ({
  useQueueNavigation: () => {},
}));

// Heavy sibling cards / panels that pull in their own data sources or
// portals. None of these own the replacement-history UI, so stubbing
// them keeps the test fast and focused on the behaviour under test.
vi.mock('@/components/orders/CourierTrackingCard', () => ({
  CourierTrackingCard: () => null,
}));
vi.mock('@/components/orders/OrderQuestionnaireCard', () => ({
  OrderQuestionnaireCard: () => null,
}));
vi.mock('@/components/orders/OrderActivityTimeline', () => ({
  OrderActivityTimeline: () => null,
}));
vi.mock('@/components/orders/OrderIntercomTab', () => ({
  OrderIntercomTab: () => null,
}));
vi.mock('@/components/orders/OrderNICEChecklistCard', () => ({
  OrderNICEChecklistCard: () => null,
}));
vi.mock('@/components/orders/OrderDoseEscalationGateCard', () => ({
  OrderDoseEscalationGateCard: () => null,
}));
vi.mock('@/components/orders/OrderWeightTrajectoryCard', () => ({
  OrderWeightTrajectoryCard: () => null,
}));
vi.mock('@/components/orders/OrderBMIValidationCard', () => ({
  OrderBMIValidationCard: () => null,
}));
vi.mock('@/components/pharmacy-comms/PharmacyCommsPanel', () => ({
  PharmacyCommsPanel: () => null,
}));
vi.mock('@/components/incidents/LogIncidentModal', () => ({
  LogIncidentModal: () => null,
}));
vi.mock('@/components/clinical-notes/ClinicalNoteEditor', () => ({
  ClinicalNoteEditor: () => null,
}));
vi.mock('@/components/timeline/RecentNotesCard', () => ({
  RecentNotesCard: () => null,
}));
vi.mock('@/components/sla/SlaTimerWidget', () => ({
  SlaTimerWidget: () => null,
}));
vi.mock('@/components/shared/QueuePositionIndicator', () => ({
  QueuePositionIndicator: () => null,
}));

import { OrderDetailClient } from '../OrderDetailClient';

const CLINIC: Clinic = (() => {
  const c = getClinicSync('feeltru');
  // Disable the AI-BMI card so the Clinical Evidence tab only renders
  // the prescription card (the section under test).
  c.config.features.bmi_ai_validation_enabled = false;
  return c;
})();

const PATIENT: Patient = {
  id: 'PT-RH-1',
  clinic_id: 'feeltru',
  demographic: {
    full_name: 'Replacement History Patient',
    dob: '1985-06-12',
    sex_at_birth: 'female',
    ethnicity: 'White British',
    address: { line1: '1 Test Street', city: 'London', postcode: 'SW1A 1AA' },
  },
  contact: { email: 'rh.patient@example.com', phone: '+447700900001', preferred_channel: 'email' },
  gp: null,
  baseline: { height_cm: 165, baseline_weight_kg: 92, baseline_bmi: 33.8 },
  latest: { weight_kg: 90, bmi: 33.1, recorded_at: '2026-05-01T10:00:00Z' },
  verification: {
    sumsub_id: 'sum_rh1',
    identity_verified_at: '2026-04-20T10:00:00Z',
    bmi_verified_at: '2026-04-20T10:00:00Z',
  },
  consents_given: [],
  flags: [],
  status: 'active',
  vip: false,
  coach_id: null,
  created_at: '2026-04-01T10:00:00Z',
  updated_at: '2026-05-01T10:00:00Z',
};

function makeOrder(): Order {
  return {
    id: 'ORD-RH1',
    clinic_id: 'feeltru',
    patient_id: PATIENT.id,
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
    contextual_flags: ['Px upload received'],
    intervention_raised_at: null,
    // The current (newest) prescription file.
    px_upload: {
      filename: 'rx_v3.pdf',
      size: 240_000,
      content_type: 'application/pdf',
      uploaded_at: '2026-05-09T14:00:00Z',
      object_path: '/objects/uploads/rx-v3',
      source: 'staff_upload',
      uploaded_by_user_id: 'user_claire',
    },
    // Two superseded entries, appended in chronological order — the UI
    // is expected to render them most-recent-first.
    px_upload_history: [
      {
        replaced_at: '2026-05-08T09:30:00Z',
        replaced_filename: 'rx_v1.jpg',
        replaced_by_user_id: null,
        replaced_by_source: 'email_link',
        prior_uploaded_at: '2026-05-07T11:00:00Z',
        prior_uploaded_by_user_id: null,
        prior_source: 'success_screen',
        prior_object_path: '/objects/uploads/rx-v1',
        prior_content_type: 'image/jpeg',
        prior_size: 180_000,
      },
      {
        replaced_at: '2026-05-09T14:00:00Z',
        replaced_filename: 'rx_v2.pdf',
        replaced_by_user_id: 'user_claire',
        replaced_by_source: 'staff_upload',
        prior_uploaded_at: '2026-05-08T09:30:00Z',
        prior_uploaded_by_user_id: null,
        prior_source: 'email_link',
        prior_object_path: '/objects/uploads/rx-v2',
        prior_content_type: 'application/pdf',
        prior_size: 210_000,
      },
    ],
    px_upload_link: null,
    expired_at: null,
    created_at: '2026-05-07T08:00:00Z',
    updated_at: '2026-05-09T14:00:00Z',
  };
}

function renderOrder(order: Order = makeOrder()) {
  return render(
    <OrderDetailClient
      initialOrder={order}
      patient={PATIENT}
      clinic={CLINIC}
      clinicId="feeltru"
      initialClinicalNotes={[]}
      orderNotifications={[]}
    />,
  );
}

describe('OrderDetailClient — Task-171 / Task-252 replacement history', () => {
  beforeEach(() => {
    // Heavy useEffects fetch over the network; jsdom would otherwise warn.
    // A no-op resolved Response keeps them quiet without affecting the UI.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ conversations: [] }), { status: 200 })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is collapsed by default and shows the count of prior uploads', () => {
    renderOrder();

    const section = screen.getByTestId('px-previous-uploads');
    const toggle = within(section).getByRole('button', { name: /previous uploads \(2\)/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Neither prior filename should be visible while collapsed.
    expect(within(section).queryByText('rx_v1.jpg')).not.toBeInTheDocument();
    expect(within(section).queryByText('rx_v2.pdf')).not.toBeInTheDocument();
  });

  it('expanding reveals both rows most-recent-first with filename, uploader and source', async () => {
    const user = userEvent.setup();
    renderOrder();

    const section = screen.getByTestId('px-previous-uploads');
    await user.click(within(section).getByRole('button', { name: /previous uploads \(2\)/i }));

    expect(
      within(section).getByRole('button', { name: /previous uploads \(2\)/i }),
    ).toHaveAttribute('aria-expanded', 'true');

    const rows = within(section).getAllByRole('listitem');
    expect(rows).toHaveLength(2);

    // Most recent (rx_v2.pdf — replaced 2026-05-09) appears first.
    expect(within(rows[0]).getByText('rx_v2.pdf')).toBeInTheDocument();
    // Prior file metadata: superseded rx_v2 was uploaded by the patient via email link.
    expect(within(rows[0]).getByText(/Uploaded by patient \(email link\) via email link/)).toBeInTheDocument();
    // Swap event attribution: replaced by Claire Moynehan via staff upload.
    expect(within(rows[0]).getByText(/Replaced .* by Claire Moynehan via staff upload/)).toBeInTheDocument();
    // The prior object is openable.
    expect(within(rows[0]).getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      '/api/storage/objects/uploads/rx-v2',
    );

    // Older entry (rx_v1.jpg — replaced 2026-05-08) renders second.
    expect(within(rows[1]).getByText('rx_v1.jpg')).toBeInTheDocument();
    expect(within(rows[1]).getByText(/Uploaded by patient/)).toBeInTheDocument();
    // Replaced via the patient's own email link (uploader_id is null → "patient").
    expect(within(rows[1]).getByText(/Replaced .* by patient via email link/)).toBeInTheDocument();
  });

  it('re-collapsing hides the rows again', async () => {
    const user = userEvent.setup();
    renderOrder();

    const section = screen.getByTestId('px-previous-uploads');
    const toggle = within(section).getByRole('button', { name: /previous uploads \(2\)/i });

    await user.click(toggle);
    expect(within(section).getAllByRole('listitem')).toHaveLength(2);

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(section).queryByRole('listitem')).not.toBeInTheDocument();
  });
});
