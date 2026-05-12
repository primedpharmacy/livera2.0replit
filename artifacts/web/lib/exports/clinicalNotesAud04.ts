/**
 * AUD-04 clinical notes export — BLD-4.7 (Wave 3).
 *
 * Produces a CSV string for the AUD-04 Patient Outcomes audit.
 * Columns: note_id, patient_id, author, role, created_at,
 *           order_id, body_length, ai_drafted, has_edits
 *
 * 3-layer safety chain:
 *   Layer 1 (UI): Admin-only page gate
 *   Layer 2 (server): role checked here, throws PERMISSION_DENIED
 *   Layer 3 (audit): [AUDIT] entry per export attempt
 */

import type { ClinicalNote, ClinicId, User } from '@/lib/api/types';
import { APIError, NOW } from '@/lib/api/constants';

function escapeCsv(value: string | number | boolean | null): string {
  const s = String(value ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

const HEADER = 'note_id,patient_id,author,role,created_at,order_id,body_length,ai_drafted,has_edits';

export function exportClinicalNotesAud04(
  notes: ClinicalNote[],
  clinicId: ClinicId,
  fromDate: string,
  toDate: string,
  actor: User,
): string {
  // Layer 2 — server gate
  if (!actor.roles.some((r) => r === 'Admin' || r === 'Owner')) {
    console.log('[AUDIT]', {
      event_type:  'aud04_export_blocked',
      outcome:     'PERMISSION_DENIED',
      actor_id:    actor.id,
      clinic_id:   clinicId,
      timestamp:   NOW,
      reason:      'Actor role not Admin or Owner',
    });
    throw new APIError('PERMISSION_DENIED', 'Only Admin or Owner can export clinical notes');
  }

  const from = new Date(fromDate).getTime();
  const to   = new Date(toDate).getTime();

  const filtered = notes.filter((n) => {
    const t = new Date(n.created_at).getTime();
    return n.clinic_id === clinicId && t >= from && t <= to;
  });

  // Layer 3 — audit
  console.log('[AUDIT]', {
    event_type:    'aud04_export_generated',
    outcome:       'success',
    actor_id:      actor.id,
    clinic_id:     clinicId,
    from_date:     fromDate,
    to_date:       toDate,
    notes_count:   filtered.length,
    timestamp:     NOW,
  });

  const rows = filtered.map((n) =>
    [
      n.id,
      n.patient_id,
      n.author_user_id,
      n.author_role,
      n.created_at,
      n.order_id ?? '',
      n.body.length,
      n.ai_drafted,
      n.edit_history.length > 0,
    ]
      .map(escapeCsv)
      .join(',')
  );

  return [HEADER, ...rows].join('\n');
}
