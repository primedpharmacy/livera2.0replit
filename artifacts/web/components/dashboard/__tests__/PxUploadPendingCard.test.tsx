/**
 * PxUploadPendingCard — Task-176 coverage.
 *
 * Pins the dashboard widget's rendering and resend interaction:
 *   - row labels for fresh / 5+ day old / expired-token / multi-resend orders
 *   - clicking "Resend link" calls resendPxUploadLink, updates the row, and
 *     surfaces the success toast
 *   - an API error surfaces in the inline error toast and leaves the row
 *     unchanged
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Order } from '@/types';

// NOW from constants is '2026-05-11T08:00:00Z' — fixtures below anchor against
// that so ageDays is deterministic.
vi.mock('@/lib/api/mock', () => ({
  resendPxUploadLink: vi.fn(),
  // Task-183 — card now gates the manual reminder button on
  // can(CURRENT_USER, 'write', 'orders'), so the mock has to expose a user
  // with that permission (Owner) or the button never renders.
  CURRENT_USER: {
    id: 'U-OWNER',
    full_name: 'Owner Test',
    email: 'owner@example.com',
    roles: ['Owner'],
    active_clinic_id: 'feeltru',
    clinic_ids: ['feeltru'],
  },
}));

import { PxUploadPendingCard } from '../PxUploadPendingCard';
import { resendPxUploadLink } from '@/lib/api/mock';

const mockedResend = vi.mocked(resendPxUploadLink);

const ORIGINAL_FETCH = global.fetch;

function makeOrder(
  id: string,
  patient_id: string,
  link: NonNullable<Order['px_upload_link']> | null,
): Order {
  return {
    id,
    clinic_id: 'feeltru',
    patient_id,
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
    px_upload_link: link ?? undefined,
    expired_at: null,
    created_at: '2026-05-09T08:00:00Z',
    updated_at: '2026-05-09T08:00:00Z',
  };
}

function freshLink(): NonNullable<Order['px_upload_link']> {
  // sent today (NOW = 2026-05-11) → 0d, not expired, 1 send
  return {
    token: 'tok-fresh',
    expires_at: '2026-05-25T08:00:00Z',
    sent_at: '2026-05-11T08:00:00Z',
    first_sent_at: '2026-05-11T08:00:00Z',
    consumed_at: null,
    email_message_id: 'mid-fresh',
    to_email: 'fresh@example.com',
    reminder_sent_at: null,
    final_reminder_sent_at: null,
  };
}

function staleLink(): NonNullable<Order['px_upload_link']> {
  // first sent 2026-05-05 → 6d since first sent, not expired
  return {
    token: 'tok-stale',
    expires_at: '2026-05-20T08:00:00Z',
    sent_at: '2026-05-05T08:00:00Z',
    first_sent_at: '2026-05-05T08:00:00Z',
    consumed_at: null,
    email_message_id: 'mid-stale',
    to_email: 'stale@example.com',
    reminder_sent_at: null,
    final_reminder_sent_at: null,
  };
}

function expiredLink(): NonNullable<Order['px_upload_link']> {
  // expired before NOW
  return {
    token: 'tok-expired',
    expires_at: '2026-05-10T08:00:00Z',
    sent_at: '2026-05-04T08:00:00Z',
    first_sent_at: '2026-05-04T08:00:00Z',
    consumed_at: null,
    email_message_id: 'mid-expired',
    to_email: 'expired@example.com',
    reminder_sent_at: null,
    final_reminder_sent_at: null,
  };
}

function multiResendLink(): NonNullable<Order['px_upload_link']> {
  // initial + 2 resends → 3 sends
  return {
    token: 'tok-r3',
    expires_at: '2026-05-25T08:00:00Z',
    sent_at: '2026-05-10T08:00:00Z',
    first_sent_at: '2026-05-07T08:00:00Z', // 4d → warn tone
    consumed_at: null,
    email_message_id: 'mid-r3',
    to_email: 'resent@example.com',
    reminder_sent_at: null,
    final_reminder_sent_at: null,
    resends: [
      {
        sent_at: '2026-05-09T08:00:00Z',
        to_email: 'resent@example.com',
        expires_at: '2026-05-23T08:00:00Z',
        previous_expired: false,
        by_user_id: 'U-001',
      },
      {
        sent_at: '2026-05-10T08:00:00Z',
        to_email: 'resent@example.com',
        expires_at: '2026-05-25T08:00:00Z',
        previous_expired: false,
        by_user_id: 'U-001',
      },
    ],
  };
}

const PATIENT_MAP: Record<string, string> = {
  'PT-FRESH': 'Fresh Patient',
  'PT-STALE': 'Stale Patient',
  'PT-EXPIRED': 'Expired Patient',
  'PT-RESEND': 'Resend Patient',
};

describe('PxUploadPendingCard — Task-176 rendering', () => {
  afterEach(() => {
    cleanup();
    mockedResend.mockReset();
  });

  it('renders the row labels for fresh, stale, expired and multi-resend orders', () => {
    const orders = [
      makeOrder('ORD-FRESH', 'PT-FRESH', freshLink()),
      makeOrder('ORD-STALE', 'PT-STALE', staleLink()),
      makeOrder('ORD-EXPIRED', 'PT-EXPIRED', expiredLink()),
      makeOrder('ORD-RESEND', 'PT-RESEND', multiResendLink()),
    ];
    render(
      <PxUploadPendingCard clinicId="feeltru" orders={orders} patientMap={PATIENT_MAP} />,
    );

    // Header count
    expect(screen.getByText('4 ORDERS')).toBeInTheDocument();

    // Fresh row — sent today, 1 send, no expired pill.
    expect(screen.getByText('Fresh Patient')).toBeInTheDocument();
    expect(screen.getByText('Sent today')).toBeInTheDocument();

    // Stale row — 6 days since first sent.
    expect(screen.getByText('6d since first sent')).toBeInTheDocument();

    // Expired row — age label + "Link expired" pill.
    expect(screen.getByText('7d since first sent')).toBeInTheDocument();
    expect(screen.getByText(/Link expired/i)).toBeInTheDocument();

    // Multi-resend row — 1 initial + 2 resends = 3 sends.
    expect(screen.getByText('3 sends')).toBeInTheDocument();

    // Singular "1 send" appears on the fresh + stale + expired rows.
    expect(screen.getAllByText('1 send').length).toBeGreaterThanOrEqual(3);

    // One "Resend link" button per order.
    expect(screen.getAllByRole('button', { name: /resend link/i })).toHaveLength(4);

    // Task-183 — "Send reminder" appears on rows whose link is still active
    // and unconsumed and where the cron has something to send. The expired
    // row should NOT expose the reminder action.
    const reminderButtons = screen.getAllByRole('button', { name: /^Send reminder$/i });
    // fresh + stale + multi-resend = 3 eligible; expired excluded.
    expect(reminderButtons).toHaveLength(3);
  });

  it('renders the empty state when no orders are pending', () => {
    render(
      <PxUploadPendingCard clinicId="feeltru" orders={[]} patientMap={PATIENT_MAP} />,
    );
    expect(screen.getByText('0 ORDERS')).toBeInTheDocument();
    expect(
      screen.getByText('No orders waiting on a prescription upload'),
    ).toBeInTheDocument();
  });
});

describe('PxUploadPendingCard — Task-176 resend interaction', () => {
  afterEach(() => {
    cleanup();
    mockedResend.mockReset();
  });

  it('calls resendPxUploadLink, updates the row and surfaces a success toast', async () => {
    const order = makeOrder('ORD-FRESH', 'PT-FRESH', freshLink());
    const updated: Order = {
      ...order,
      px_upload_link: {
        ...freshLink(),
        token: 'tok-new',
        sent_at: '2026-05-11T08:00:00Z',
        to_email: 'fresh@example.com',
        resends: [
          {
            sent_at: '2026-05-11T08:00:00Z',
            to_email: 'fresh@example.com',
            expires_at: '2026-05-25T08:00:00Z',
            previous_expired: false,
            by_user_id: 'U-001',
          },
        ],
      },
    };
    mockedResend.mockResolvedValueOnce(updated);

    render(
      <PxUploadPendingCard clinicId="feeltru" orders={[order]} patientMap={PATIENT_MAP} />,
    );

    // Pre-condition — 1 send before clicking.
    expect(screen.getByText('1 send')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /resend link/i }));

    await waitFor(() => {
      expect(mockedResend).toHaveBeenCalledWith('feeltru', 'ORD-FRESH');
    });

    // Row updates: resends array now has 1 entry + initial = 2 sends.
    await waitFor(() => {
      expect(screen.getByText('2 sends')).toBeInTheDocument();
    });

    // Success toast surfaced with the recipient email.
    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent(/Upload link re-sent to fresh@example.com/);
    expect(toast).toHaveTextContent(/previous link is no longer valid/);
  });

  it('surfaces an API error in the toast and leaves the row unchanged', async () => {
    const order = makeOrder('ORD-STALE', 'PT-STALE', staleLink());
    mockedResend.mockRejectedValueOnce(new Error('Postmark down: try again'));

    render(
      <PxUploadPendingCard clinicId="feeltru" orders={[order]} patientMap={PATIENT_MAP} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /resend link/i }));

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Postmark down: try again');

    // Row unchanged: still 1 send, still 6d since first sent.
    expect(screen.getByText('1 send')).toBeInTheDocument();
    expect(screen.getByText('6d since first sent')).toBeInTheDocument();

    // Button is re-enabled (pendingId cleared in `finally`).
    const button = screen.getByRole('button', { name: /resend link/i });
    expect(button).not.toBeDisabled();
    // And the row's labels are intact (still showing Stale Patient).
    expect(within(button.closest('div.flex')!).queryByText(/Sending/)).toBeNull();
    expect(screen.getByText('Stale Patient')).toBeInTheDocument();
  });
});

// ── Task-263 — guard against double-clicking Resend ─────────────────────────
describe('PxUploadPendingCard — Task-263 resend double-click guard', () => {
  afterEach(() => {
    cleanup();
    mockedResend.mockReset();
  });

  it('only calls resendPxUploadLink once when the same row is clicked twice rapidly', async () => {
    const order = makeOrder('ORD-FRESH', 'PT-FRESH', freshLink());
    // Hold the first call in-flight so the second click happens before the
    // pending state clears.
    let resolveFirst: (value: Order) => void = () => {};
    const inFlight = new Promise<Order>((resolve) => {
      resolveFirst = resolve;
    });
    mockedResend.mockReturnValueOnce(inFlight);

    render(
      <PxUploadPendingCard clinicId="feeltru" orders={[order]} patientMap={PATIENT_MAP} />,
    );

    const button = screen.getByRole('button', { name: /resend link/i });
    fireEvent.click(button);
    // Rapid second click while the first request is still in flight.
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mockedResend).toHaveBeenCalledTimes(1);

    // Resolve the original call and ensure no additional invocations occur.
    resolveFirst({
      ...order,
      px_upload_link: {
        ...freshLink(),
        resends: [
          {
            sent_at: '2026-05-11T08:00:00Z',
            to_email: 'fresh@example.com',
            expires_at: '2026-05-25T08:00:00Z',
            previous_expired: false,
            by_user_id: 'U-001',
          },
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('2 sends')).toBeInTheDocument();
    });
    expect(mockedResend).toHaveBeenCalledTimes(1);
  });

  it('disables every row\'s Resend button while one resend is in flight', async () => {
    const orderA = makeOrder('ORD-A', 'PT-FRESH', freshLink());
    const orderB = makeOrder('ORD-B', 'PT-STALE', staleLink());

    let resolveFirst: (value: Order) => void = () => {};
    mockedResend.mockReturnValueOnce(
      new Promise<Order>((resolve) => {
        resolveFirst = resolve;
      }),
    );

    render(
      <PxUploadPendingCard
        clinicId="feeltru"
        orders={[orderA, orderB]}
        patientMap={PATIENT_MAP}
      />,
    );

    const buttons = screen.getAllByRole('button', { name: /resend link/i });
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[0]);

    // Both Resend buttons should be disabled while orderA's request is in flight.
    await waitFor(() => {
      expect(buttons[0]).toBeDisabled();
      expect(buttons[1]).toBeDisabled();
    });

    // Clicking the second row while disabled must not trigger another call.
    fireEvent.click(buttons[1]);
    expect(mockedResend).toHaveBeenCalledTimes(1);
    expect(mockedResend).toHaveBeenCalledWith('feeltru', 'ORD-A');

    resolveFirst({
      ...orderA,
      px_upload_link: {
        ...freshLink(),
        resends: [
          {
            sent_at: '2026-05-11T08:00:00Z',
            to_email: 'fresh@example.com',
            expires_at: '2026-05-25T08:00:00Z',
            previous_expired: false,
            by_user_id: 'U-001',
          },
        ],
      },
    });

    // Once the in-flight request resolves, both buttons are re-enabled.
    await waitFor(() => {
      const after = screen.getAllByRole('button', { name: /resend link/i });
      expect(after[0]).not.toBeDisabled();
      expect(after[1]).not.toBeDisabled();
    });
  });
});

// ── Task-183 — manual reminder action on queue rows ─────────────────────────
describe('PxUploadPendingCard — Task-183 manual reminder', () => {
  afterEach(() => {
    cleanup();
    mockedResend.mockReset();
    global.fetch = ORIGINAL_FETCH;
  });

  it('POSTs to the px-upload-reminder route and surfaces the kind in the toast', async () => {
    const order = makeOrder('ORD-FRESH', 'PT-FRESH', freshLink());
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        order_id: 'ORD-FRESH',
        kind: 'first',
        status: 'Delivered',
        message_id: 'mid-reminder-1',
        px_upload_link: {
          ...freshLink(),
          reminder_sent_at: '2026-05-11T08:05:00Z',
          to_email: 'fresh@example.com',
        },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <PxUploadPendingCard clinicId="feeltru" orders={[order]} patientMap={PATIENT_MAP} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Send reminder$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/orders/feeltru/ORD-FRESH/px-upload-reminder',
        { method: 'POST' },
      );
    });

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent(/Reminder sent to fresh@example.com/);

    // After the first reminder fires, only the "final" variant should remain.
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Send final reminder/i }),
      ).toBeInTheDocument();
    });
  });

  it('hides the reminder button once both reminders have already been sent', () => {
    const link: NonNullable<Order['px_upload_link']> = {
      ...freshLink(),
      reminder_sent_at: '2026-05-10T08:00:00Z',
      final_reminder_sent_at: '2026-05-11T07:00:00Z',
    };
    render(
      <PxUploadPendingCard
        clinicId="feeltru"
        orders={[makeOrder('ORD-DONE', 'PT-FRESH', link)]}
        patientMap={PATIENT_MAP}
      />,
    );
    expect(screen.queryByRole('button', { name: /Send( final)? reminder/i })).toBeNull();
    // Resend link stays available even when no more reminders are due.
    expect(screen.getByRole('button', { name: /resend link/i })).toBeInTheDocument();
  });

  it('surfaces an API error from the reminder route in the toast', async () => {
    const order = makeOrder('ORD-FRESH', 'PT-FRESH', freshLink());
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: 'Both reminders have already been sent for this link.' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <PxUploadPendingCard clinicId="feeltru" orders={[order]} patientMap={PATIENT_MAP} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Send reminder$/i }));

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Both reminders have already been sent for this link.');
  });
});
