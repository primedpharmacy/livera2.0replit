/**
 * Task-180 — Reminder delivery health for Px-upload links.
 *
 * The Px-upload reminder job (Task-92) records two kinds of nudge:
 *   • first  — 48h after the initial email
 *   • final  — within 24h of link expiry
 * and the failure trail (Task-129) on px_upload_link.reminder_failures.
 *
 * This helper distils all of that into a single state that the prescriber
 * queue can show as a compact pill so clinicians can spot orders that were
 * nudged but the nudge bounced (i.e. the patient was almost certainly not
 * told and a human needs to step in).
 *
 * Priority — highest concern first:
 *   1. "bounced"  — there is a failed attempt for a kind that has never
 *                   successfully sent. The patient hasn't been reached.
 *   2. "final"    — the last-chance reminder landed.
 *   3. "first"    — only the 48h nudge landed.
 *   4. null       — nothing to show (no reminder activity yet).
 */

import type { Order } from '../api/types';

export type PxUploadReminderStatus = {
  state: 'bounced' | 'final' | 'first';
  /** Total failed attempts across both kinds — for the hover tooltip. */
  failureCount: number;
  /** Most recent failure (used for "latest error message" in the hover). */
  latestFailure: NonNullable<NonNullable<Order['px_upload_link']>['reminder_failures']>[number] | null;
  /** Total reminders that successfully landed (0..2). */
  sentCount: number;
};

export function computeReminderStatus(order: Order): PxUploadReminderStatus | null {
  const link = order.px_upload_link;
  if (!link) return null;

  const failures = link.reminder_failures ?? [];
  const firstSent = Boolean(link.reminder_sent_at);
  const finalSent = Boolean(link.final_reminder_sent_at);
  const sentCount = (firstSent ? 1 : 0) + (finalSent ? 1 : 0);

  // Sort failures newest-first for the hover summary.
  const sortedFailures = [...failures].sort(
    (a, b) => new Date(b.attempted_at).getTime() - new Date(a.attempted_at).getTime(),
  );
  const latestFailure = sortedFailures[0] ?? null;

  // A failure is "unresolved" if no successful send of that kind followed.
  const hasUnresolvedFailure = failures.some((f) => {
    if (f.kind === 'first') return !firstSent;
    return !finalSent;
  });

  if (hasUnresolvedFailure) {
    return { state: 'bounced', failureCount: failures.length, latestFailure, sentCount };
  }
  if (finalSent) {
    return { state: 'final', failureCount: failures.length, latestFailure, sentCount };
  }
  if (firstSent) {
    return { state: 'first', failureCount: failures.length, latestFailure, sentCount };
  }
  return null;
}

export const REMINDER_PILL_LABEL: Record<PxUploadReminderStatus['state'], string> = {
  bounced: 'Reminder bounced',
  final:   'Final reminder sent',
  first:   'Reminded',
};
