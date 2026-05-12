/**
 * aggregateTimeline — BLD-4.3, BLD-4.6 (Wave 3).
 *
 * Combines ClinicalNotes, CoachingLogs (FeelTru only), Orders, and
 * GPLetters into a single descending-chronological TimelineEntry[].
 *
 * Role-based visibility:
 *   Coach → coaching_log + order_event only (DEC-05)
 *   All other roles → all entry types
 *
 * Filtering via TimelineFilter is applied AFTER role filtering.
 */

import type { ClinicId, ClinicalNote, CoachingLog, Order, GPLetter, User } from '@/lib/api/types';
import { adaptClinicalNote } from './adapters/clinicalNote';
import { adaptCoachingLog }  from './adapters/coachingLog';
import { adaptOrderEvent }   from './adapters/orderEvent';
import { adaptGpLetter }     from './adapters/gpLetter';
import type { TimelineEntry, TimelineFilter } from './types';

type TimelineInput = {
  clinicalNotes: ClinicalNote[];
  coachingLogs:  CoachingLog[];
  orders:        Order[];
  gpLetters:     GPLetter[];
  clinicId:      ClinicId;
  actor:         User;
  /** Optional display-name maps for author labels */
  userNames?:    Record<string, string>;
};

export function aggregateTimeline(
  input: TimelineInput,
  filter?: TimelineFilter,
): TimelineEntry[] {
  const { clinicalNotes, coachingLogs, orders, gpLetters, clinicId, actor, userNames = {} } = input;

  const isCoach = actor.roles.includes('Coach') && !actor.roles.some((r) => r === 'Prescriber' || r === 'Admin' || r === 'Owner');

  const entries: TimelineEntry[] = [];

  // ── Clinical notes (hidden from Coach) ────────────────────────────────────
  if (!isCoach) {
    for (const n of clinicalNotes) {
      entries.push(adaptClinicalNote(n, clinicId, userNames[n.author_user_id]));
    }
  }

  // ── Coaching logs ─────────────────────────────────────────────────────────
  for (const l of coachingLogs) {
    entries.push(adaptCoachingLog(l, clinicId, userNames[l.coach_id]));
  }

  // ── Order events ──────────────────────────────────────────────────────────
  for (const o of orders) {
    const prescriberName = o.clinical_decision
      ? userNames[o.clinical_decision.prescriber_user_id]
      : undefined;
    entries.push(...adaptOrderEvent(o, clinicId, prescriberName));
  }

  // ── GP Letters (hidden from Coach) ────────────────────────────────────────
  if (!isCoach) {
    for (const l of gpLetters) {
      entries.push(adaptGpLetter(l, clinicId, userNames[l.created_by_user_id]));
    }
  }

  // ── Apply filter ───────────────────────────────────────────────────────────
  let result = entries;

  if (filter?.type && filter.type.length > 0) {
    result = result.filter((e) => filter.type!.includes(e.type));
  }
  if (filter?.author_user_id) {
    // Match on author_label prefix (author_user_id is embedded in label)
    result = result.filter((e) => e.author_label.startsWith(filter.author_user_id!));
  }
  if (filter?.from_date) {
    const from = new Date(filter.from_date).getTime();
    result = result.filter((e) => new Date(e.occurred_at).getTime() >= from);
  }
  if (filter?.to_date) {
    const to = new Date(filter.to_date).getTime();
    result = result.filter((e) => new Date(e.occurred_at).getTime() <= to);
  }

  // Sort descending by occurred_at
  return result.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}
