/**
 * Timeline adapter — ClinicalNote → TimelineEntry (BLD-4.3, Wave 3).
 *
 * badge_color: green
 * link_url: /<clinicId>/patients/<patientId>?tab=notes (deep-links to Notes tab)
 */

import type { ClinicalNote, ClinicId } from '@/lib/api/types';
import type { TimelineEntry } from '../types';

export function adaptClinicalNote(
  note: ClinicalNote,
  clinicId: ClinicId,
  authorName?: string,
  reversedByName?: string,
): TimelineEntry {
  const label = authorName
    ? `${authorName} (${note.author_role})`
    : `${note.author_user_id} (${note.author_role})`;

  const summary = note.body.length > 100 ? `${note.body.slice(0, 97)}…` : note.body;

  return {
    id:           note.id,
    type:         'clinical_note',
    patient_id:   note.patient_id,
    occurred_at:  note.created_at,
    author_label: label,
    summary,
    badge_color:  'green',
    link_url:     `/${clinicId}/patients/${note.patient_id}?tab=notes`,
    // Task-154 — propagate reversal so the UI can render a "Reversed" badge.
    reversed_at:       note.reversed_at ?? null,
    reversed_by_label: note.reversed_at
      ? (reversedByName ?? note.reversed_by_user_id ?? null)
      : null,
  };
}
