/**
 * Livera Admin Note fixtures — BLD-4.5.1 (Wave 5).
 *
 * AdminNote is a non-clinical operational record (handoffs, follow-up reminders, admin context).
 * Distinct from ClinicalNote: no min-char gate, no AI drafting, no order approval gate.
 *
 * Permissions: Admin/Owner write; Prescriber read; Coach NO ACCESS.
 *
 * 3-layer safety chain on all mutations:
 *   Layer 1 (UI gate): FAB visibility + Save button gate (BLD-4.5.2)
 *   Layer 2 (server gate): can() check; throws SAFETY_VIOLATION on denial
 *   Layer 3 (audit log): [AUDIT] entry per mutation
 */

import type { ClinicId, AdminNote } from '../types';
import { NOW, delay, APIError, CURRENT_USER } from '../constants';
import { can } from '@/lib/permissions';

export const MOCK_ADMIN_NOTES: AdminNote[] = [
  {
    id: 'AN-001',
    clinic_id: 'feeltru',
    patient_id: 'PT-00378',
    body: 'Patient called to confirm GP details. Verified with Dr. Patel at Holborn GP — address confirmed correct. Handoff note: GP is expecting our correspondence.',
    created_by_user_id: 'user_qadir',
    created_at: '2026-04-08T09:15:00Z',
    updated_at: null,
    updated_by_user_id: null,
    tag: 'handoff',
  },
  {
    id: 'AN-002',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    body: 'Patient missed check-in call. Attempted contact x2 — no answer. Follow up due in 48h before escalating to prescriber.',
    created_by_user_id: 'user_qadir',
    created_at: '2026-05-01T14:30:00Z',
    updated_at: null,
    updated_by_user_id: null,
    tag: 'follow_up',
  },
  {
    id: 'AN-003',
    clinic_id: 'feeltru',
    patient_id: 'PT-00445',
    body: 'Patient requested address change — updated in system. Adverse event report pending GP notification. Old address: 12 Maple St, London. New address confirmed via ID document.',
    created_by_user_id: 'user_qadir',
    created_at: '2026-05-09T10:00:00Z',
    updated_at: '2026-05-09T10:45:00Z',
    updated_by_user_id: 'user_qadir',
    tag: 'context',
  },
  {
    id: 'AN-004',
    clinic_id: 'feeltru',
    patient_id: 'PT-00378',
    body: 'Consent to GP communication confirmed verbally on call — already on record from initial registration. GP letter is now in the owed queue.',
    created_by_user_id: 'user_qadir',
    created_at: '2026-04-10T09:50:00Z',
    updated_at: null,
    updated_by_user_id: null,
    tag: 'general',
  },
  {
    id: 'AN-005',
    clinic_id: 'vsc',
    patient_id: 'PT-00234',
    body: 'Patient travelling for 3 weeks — delivery address changed temporarily to Manchester. Standard delivery confirmed. Revert to London address from 1 June.',
    created_by_user_id: 'user_vsc_admin',
    created_at: '2026-05-07T11:20:00Z',
    updated_at: null,
    updated_by_user_id: null,
    tag: 'context',
  },
  {
    id: 'AN-006',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    body: 'URGENT follow-up: patient called back, confirmed they are okay but were unwell last week. Appointment rescheduled for 20 May. No clinical escalation required — admin note only.',
    created_by_user_id: 'user_qadir',
    created_at: '2026-05-03T16:10:00Z',
    updated_at: null,
    updated_by_user_id: null,
    tag: 'follow_up',
  },
];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listAdminNotesByPatient(
  clinic_id: ClinicId,
  patient_id: string,
): Promise<AdminNote[]> {
  await delay(150);
  return MOCK_ADMIN_NOTES
    .filter((n) => n.clinic_id === clinic_id && n.patient_id === patient_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ---------------------------------------------------------------------------
// Mutations (3-layer safety chain)
// ---------------------------------------------------------------------------

export async function createAdminNote(
  clinic_id: ClinicId,
  data: { patient_id: string; body: string; tag: AdminNote['tag'] },
): Promise<AdminNote> {
  await delay(300);

  // Layer 2 — server gate
  if (!can(CURRENT_USER, 'write', 'admin_notes')) {
    console.log('[AUDIT]', {
      event_type: 'admin_note_created',
      outcome: 'safety_violation',
      actor_id: CURRENT_USER.id,
      clinic_id,
      patient_id: data.patient_id,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Insufficient permissions to create admin note');
  }

  const note: AdminNote = {
    id: `AN-${String(MOCK_ADMIN_NOTES.length + 1).padStart(3, '0')}`,
    clinic_id,
    patient_id: data.patient_id,
    body: data.body,
    created_by_user_id: CURRENT_USER.id,
    created_at: NOW,
    updated_at: null,
    updated_by_user_id: null,
    tag: data.tag,
  };

  MOCK_ADMIN_NOTES.push(note);

  // Layer 3 — audit log
  console.log('[AUDIT]', {
    event_type: 'admin_note_created',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    note_id: note.id,
    clinic_id,
    patient_id: data.patient_id,
    tag: data.tag,
    timestamp: NOW,
  });

  return note;
}

export async function updateAdminNote(
  clinic_id: ClinicId,
  id: string,
  data: Partial<Pick<AdminNote, 'body' | 'tag'>>,
): Promise<AdminNote> {
  await delay(300);

  // Layer 2 — server gate
  if (!can(CURRENT_USER, 'write', 'admin_notes')) {
    console.log('[AUDIT]', {
      event_type: 'admin_note_updated',
      outcome: 'safety_violation',
      actor_id: CURRENT_USER.id,
      clinic_id,
      note_id: id,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Insufficient permissions to update admin note');
  }

  const note = MOCK_ADMIN_NOTES.find((n) => n.clinic_id === clinic_id && n.id === id);
  if (!note) throw new APIError('NOT_FOUND', 'Admin note not found');

  if (data.body !== undefined) note.body = data.body;
  if (data.tag !== undefined) note.tag = data.tag;
  note.updated_at = NOW;
  note.updated_by_user_id = CURRENT_USER.id;

  // Layer 3 — audit log
  console.log('[AUDIT]', {
    event_type: 'admin_note_updated',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    note_id: id,
    clinic_id,
    timestamp: NOW,
  });

  return note;
}
