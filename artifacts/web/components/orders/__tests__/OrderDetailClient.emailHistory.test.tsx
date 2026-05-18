/**
 * OrderDetailClient — Task-178 email history.
 *
 * Locks in the user-visible contract of the collapsible "Email history"
 * block on the Px-upload card:
 *
 *   - One row per send attempt sourced from `px_upload_link` (initial
 *     send + every resend) and the audit log
 *     (`px_upload_link_resend_suppressed` cool-down events).
 *   - Rows render chronologically (oldest → newest).
 *   - Each row shows the right outcome badge (Delivered / Bounced /
 *     Failed / Rate-limited) and the actor's display name.
 *
 * Heavy sibling cards are stubbed (mirroring the Task-171/252 test) so
 * the test stays fast and focused on the email-history rendering.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import type { Order, Patient, Clinic } from '@/types';
import { getClinicSync } from '@/lib/api/mock';
import { MOCK_ORDER_AUDIT_EVENTS } from '@/lib/api/fixtures/orders';

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
  usePathname: () => '/feeltru/orders/ORD-EH1',
  notFound: () => {
    throw new Error('notFound');
  },
}));

vi.mock('@/lib/queueNavigation', () => ({
  useQueueNavigation: () => {},
}));

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

const ORDER_ID = 'ORD-EH1';

const CLINIC: Clinic = (() => {
  const c = getClinicSync('feeltru');
  c.config.features.bmi_ai_validation_enabled = false;
  return c;
})();

const PATIENT: Patient = {
  id: 'PT-EH-1',
  clinic_id: 'feeltru',
  demographic: {
    full_name: 'Email History Patient',
    dob: '1985-06-12',
    sex_at_birth: 'female',
    ethnicity: 'White British',
    address: { line1: '1 Test Street', city: 'London', postcode: 'SW1A 1AA' },
  },
  contact: {
    email: 'eh.patient@example.com',
    phone: '+447700900001',
    preferred_channel: 'email',
  },
  gp: null,
  baseline: { height_cm: 165, baseline_weight_kg: 92, baseline_bmi: 33.8 },
  latest: { weight_kg: 90, bmi: 33.1, recorded_at: '2026-05-01T10:00:00Z' },
  verification: {
    sumsub_id: 'sum_eh1',
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
    id: ORDER_ID,
    clinic_id: 'feeltru',
    patient_id: PATIENT.id,
    type: 'new',
    status: 'clinical_check',
    product: {
      medication: 'Mounjaro',
      dose: '7.5mg',
      strength: 'pre-filled pen',
      plan: '4 weeks',
    },
    questionnaire_responses: {},
    amendment_window: 'pre_approval',
    primed_order_id: null,
    primed_clinical_check_completed: false,
    ryft_authorisation_id: null,
    amount_charged: null,
    amount_authorised: 149,
    clinical_decision: null,
    sla_warn_at: '2026-05-18T11:00:00Z',
    sla_breach_at: '2026-05-19T11:00:00Z',
    g6_flags: [],
    contextual_flags: ['Px upload pending'],
    intervention_raised_at: null,
    px_upload: null,
    // Fixture: initial Bounced → Delivered resend → (mid-window cool-down
    // suppression sourced from the audit log) → final Delivered resend.
    px_upload_link: {
      token: 'pxlnk_eh_v3',
      expires_at: '2026-05-21T14:05:00Z',
      sent_at: '2026-05-09T14:05:00Z',
      first_sent_at: '2026-05-09T08:32:00Z',
      consumed_at: null,
      email_message_id: 'pm-msg-eh-3',
      to_email: 'eh.patient@example.com',
      initial_attempted_at: '2026-05-08T16:14:00Z',
      initial_to_email: 'eh.patient@exmple.com',
      initial_send_status: 'Bounced',
      initial_send_error_message:
        'Postmark hard-bounce: mailbox does not exist (exmple.com).',
      initial_send_by_user_id: null,
      resends: [
        {
          sent_at: '2026-05-09T08:32:00Z',
          attempted_at: '2026-05-09T08:32:00Z',
          to_email: 'eh.patient@example.com',
          expires_at: '2026-05-16T08:32:00Z',
          previous_expired: false,
          by_user_id: 'user_claire',
          status: 'Delivered',
          error_message: null,
        },
        {
          sent_at: '2026-05-09T14:05:00Z',
          attempted_at: '2026-05-09T14:05:00Z',
          to_email: 'eh.patient@example.com',
          expires_at: '2026-05-21T14:05:00Z',
          previous_expired: false,
          by_user_id: 'user_mobeen',
          status: 'Delivered',
          error_message: null,
        },
      ],
      reminder_sent_at: null,
      final_reminder_sent_at: null,
    },
    expired_at: null,
    created_at: '2026-05-08T16:00:00Z',
    updated_at: '2026-05-09T14:05:30Z',
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

describe('OrderDetailClient — Task-178 email history', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ conversations: [] }), { status: 200 }),
      ),
    );
    // Seed an in-window cool-down suppression event scoped to this test's
    // order id so getOrderAuditEvents surfaces it in the history.
    MOCK_ORDER_AUDIT_EVENTS.push({
      order_id: ORDER_ID,
      clinic_id: 'feeltru',
      event_type: 'px_upload_link_resend_suppressed',
      actor_user_id: 'user_claire',
      occurred_at: '2026-05-09T10:00:00Z',
      payload: {
        reason: 'cooldown',
        to_email: 'eh.patient@example.com',
        cooldown_seconds: 60,
        remaining_seconds: 30,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // Remove any audit events seeded by this suite so we don't leak
    // state into other tests that share the in-memory array.
    for (let i = MOCK_ORDER_AUDIT_EVENTS.length - 1; i >= 0; i--) {
      if (MOCK_ORDER_AUDIT_EVENTS[i].order_id === ORDER_ID) {
        MOCK_ORDER_AUDIT_EVENTS.splice(i, 1);
      }
    }
  });

  it('renders one chronologically-ordered row per attempt with the correct outcome and actor', async () => {
    const user = userEvent.setup();
    renderOrder();

    // Header reflects the 4 attempts (initial + 2 resends + 1 suppressed).
    const toggle = screen.getByRole('button', { name: /email history \(4\)/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const list = toggle.parentElement!.querySelector('ul');
    expect(list).not.toBeNull();
    const rows = within(list as HTMLElement).getAllByRole('listitem');
    expect(rows).toHaveLength(4);

    // Row 1 — Initial bounce (system / intake auto-send → "System (intake)").
    expect(within(rows[0]).getByText('Initial')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Bounced')).toBeInTheDocument();
    expect(within(rows[0]).getByText('System (intake)')).toBeInTheDocument();
    expect(within(rows[0]).getByText('eh.patient@exmple.com')).toBeInTheDocument();
    expect(
      within(rows[0]).getByText(/Postmark hard-bounce/i),
    ).toBeInTheDocument();

    // Row 2 — First successful resend by Claire.
    expect(within(rows[1]).getByText('Resend')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Delivered')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Claire Moynehan')).toBeInTheDocument();

    // Row 3 — Cool-down-suppressed attempt by Claire (sourced from audit log).
    expect(within(rows[2]).getByText('Suppressed')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Rate-limited')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Claire Moynehan')).toBeInTheDocument();
    expect(
      within(rows[2]).getByText(/Cool-down active \(60s window\)/i),
    ).toBeInTheDocument();

    // Row 4 — Final Delivered resend by Mobeen.
    expect(within(rows[3]).getByText('Resend')).toBeInTheDocument();
    expect(within(rows[3]).getByText('Delivered')).toBeInTheDocument();
    expect(within(rows[3]).getByText('Mobeen Alam')).toBeInTheDocument();
  });
});
