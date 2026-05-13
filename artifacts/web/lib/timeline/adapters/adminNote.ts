/**
 * Timeline adapter — AdminNote → TimelineEntry (BLD-4.5.3, Wave 5).
 *
 * badge_color: blue — shared with order_event per Gap 3 decision.
 * Rendering is type-discriminated in PatientNotesTimeline so no union change is needed.
 *
 * link_url: null — admin notes have no dedicated detail route in V1.1.
 *
 * Role visibility: Coach has NO ACCESS to admin_note entries.
 * Gate is enforced in aggregateTimeline (!isCoach guard) — not here.
 */

import type { AdminNote, ClinicId } from '@/lib/api/types';
import type { TimelineEntry } from '../types';

const TAG_LABEL: Record<AdminNote['tag'], string> = {
  handoff:   'Handoff',
  follow_up: 'Follow-up',
  context:   'Context',
  general:   'General',
};

export function adaptAdminNote(
  note: AdminNote,
  _clinicId: ClinicId,
  authorName?: string,
): TimelineEntry {
  const label = authorName ? `${authorName} (Admin)` : `${note.created_by_user_id} (Admin)`;
  const tagLabel = TAG_LABEL[note.tag] ?? note.tag;
  const bodySnippet = note.body.length > 90 ? `${note.body.slice(0, 87)}…` : note.body;
  const summary = `[${tagLabel}] ${bodySnippet}`;

  return {
    id:           note.id,
    type:         'admin_note',
    patient_id:   note.patient_id,
    occurred_at:  note.updated_at ?? note.created_at,
    author_label: label,
    summary:      summary.length > 120 ? `${summary.slice(0, 117)}…` : summary,
    badge_color:  'blue',
    link_url:     null,
  };
}
