/**
 * NotificationRow — Task-199.
 *
 * Pins the contract that Bounced/Failed SMS rows surface the Twilio carrier
 * reason BOTH inline AND as a tooltip on the status chip — the behaviour
 * originally added in Task-137 and now reused on any consumer of the shared
 * renderer (per-patient log + order-level panel). A future refactor must
 * not silently drop either surface.
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NotificationRow } from '../NotificationRow';
import {
  DEFAULT_MAX_ATTEMPTS,
  type PatientNotification,
} from '@/lib/api/mock';

function makeRow(overrides: Partial<PatientNotification>): PatientNotification {
  return {
    id: 'NOTIF-TEST',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    order_id: 'ORD-00453',
    type: 'order_approved',
    channel: 'SMS',
    template: 'order_approved',
    status: 'Bounced',
    sent_at: '2026-05-18T08:01:00Z',
    payload: {
      sms_to_phone: '+447700900123',
      sms_error_message: 'Unreachable destination handset (Twilio 30003)',
    },
    attempt_count: 1,
    max_attempts: DEFAULT_MAX_ATTEMPTS,
    last_error: 'Unreachable destination handset (Twilio 30003)',
    last_attempt_at: '2026-05-18T08:01:00Z',
    next_retry_at: null,
    email_envelope: null,
    email_envelope_unavailable_reason: null,
    ...overrides,
  };
}

const noopResend = async () => ({ ok: false as const, reason: 'forbidden' });

describe('NotificationRow — carrier reason surfacing', () => {
  afterEach(() => cleanup());

  it('renders the carrier reason inline AND as a tooltip on the status chip for a Bounced SMS', () => {
    const row = makeRow({ status: 'Bounced' });
    render(
      <NotificationRow
        notification={row}
        clinicId="feeltru"
        canResend={false}
        onResend={noopResend}
      />,
    );

    // Status chip tooltip (title attribute) carries the carrier reason.
    const chip = screen.getByText('Bounced').closest('span');
    expect(chip).toHaveAttribute(
      'title',
      'Unreachable destination handset (Twilio 30003)',
    );

    // Inline "Error: …" block surfaces the same reason as readable text,
    // with the full error preserved in a title attribute on the wrapping span
    // (so the reason is recoverable even when truncated).
    const errorLabel = screen.getByText(/Error:/);
    expect(errorLabel).toBeInTheDocument();
    const inlineSpan = errorLabel.parentElement as HTMLElement | null;
    expect(inlineSpan).not.toBeNull();
    expect(inlineSpan).toHaveAttribute(
      'title',
      'Unreachable destination handset (Twilio 30003)',
    );
    expect(inlineSpan).toHaveTextContent(
      /Unreachable destination handset \(Twilio 30003\)/,
    );
  });

  it('also surfaces the carrier reason for a Failed SMS', () => {
    const row = makeRow({
      status: 'Failed',
      last_error: 'Landline or unreachable carrier (Twilio 30006)',
    });
    render(
      <NotificationRow
        notification={row}
        clinicId="feeltru"
        canResend={false}
        onResend={noopResend}
      />,
    );

    const chip = screen.getByText('Failed').closest('span');
    expect(chip).toHaveAttribute(
      'title',
      'Landline or unreachable carrier (Twilio 30006)',
    );
    expect(
      screen.getByText(/Landline or unreachable carrier \(Twilio 30006\)/),
    ).toBeInTheDocument();
  });

  it('does not render the inline error block for a Delivered row', () => {
    const row = makeRow({
      status: 'Delivered',
      last_error: null,
    });
    const { container } = render(
      <NotificationRow
        notification={row}
        clinicId="feeltru"
        canResend={false}
        onResend={noopResend}
      />,
    );

    expect(within(container).queryByText(/Error:/)).not.toBeInTheDocument();
    const chip = screen.getByText('Delivered').closest('span');
    expect(chip).not.toHaveAttribute('title');
  });
});
