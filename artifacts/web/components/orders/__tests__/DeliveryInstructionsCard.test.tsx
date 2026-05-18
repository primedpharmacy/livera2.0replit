/**
 * DeliveryInstructionsCard — Task-318 component test.
 *
 * Pins the UI contract:
 *   1. Card is omitted entirely when `order.delivery_instructions` is null.
 *   2. Quoted patient text and status pill render in the unreviewed state.
 *   3. Approve / Edit / Reject buttons are hidden for users without
 *      `write:orders`.
 *   4. Reject requires a reason before the action is submitted.
 *   5. Approve triggers the wrapped server action with the right args.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Order } from '@/types';

const canMock = vi.fn().mockReturnValue(true);
vi.mock('@/lib/permissions', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

vi.mock('@/lib/context', () => ({
  useCurrentUser: () => ({ id: 'user_qadir', full_name: 'Dr Qadir', role: 'Prescriber' }),
}));

vi.mock('@/lib/api/mock', () => ({
  USERS_REGISTRY: { user_qadir: { id: 'user_qadir', full_name: 'Dr Qadir' } },
}));

const approveMock = vi.fn().mockResolvedValue({});
const rejectMock = vi.fn().mockResolvedValue({});
const updateMock = vi.fn().mockResolvedValue({});
vi.mock('@/lib/actions/deliveryInstructionsActions', () => ({
  approveDeliveryInstructionsAction: (...args: unknown[]) => approveMock(...args),
  rejectDeliveryInstructionsAction: (...args: unknown[]) => rejectMock(...args),
  updateDeliveryInstructionsAction: (...args: unknown[]) => updateMock(...args),
}));

import { DeliveryInstructionsCard } from '../DeliveryInstructionsCard';

function makeOrder(overrides: Partial<Order['delivery_instructions']> | null = {}): Order {
  return {
    id: 'ORD-DI-1',
    clinic_id: 'vsc',
    patient_id: 'PT-00234',
    type: 'new',
    status: 'clinical_check',
    product: { medication: 'Mounjaro', dose: '7.5mg', strength: 'pre-filled pen', plan: '4 weeks' },
    g6_flags: [],
    contextual_flags: [],
    intervention_raised_at: null,
    px_upload: null,
    px_upload_link: null,
    expired_at: null,
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    delivery_instructions: overrides === null ? null : {
      patient_submitted: 'Leave with concierge',
      staff_value: 'Leave with concierge',
      review_status: 'unreviewed',
      reviewed_by_user_id: null,
      reviewed_at: null,
      edits: [],
      ...overrides,
    },
  } as unknown as Order;
}

afterEach(() => {
  cleanup();
  canMock.mockReturnValue(true);
  approveMock.mockClear();
  rejectMock.mockClear();
  updateMock.mockClear();
});

describe('DeliveryInstructionsCard', () => {
  it('renders nothing when delivery_instructions is null', () => {
    const { container } = render(
      <DeliveryInstructionsCard order={makeOrder(null)} clinicId="vsc" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the quoted patient text and the Unreviewed pill', () => {
    render(<DeliveryInstructionsCard order={makeOrder()} clinicId="vsc" />);
    expect(screen.getAllByText(/Leave with concierge/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('delivery-instructions-status-pill'))
      .toHaveTextContent(/Unreviewed/i);
  });

  it('hides Approve/Edit/Reject for users without write:orders', () => {
    canMock.mockReturnValue(false);
    render(<DeliveryInstructionsCard order={makeOrder()} clinicId="vsc" />);
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reject/i })).toBeNull();
  });

  it('Reject button blocks submission until a reason is typed', async () => {
    render(<DeliveryInstructionsCard order={makeOrder()} clinicId="vsc" />);
    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    const confirm = screen.getByRole('button', { name: /confirm rejection/i });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Asked courier/i), {
      target: { value: 'Unsafe drop' },
    });
    expect(confirm).not.toBeDisabled();
    await act(async () => { fireEvent.click(confirm); });
    await waitFor(() => {
      expect(rejectMock).toHaveBeenCalledWith('vsc', 'ORD-DI-1', { reason: 'Unsafe drop' });
    });
  });

  it('Approve invokes the server action with no edit payload', async () => {
    render(<DeliveryInstructionsCard order={makeOrder()} clinicId="vsc" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    });
    await waitFor(() => {
      expect(approveMock).toHaveBeenCalledWith('vsc', 'ORD-DI-1', undefined);
    });
  });
});
