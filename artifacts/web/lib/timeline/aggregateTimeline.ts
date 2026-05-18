/**
 * aggregateTimeline — BLD-4.3, BLD-4.6 (Wave 3).
 *
 * Combines ClinicalNotes, CoachingLogs (FeelTru only), Orders,
 * GPLetters, and AdminNotes into a single descending-chronological
 * TimelineEntry[].
 *
 * Role-based visibility (Wave 6.5 cascade fix):
 *   All clinical roles → all entry types (read access is universal).
 *   Write access is enforced at component level (ClinicalNoteEditor,
 *   AdminNoteFABModal) via can() checks.
 *
 * Filtering via TimelineFilter is applied after aggregation.
 */

import type { ClinicId, ClinicalNote, CoachingLog, Order, GPLetter, AdminNote, User } from '@/lib/api/types';
import { adaptClinicalNote } from './adapters/clinicalNote';
import { adaptCoachingLog }  from './adapters/coachingLog';
import { adaptOrderEvent }   from './adapters/orderEvent';
import { adaptGpLetter }     from './adapters/gpLetter';
import { adaptAdminNote }    from './adapters/adminNote';
import type { TimelineEntry, TimelineFilter } from './types';

type TimelineInput = {
  clinicalNotes: ClinicalNote[];
  coachingLogs:  CoachingLog[];
  orders:        Order[];
  gpLetters:     GPLetter[];
  adminNotes:    AdminNote[];   // BLD-4.5.3 — hidden from Coach
  clinicId:      ClinicId;
  actor:         User;
  /** Optional display-name maps for author labels */
  userNames?:    Record<string, string>;
};

export function aggregateTimeline(
  input: TimelineInput,
  filter?: TimelineFilter,
): TimelineEntry[] {
  const { clinicalNotes, coachingLogs, orders, gpLetters, adminNotes, clinicId, actor, userNames = {} } = input;

  const entries: TimelineEntry[] = [];

  // ── Clinical notes ─────────────────────────────────────────────────────────
  // Wave 6.5 cascade fix: all roles read clinical notes. Write is gated at
  // component level (ClinicalNoteEditor checks can(actor,'write','clinical_notes')).
  for (const n of clinicalNotes) {
    entries.push(adaptClinicalNote(
      n,
      clinicId,
      userNames[n.author_user_id],
      n.reversed_by_user_id ? userNames[n.reversed_by_user_id] : undefined,
    ));
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

  // ── GP Letters ────────────────────────────────────────────────────────────
  // Wave 6.5 cascade fix: all roles read GP letters.
  for (const l of gpLetters) {
    entries.push(adaptGpLetter(l, clinicId, userNames[l.created_by_user_id]));
  }

  // ── Admin Notes ───────────────────────────────────────────────────────────
  // Wave 6.5 cascade fix: all roles read admin notes. Write is gated at
  // component level (AdminNoteFABModal checks can(actor,'write','admin_notes')).
  for (const n of adminNotes) {
    entries.push(adaptAdminNote(n, clinicId, userNames[n.created_by_user_id]));
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
