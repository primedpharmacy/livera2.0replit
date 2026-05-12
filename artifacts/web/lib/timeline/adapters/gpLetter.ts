/**
 * Timeline adapter — GPLetter → TimelineEntry (BLD-4.3, Wave 3).
 *
 * badge_color: neutral
 * link_url: null (GP letters have no dedicated detail page in Wave 3)
 */

import type { GPLetter, ClinicId } from '@/lib/api/types';
import type { TimelineEntry } from '../types';

const LIFECYCLE_LABEL: Record<GPLetter['lifecycle_status'], string> = {
  awaiting_consent: 'Awaiting patient consent',
  owed:             'Letter queued',
  sent:             'Letter sent to GP',
  cancelled:        'Letter cancelled',
  ad_hoc:           'Ad-hoc GP letter',
};

export function adaptGpLetter(
  letter: GPLetter,
  clinicId: ClinicId,   // kept for future deep-link support
  authorName?: string,
): TimelineEntry {
  void clinicId;
  const label = authorName ? `${authorName} (Prescriber)` : `${letter.created_by_user_id} (Prescriber)`;
  const lifecycleLabel = LIFECYCLE_LABEL[letter.lifecycle_status] ?? letter.lifecycle_status;
  const summary = `GP letter: ${lifecycleLabel} — ${letter.subject}`;

  return {
    id:           letter.id,
    type:         'gp_letter',
    patient_id:   letter.patient_id,
    occurred_at:  letter.sent_at ?? letter.created_at,
    author_label: label,
    summary:      summary.length > 100 ? `${summary.slice(0, 97)}…` : summary,
    badge_color:  'neutral',
    link_url:     null,
  };
}
