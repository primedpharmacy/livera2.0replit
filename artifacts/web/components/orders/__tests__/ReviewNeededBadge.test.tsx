/**
 * ReviewNeededBadge — Task-169.
 *
 * The "N review needed" badge on the Clinical Check queue row combines
 * hover, focus, Escape-to-dismiss, and click-to-jump behaviours. These tests
 * pin the user-visible contract so a future refactor of OrderListTable
 * can't silently break the popover.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { ReviewNeededBadge } from '../OrderListTable';
import type { FlaggedAnswer } from '@/lib/questionnaire';

const flagged: FlaggedAnswer[] = [
  { id: 'q_pregnant',        label: 'Are you pregnant?',           answer: 'yes' },
  { id: 'q_eating_disorder', label: 'History of eating disorder?', answer: 'yes' },
];

describe('ReviewNeededBadge — Task-169', () => {
  afterEach(() => cleanup());

  it('opens the popover on hover and lists each flagged question + answer', () => {
    render(<ReviewNeededBadge count={2} flaggedAnswers={flagged} onJump={() => {}} />);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // The hover handler lives on the wrapping <span>, which is the badge's
    // parent. Trigger mouseEnter on it directly.
    const trigger = screen.getByRole('button', { name: /safety-flagged/i });
    fireEvent.mouseEnter(trigger.parentElement!);

    const popover = screen.getByRole('tooltip');
    expect(popover).toBeInTheDocument();
    expect(popover).toHaveTextContent('Flagged answers (2)');
    expect(popover).toHaveTextContent('Are you pregnant?');
    expect(popover).toHaveTextContent('History of eating disorder?');
    // Each row surfaces the patient's literal answer.
    expect(popover.querySelectorAll('li')).toHaveLength(2);
    expect(popover).toHaveTextContent(/Answered:\s*yes/);
  });

  it('opens the popover on keyboard focus and reflects aria-expanded', async () => {
    const user = userEvent.setup();
    render(<ReviewNeededBadge count={2} flaggedAnswers={flagged} onJump={() => {}} />);

    const trigger = screen.getByRole('button', { name: /safety-flagged/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.tab();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('Esc dismisses the popover and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<ReviewNeededBadge count={2} flaggedAnswers={flagged} onJump={() => {}} />);

    await user.tab();
    const trigger = screen.getByRole('button', { name: /safety-flagged/i });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await act(async () => {
      await user.keyboard('{Escape}');
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('clicking the badge invokes onJumpToFlagged', async () => {
    const onJump = vi.fn();
    const user = userEvent.setup();
    render(<ReviewNeededBadge count={2} flaggedAnswers={flagged} onJump={onJump} />);

    await user.click(screen.getByRole('button', { name: /safety-flagged/i }));
    expect(onJump).toHaveBeenCalledTimes(1);
  });

  it('renders a non-interactive span (no popover) when there are no flagged answers', () => {
    render(<ReviewNeededBadge count={0} flaggedAnswers={[]} onJump={() => {}} />);
    const trigger = screen.getByRole('button', { name: /safety-flagged/i });
    fireEvent.mouseEnter(trigger.parentElement!);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
