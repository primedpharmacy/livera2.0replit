/**
 * OrdersView — Task-228: keyboard shortcut regression guard.
 *
 * Locks down the j/k/↑/↓ navigation contract plus the A/D inline approve /
 * decline shortcuts so a future refactor of the keydown handler in
 * OrdersView.tsx can't silently break power-user flows:
 *
 *   - ↑/↓ moves the focused row, Enter routes to the order detail page.
 *   - A on a focused `clinical_check` row opens ApproveConfirmModal; D opens
 *     DeclineConfirmModal — but only when the current user has
 *     `decide` permission on `orders`.
 *   - A/D are no-ops on rows whose status is not `clinical_check` (e.g.
 *     `dispatched`, `expired`) — they neither preventDefault nor open a
 *     modal.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Order, Clinic } from '@/types';

// ── Mocks ────────────────────────────────────────────────────────────────────
// Capture router.push so we can assert Enter navigates to the right detail page.
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
}));

// `can()` is consulted once per render via `canDecideOrders`. Tests flip this
// to false to verify A/D become no-ops without permission.
const canMock = vi.fn().mockReturnValue(true);
vi.mock('@/lib/permissions', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

// We never need the real action / API chain in these tests — A/D just opens a
// modal, the modal owns the confirm path.
vi.mock('@/lib/actions/clinicalNoteActions', () => ({
  createClinicalNoteAction: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/lib/api/mock', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/api/mock');
  return {
    ...actual,
    decideOrder: vi.fn().mockResolvedValue({}),
  };
});

// Stub the two confirm modals with trivial markers so we can assert which (if
// any) is mounted, without dragging in the real dialog / textarea tree.
vi.mock('../ApproveConfirmModal', () => ({
  ApproveConfirmModal: ({ orderId }: { orderId: string }) => (
    <div data-testid="approve-modal">Approve {orderId}</div>
  ),
}));
vi.mock('../DeclineConfirmModal', () => ({
  DeclineConfirmModal: ({ orderId }: { orderId: string }) => (
    <div data-testid="decline-modal">Decline {orderId}</div>
  ),
}));

// Filters / Table render the visible list. We bypass them so the test focuses
// on the keyboard handler in OrdersView — `filtered` is seeded from
// `initialOrders` minus expired, which is all this handler reads.
vi.mock('../OrderListFilters', () => ({
  OrderListFilters: () => null,
}));
vi.mock('../OrderListTable', () => ({
  OrderListTable: ({ orders, selectedOrderId }: { orders: Order[]; selectedOrderId?: string }) => (
    <ul data-testid="order-list">
      {orders.map((o) => (
        <li
          key={o.id}
          data-testid={`row-${o.id}`}
          data-selected={o.id === selectedOrderId ? 'true' : 'false'}
        >
          {o.id} — {o.status}
        </li>
      ))}
    </ul>
  ),
}));

// queueNavigation persists to localStorage — harmless in jsdom but stub it out
// to avoid leaking state between tests.
vi.mock('@/lib/queueNavigation', () => ({ saveQueue: vi.fn() }));

// Import _after_ the mocks above are registered.
import { OrdersView } from '../OrdersView';

// ── Fixtures ─────────────────────────────────────────────────────────────────
function makeOrder(id: string, status: Order['status'], createdAt = '2026-05-10T08:00:00Z'): Order {
  return {
    id,
    clinic_id: 'feeltru',
    patient_id: `PT-${id}`,
    type: 'new',
    status,
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
    expired_at: status === 'expired' ? createdAt : null,
    created_at: createdAt,
    updated_at: createdAt,
  } as Order;
}

const clinic = {
  id: 'feeltru',
  config: {
    default_slas: { approval_warn_hours: 6, approval_breach_hours: 12 },
  },
} as unknown as Clinic;

const ORDERS: Order[] = [
  makeOrder('ORD-A', 'clinical_check'),
  makeOrder('ORD-B', 'dispatched'),
  makeOrder('ORD-C', 'clinical_check'),
  makeOrder('ORD-D', 'expired'),
];

function renderView() {
  return render(<OrdersView initialOrders={ORDERS} clinicId="feeltru" clinic={clinic} />);
}

function pressKey(key: string) {
  act(() => {
    fireEvent.keyDown(window, { key });
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('OrdersView — Task-228 keyboard shortcuts', () => {
  beforeEach(() => {
    pushMock.mockReset();
    canMock.mockReset().mockReturnValue(true);
  });
  afterEach(() => cleanup());

  it('↓/↑ navigate the focused row through the (active) visible list', () => {
    renderView();
    // Active tab hides expired orders → visible = [A, B, C].
    const expectSelected = (id: string | null) => {
      for (const o of ['ORD-A', 'ORD-B', 'ORD-C']) {
        expect(screen.getByTestId(`row-${o}`)).toHaveAttribute(
          'data-selected',
          o === id ? 'true' : 'false',
        );
      }
    };

    expectSelected(null);
    pressKey('ArrowDown'); expectSelected('ORD-A');
    pressKey('ArrowDown'); expectSelected('ORD-B');
    pressKey('j');         expectSelected('ORD-C');
    pressKey('ArrowDown'); expectSelected('ORD-C'); // clamps at last
    pressKey('ArrowUp');   expectSelected('ORD-B');
    pressKey('k');         expectSelected('ORD-A');
    pressKey('ArrowUp');   expectSelected('ORD-A'); // clamps at first
  });

  it('Enter routes to the focused order detail', () => {
    renderView();
    pressKey('ArrowDown'); // focus ORD-A
    pressKey('ArrowDown'); // focus ORD-B
    pressKey('Enter');
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/feeltru/orders/ORD-B');
  });

  it('A opens ApproveConfirmModal and D opens DeclineConfirmModal on a clinical_check row', () => {
    const { unmount } = renderView();
    pressKey('ArrowDown'); // ORD-A (clinical_check)
    pressKey('A');
    expect(screen.getByTestId('approve-modal')).toHaveTextContent('Approve ORD-A');
    expect(screen.queryByTestId('decline-modal')).not.toBeInTheDocument();
    unmount();

    renderView();
    pressKey('ArrowDown'); // ORD-A
    pressKey('ArrowDown'); // ORD-B (dispatched — no-op territory)
    pressKey('ArrowDown'); // ORD-C (clinical_check)
    pressKey('D');
    expect(screen.getByTestId('decline-modal')).toHaveTextContent('Decline ORD-C');
    expect(screen.queryByTestId('approve-modal')).not.toBeInTheDocument();
  });

  it('A / D are no-ops on non-clinical_check rows (dispatched / expired)', () => {
    renderView();
    pressKey('ArrowDown'); // ORD-A
    pressKey('ArrowDown'); // ORD-B (dispatched)
    pressKey('A');
    pressKey('D');
    expect(screen.queryByTestId('approve-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('decline-modal')).not.toBeInTheDocument();
    // The handler should also not navigate.
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('A / D are no-ops when the user lacks decide permission, even on a clinical_check row', () => {
    canMock.mockReturnValue(false);
    renderView();
    pressKey('ArrowDown'); // ORD-A (clinical_check)
    pressKey('A');
    pressKey('D');
    expect(screen.queryByTestId('approve-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('decline-modal')).not.toBeInTheDocument();
    expect(canMock).toHaveBeenCalledWith(expect.anything(), 'decide', 'orders');
  });

  it('A / D are no-ops on the expired tab, even when the focused row is selected', () => {
    renderView();
    // Switch to the expired tab — its visible list is [ORD-D].
    fireEvent.click(screen.getByRole('button', { name: /expired/i }));
    pressKey('ArrowDown'); // focus ORD-D (expired)
    expect(screen.getByTestId('row-ORD-D')).toHaveAttribute('data-selected', 'true');
    pressKey('A');
    pressKey('D');
    expect(screen.queryByTestId('approve-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('decline-modal')).not.toBeInTheDocument();
  });

  it('ignores shortcut keys while focus is in an input/textarea or modifier keys are held', () => {
    renderView();
    pressKey('ArrowDown'); // ORD-A

    // Modifier-key combinations are reserved for the browser / OS.
    act(() => { fireEvent.keyDown(window, { key: 'A', metaKey: true }); });
    act(() => { fireEvent.keyDown(window, { key: 'ArrowDown', ctrlKey: true }); });
    expect(screen.queryByTestId('approve-modal')).not.toBeInTheDocument();
    // Focus should not have advanced past ORD-A.
    expect(screen.getByTestId('row-ORD-A')).toHaveAttribute('data-selected', 'true');

    // Keystrokes that originate inside an input must pass through untouched.
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => { fireEvent.keyDown(input, { key: 'A', bubbles: true }); });
    expect(screen.queryByTestId('approve-modal')).not.toBeInTheDocument();
    document.body.removeChild(input);
  });
});
