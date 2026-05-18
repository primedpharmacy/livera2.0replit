/**
 * Task-190 — Component test for WeightWarningChips (Task-99 / Task-135).
 *
 * Pins:
 *   - Edit / Undo controls render only when canAcknowledge is true.
 *   - The unreviewed chip exposes "Acknowledge" only for users with permission.
 *   - Completing the Undo flow clears the acknowledged state — once the
 *     parent feeds the reversed order back in, the chip flips back to its
 *     unreviewed "Acknowledge" form.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WeightWarningChips } from '../WeightWarningChips';
import { MOCK_ORDERS, acknowledgeWeightWarning } from '@/lib/api/fixtures/orders';
import type { Order } from '@/types';
import type { WeightWarning } from '@/lib/clinical/weightWarnings';

const WARNING: WeightWarning = {
  kind: 'plateau',
  severity: 'warn',
  label: 'Plateau (≤0.3 kg over 3 readings)',
};

function resetOrder(id: string): Order {
  // The fixture functions mutate MOCK_ORDERS in place, so reset the target
  // row before each render to keep tests deterministic.
  const base = MOCK_ORDERS.find((o) => o.id === id)!;
  base.weight_warning_acknowledgements = [];
  return structuredClone(base);
}

async function seedAckedOrder(): Promise<Order> {
  resetOrder('ORD-00438');
  return acknowledgeWeightWarning(
    'vsc',
    'ORD-00438',
    'plateau',
    'Patient stable on review.',
  );
}

describe('WeightWarningChips — Task-190', () => {
  afterEach(() => cleanup());

  it('hides the Acknowledge action when canAcknowledge is false', () => {
    render(
      <WeightWarningChips
        order={resetOrder('ORD-00438')}
        clinicId="vsc"
        warnings={[WARNING]}
        canAcknowledge={false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
  });

  it('shows the Acknowledge action when canAcknowledge is true', () => {
    render(
      <WeightWarningChips
        order={resetOrder('ORD-00438')}
        clinicId="vsc"
        warnings={[WARNING]}
        canAcknowledge
      />,
    );
    expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeInTheDocument();
  });

  it('hides Edit/Undo on an acknowledged chip when canAcknowledge is false', async () => {
    const acked = await seedAckedOrder();
    render(
      <WeightWarningChips
        order={acked}
        clinicId="vsc"
        warnings={[WARNING]}
        canAcknowledge={false}
      />,
    );
    expect(screen.queryByRole('button', { name: /edit rationale/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^undo$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/· acknowledged/i)).toBeInTheDocument();
  });

  it('shows Edit/Undo on an acknowledged chip when canAcknowledge is true', async () => {
    const acked = await seedAckedOrder();
    render(
      <WeightWarningChips
        order={acked}
        clinicId="vsc"
        warnings={[WARNING]}
        canAcknowledge
      />,
    );
    expect(screen.getByRole('button', { name: /edit rationale/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^undo$/i })).toBeInTheDocument();
  });

  // Task-211 — when the clinic retunes the warning thresholds after a chip
  // has been acknowledged, the chip surfaces a "Thresholds changed since this
  // warning" badge so reviewers know the *current* numbers no longer match
  // what the warning fired under.
  it('shows the "thresholds changed" badge only when the snapshot diverges from current', async () => {
    const historical = {
      bmi_continuation_floor: 27.5,
      rapid_loss_kg_per_week: 2,
      plateau_tolerance_kg: 0.3,
      plateau_min_readings: 3,
    };
    // Acknowledge under the historical numbers — the snapshot is persisted
    // on the entry by acknowledgeWeightWarning (Task-211).
    resetOrder('ORD-00438');
    const acked = await acknowledgeWeightWarning(
      'vsc',
      'ORD-00438',
      'plateau',
      'Patient stable on review.',
      historical,
    );

    // 1) Same thresholds → no badge.
    const { unmount } = render(
      <WeightWarningChips
        order={acked}
        clinicId="vsc"
        warnings={[WARNING]}
        canAcknowledge
        thresholds={historical}
      />,
    );
    expect(
      screen.queryByText(/thresholds changed since this warning/i),
    ).not.toBeInTheDocument();
    unmount();

    // 2) Retune the plateau thresholds → badge appears.
    render(
      <WeightWarningChips
        order={acked}
        clinicId="vsc"
        warnings={[WARNING]}
        canAcknowledge
        thresholds={{ ...historical, plateau_min_readings: 4, plateau_tolerance_kg: 0.5 }}
      />,
    );
    expect(
      screen.getByText(/thresholds changed since this warning/i),
    ).toBeInTheDocument();

    // Task-211 — the acknowledged chip's tooltip should spell out the
    // "Fired under: X — now Y" contrast so a clinician hovering it can
    // see exactly which numbers the warning originally triggered against.
    const ackChip = screen
      .getByText(WARNING.label)
      .closest('span[title]');
    expect(ackChip).toHaveAttribute(
      'title',
      'Fired under: plateau 3 within 0.3kg — now plateau 4 within 0.5kg',
    );
  });

  it('flips back to the unreviewed state after the undo flow completes', async () => {
    const acked = await seedAckedOrder();

    // Tiny parent wrapper so the chip can re-render with the reversed order
    // exactly as OrderDetailClient / ClinicalCheckSlideOver would do in app.
    function Harness() {
      const [order, setOrder] = useState<Order>(acked);
      return (
        <WeightWarningChips
          order={order}
          clinicId="vsc"
          warnings={[WARNING]}
          canAcknowledge
          onAcknowledged={setOrder}
        />
      );
    }

    render(<Harness />);

    expect(screen.getByText(/· acknowledged/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^undo$/i }));
    const textarea = await screen.findByPlaceholderText(/acknowledged the wrong chip/i);
    fireEvent.change(textarea, {
      target: { value: 'Acknowledged the wrong chip by mistake.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /undo acknowledgement/i }));

    // After the fixture call resolves and the parent re-renders with the
    // reversed entry, the chip should be back to its unreviewed state.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeInTheDocument();
    });
    expect(screen.queryByText(/· acknowledged/i)).not.toBeInTheDocument();
  });
});
