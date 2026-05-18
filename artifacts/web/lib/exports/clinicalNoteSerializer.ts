/**
 * Clinical-note serialiser for external consumption — Task-230.
 *
 * Task-154 surfaces "Reversed" status in the web UI and the AUD-04 CSV.
 * Clinical notes also feed downstream artefacts: GP letters, patient record
 * exports, print views. If a reversed note is quoted as the clinical
 * rationale on an outbound GP letter, the recipient sees stale reasoning
 * with no indication it was undone.
 *
 * This module centralises the "reversed" marker so every external
 * serialisation site renders the same annotation:
 *
 *   "[REVERSED on 12 May 2026 by Dr Claire Moynehan] <body>"
 *
 * Callers either:
 *   - exclude reversed notes outright (preferred when audit trail is
 *     captured elsewhere), or
 *   - render via `serializeClinicalNoteForExport` so the marker travels
 *     with the body.
 */

import type { ClinicalNote, ClinicTeamMember, User } from '@/lib/api/types';

/** Optional lookup function: id → display name (e.g. "Dr Claire Moynehan"). */
export type UserNameLookup = (userId: string) => string | undefined;

/**
 * Build a lookup from a User[] OR a ClinicTeamMember[] (handy in tests,
 * settings pages, and server actions that call `listTeamMembers`).
 * ClinicTeamMember exposes `user_id` instead of `id`; both are normalised.
 */
export function userNameLookupFromUsers(
  users: Array<User | ClinicTeamMember>,
): UserNameLookup {
  const map = new Map<string, string>();
  for (const u of users) {
    const id = 'id' in u ? u.id : u.user_id;
    map.set(id, u.full_name);
  }
  return (id) => map.get(id);
}

/** True if the note has been reversed via the Undo flow (Task-109). */
export function isClinicalNoteReversed(note: ClinicalNote): boolean {
  return Boolean(note.reversed_at);
}

function formatReversalDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/**
 * Returns a short annotation string for a reversed note, or null if the
 * note is still authoritative. Example:
 *
 *   "Reversed on 12 May 2026 by Dr Claire Moynehan"
 *
 * If the reversing clinician cannot be resolved, the raw user id is used
 * so the marker is never silently dropped.
 */
export function formatReversedAnnotation(
  note: ClinicalNote,
  lookup?: UserNameLookup,
): string | null {
  if (!note.reversed_at) return null;
  const when = formatReversalDate(note.reversed_at);
  const who = note.reversed_by_user_id
    ? (lookup?.(note.reversed_by_user_id) ?? note.reversed_by_user_id)
    : 'unknown clinician';
  return `Reversed on ${when} by ${who}`;
}

/**
 * Serialise a clinical note for external consumption (GP letter PDF,
 * patient record export, print view). Reversed notes are prefixed with a
 * bracketed marker so the reader can see the rationale is no longer
 * authoritative.
 */
export function serializeClinicalNoteForExport(
  note: ClinicalNote,
  lookup?: UserNameLookup,
): string {
  const annotation = formatReversedAnnotation(note, lookup);
  return annotation ? `[${annotation.toUpperCase()}] ${note.body}` : note.body;
}

/**
 * Machine-readable status for tabular exports (AUD-04 CSV, future
 * audit/print views). Kept separate from the human-readable annotation
 * so CSV consumers can filter without parsing prose.
 */
export function clinicalNoteExportStatus(
  note: ClinicalNote,
): 'active' | 'reversed' {
  return isClinicalNoteReversed(note) ? 'reversed' : 'active';
}
