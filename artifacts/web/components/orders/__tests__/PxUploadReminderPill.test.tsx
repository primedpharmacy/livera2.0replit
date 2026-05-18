/**
 * PxUploadReminderPill — Task-180 / Task-272.
 *
 * The Clinical Check queue surfaces a compact "Reminded" / "Final reminder
 * sent" / "Reminder bounced" pill on the Patient cell for orders whose
 * px_upload_link has reminder activity. Hovering (or focusing) the pill opens
 * a tooltip with the success/failure counts and the latest Postmark error, and
 * Escape dismisses it. These tests pin that contract so a future refactor of
 * OrderListTable can't silently break the popover.
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { PxUploadReminderPill } from '../OrderListTable';
import type { PxUploadReminderStatus } from '@/lib/clinical/pxUploadReminderStatus';

const bounced: PxUploadReminderStatus = {
  state: 'bounced',
  failureCount: 2,
  sentCount: 0,
  latestFailure: {
    kind: 'first',
    attempted_at: '2026-05-17T09:00:00.000Z',
    status: 'HardBounce',
    error_message: 'The server was unable to deliver your message',
  },
};

const finalSent: PxUploadReminderStatus = {
  state: 'final',
  failureCount: 0,
  sentCount: 2,
  latestFailure: null,
};

const firstOnly: PxUploadReminderStatus = {
  state: 'first',
  failureCount: 0,
  sentCount: 1,
  latestFailure: null,
};

describe('PxUploadReminderPill — Task-180', () => {
  afterEach(() => cleanup());

  it('renders the bounced label with the error palette', () => {
    render(<PxUploadReminderPill status={bounced} />);
    const trigger = screen.getByRole('button', { name: /reminder bounced/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.className).toMatch(/text-err/);
    expect(trigger.className).toMatch(/bg-err-bg/);
  });

  it('renders the final-reminder label with the warn palette and a ·Nx counter', () => {
    render(<PxUploadReminderPill status={finalSent} />);
    const trigger = screen.getByRole('button', { name: /final reminder sent/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.className).toMatch(/text-warn/);
    expect(trigger).toHaveTextContent(/·2x/);
  });

  it('renders the first-reminder label with the neutral palette as a non-interactive pill', () => {
    render(<PxUploadReminderPill status={firstOnly} />);
    // No hover behaviour for a clean single-first reminder — there's nothing
    // to triage, so the pill is rendered without a button role.
    expect(screen.queryByRole('button', { name: /reminded/i })).not.toBeInTheDocument();
    const pill = screen.getByLabelText(/reminded/i);
    expect(pill).toBeInTheDocument();
    expect(pill.className).toMatch(/text-t2/);
    expect(pill.className).toMatch(/bg-page-bg/);
    // Hovering should not open the tooltip.
    fireEvent.mouseEnter(pill.parentElement!);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('opens the tooltip on hover with success/failure counts and the latest error', () => {
    render(<PxUploadReminderPill status={bounced} />);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /reminder bounced/i });
    fireEvent.mouseEnter(trigger.parentElement!);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(/Reminder delivery/i);
    expect(tooltip).toHaveTextContent(/0/);
    expect(tooltip).toHaveTextContent(/successful/);
    expect(tooltip).toHaveTextContent(/2/);
    expect(tooltip).toHaveTextContent(/failed/);
    expect(tooltip).toHaveTextContent(/Latest error \(first\)/i);
    expect(tooltip).toHaveTextContent(/HardBounce/);
    expect(tooltip).toHaveTextContent(/unable to deliver/i);
  });

  it('opens the tooltip on keyboard focus and reflects aria-expanded', async () => {
    const user = userEvent.setup();
    render(<PxUploadReminderPill status={bounced} />);

    const trigger = screen.getByRole('button', { name: /reminder bounced/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.tab();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('Escape dismisses the tooltip and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<PxUploadReminderPill status={bounced} />);

    await user.tab();
    const trigger = screen.getByRole('button', { name: /reminder bounced/i });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await act(async () => {
      await user.keyboard('{Escape}');
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
