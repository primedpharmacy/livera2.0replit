/**
 * Livera clinical notes fixtures — BLD-4.1, BLD-4.2, BLD-4.5 (Wave 3).
 * BLD-6.1, BLD-6.4 (Wave 4) — AI audit trail fields + updateClinicalNote extension.
 *
 * 3-layer safety chain on all mutations:
 *   Layer 1 (UI): role gate + min-chars enforced in ClinicalNoteEditor
 *   Layer 2 (server): APIError('SAFETY_VIOLATION') thrown here if bypassed
 *   Layer 3 (audit): [AUDIT] console entry on every write / update
 *
 * BLD-6.1: Added 3 AI audit trail fields to all seeds (null/[]).
 * BLD-6.4: updateClinicalNote extended to persist AI audit diff when ai_drafted=true.
 */

import type { ClinicId, ClinicalNote } from '../types';
import { delay, APIError, scopedToClinic, CURRENT_USER, NOW } from '../constants';
import { getClinicSync } from './clinics';
import { can } from '@/lib/permissions';
import { recordAudit } from '../audit'; // Task-167 — durable spine

// ---------------------------------------------------------------------------
// Seeds — 13 notes across both clinics
// BLD-6.1: All seeds carry null AI audit trail fields (populated by BLD-6.4 on sign-off).
// ---------------------------------------------------------------------------

export const MOCK_CLINICAL_NOTES: ClinicalNote[] = [
  // ── FeelTru: Sarah Cookland (PT-00198) — reorder ORD-00441 ───────────────
  {
    id: 'NOTE-00001',
    patient_id: 'PT-00198',
    order_id: 'ORD-00441',
    clinic_id: 'feeltru',
    author_user_id: 'user_qadir',
    author_role: 'Prescriber',
    body: 'Reorder review — patient reports mild nausea, consistent with titration phase. Weight on track. Approved for 7.5mg continuation. Monitoring for GI side effects.',
    created_at: '2026-05-11T08:30:00Z',
    updated_at: '2026-05-11T08:30:00Z',
    edit_history: [],
    approval_gate_for_order_id: 'ORD-00441',
    ai_drafted: false,
    ai_draft_accepted_at: null,
    ai_draft_edited_by: null,
    ai_prompt_version_id: null,
    ai_draft_original: null,
    ai_draft_edits: [],
    final_note: null,
    tags: ['clinical_check', 'reorder'],
    visibility: 'clinical_team',
  },
  {
    id: 'NOTE-00002',
    patient_id: 'PT-00198',
    order_id: null,
    clinic_id: 'feeltru',
    author_user_id: 'user_qadir',
    author_role: 'Prescriber',
    body: 'Initial prescriber review completed. BMI verified. G6PD status noted. Patient eligible for Mounjaro programme. No contraindications identified.',
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-01T10:00:00Z',
    edit_history: [],
    approval_gate_for_order_id: null,
    ai_drafted: false,
    ai_draft_accepted_at: null,
    ai_draft_edited_by: null,
    ai_prompt_version_id: null,
    ai_draft_original: null,
    ai_draft_edits: [],
    final_note: null,
    tags: ['intake', 'initial_review'],
    visibility: 'clinical_team',
  },
  {
    id: 'NOTE-00003',
    patient_id: 'PT-00198',
    order_id: null,
    clinic_id: 'feeltru',
    author_user_id: 'user_claire',
    author_role: 'Prescriber',
    body: 'Follow-up note after escalation flag. Reviewed coach notes — patient experiencing elevated anxiety. Recommend GP referral if no improvement in 2 weeks. No immediate safety concern.',
    created_at: '2026-03-15T14:20:00Z',
    updated_at: '2026-03-15T15:00:00Z',
    edit_history: [
      {
        edited_at: '2026-03-15T15:00:00Z',
        edited_by: 'user_claire',
        previous_body: 'Follow-up note after escalation flag. Reviewed coach notes. No immediate safety concern.',
      },
    ],
    approval_gate_for_order_id: null,
    ai_drafted: false,
    ai_draft_accepted_at: null,
    ai_draft_edited_by: null,
    ai_prompt_version_id: null,
    ai_draft_original: null,
    ai_draft_edits: [],
    final_note: null,
    tags: ['escalation', 'follow_up'],
    visibility: 'clinical_team',
  },

  // ── VSC: James Henderson (PT-00234) — approved ORD-00438 ─────────────────
  {
    id: 'NOTE-00004',
    patient_id: 'PT-00234',
    order_id: 'ORD-00438',
    clinic_id: 'vsc',
    author_user_id: 'user_qadir',
    author_role: 'Prescriber',
    body: 'Patient progressing well on Mounjaro 5mg. Weight loss on target at 6.4kg from baseline. No contraindications. Approved for next supply.',
    created_at: '2026-05-03T14:00:00Z',
    updated_at: '2026-05-03T14:00:00Z',
    edit_history: [],
    approval_gate_for_order_id: 'ORD-00438',
    ai_drafted: false,
    ai_draft_accepted_at: null,
    ai_draft_edited_by: null,
    ai_prompt_version_id: null,
    ai_draft_original: null,
    ai_draft_edits: [],
    final_note: null,
    tags: ['clinical_check', 'reorder'],
    visibility: 'clinical_team',
  },
  {
    id: 'NOTE-00005',
    patient_id: 'PT-00234',
    order_id: null,
    clinic_id: 'vsc',
    author_user_id: 'user_claire',
    author_role: 'Prescriber',
    body: 'Dose escalation assessment. Patient has completed 12 weeks on 2.5mg. Weight loss plateau observed. Clinically appropriate to escalate to 5mg. Questionnaire evidence reviewed.',
    created_at: '2026-03-01T11:00:00Z',
    updated_at: '2026-03-01T11:00:00Z',
    edit_history: [],
    approval_gate_for_order_id: null,
    ai_drafted: false,
    ai_draft_accepted_at: null,
    ai_draft_edited_by: null,
    ai_prompt_version_id: null,
    ai_draft_original: null,
    ai_draft_edits: [],
    final_note: null,
    tags: ['dose_escalation'],
    visibility: 'clinical_team',
  },

  // ── VSC: Miriam Okonkwo (PT-00156) — clinical_check ORD-00422 ────────────
  {
    id: 'NOTE-00006',
    patient_id: 'PT-00156',
    order_id: null,
    clinic_id: 'vsc',
    author_user_id: 'user_qadir',
    author_role: 'Prescriber',
    body: 'Initial eligibility review. Patient meets criteria. BMI 36.2 confirmed. No active contraindications. Enrolled on Mounjaro 2.5mg starter programme.',
    created_at: '2026-01-10T09:30:00Z',
    updated_at: '2026-01-10T09:30:00Z',
    edit_history: [],
    approval_gate_for_order_id: null,
    ai_drafted: false,
    ai_draft_accepted_at: null,
    ai_draft_edited_by: null,
    ai_prompt_version_id: null,
    ai_draft_original: null,
    ai_draft_edits: [],
    final_note: null,
    tags: ['intake', 'initial_review'],
    visibility: 'clinical_team',
  },

  // ── FeelTru: Additional notes for timeline depth ───────────────────────────
  {
    id: 'NOTE-00007',
    patient_id: 'PT-00198',
    order_id: null,
    clinic_id: 'feeltru',
    author_user_id: 'user_claire',
    author_role: 'Prescriber',
    body: 'Quarterly clinical review. Patient stable. BMI reduced from 33.8 to 31.2. Side effect profile acceptable. Continuing programme.',
    created_at: '2026-04-10T10:00:00Z',
    updated_at: '2026-04-10T10:00:00Z',
    edit_history: [],
    approval_gate_for_order_id: null,
    ai_drafted: false,
    ai_draft_accepted_at: null,
    ai_draft_edited_by: null,
    ai_prompt_version_id: null,
    ai_draft_original: null,
    ai_draft_edits: [],
    final_note: null,
    tags: ['quarterly_review'],
    visibility: 'clinical_team',
  },
  {
    id: 'NOTE-00008',
    patient_id: 'PT-00198',
    order_id: null,
    clinic_id: 'feeltru',
    author_user_id: 'user_qadir',
    author_role: 'Admin',
    body: 'Consent forms reviewed and verified with patient during welcome call. All 9 mandatory consents confirmed. GP communication consent provided.',
    created_at: '2026-01-18T11:00:00Z',
    updated_at: '2026-01-18T11:00:00Z',
    edit_history: [],
    approval_gate_for_order_id: null,
    ai_drafted: false,
    ai_draft_accepted_at: null,
    ai_draft_edited_by: null,
    ai_prompt_version_id: null,
    ai_draft_original: null,
    ai_draft_edits: [],
    final_note: null,
    tags: ['admin', 'consent'],
    visibility: 'clinical_team',
  },

  // ── VSC: PT-00234 additional history ─────────────────────────────────────
  {
    id: 'NOTE-00009',
    patient_id: 'PT-00234',
    order_id: null,
    clinic_id: 'vsc',
    author_user_id: 'user_qadir',
    author_role: 'Prescriber',
    body: 'Patient reported mild injection site reaction. Advised to rotate injection sites. No systemic reaction. Monitor and report if worsens.',
    created_at: '2026-04-15T13:00:00Z',
    updated_at: '2026-04-15T13:00:00Z',
    edit_history: [],
    approval_gate_for_order_id: null,
    ai_drafted: false,
    ai_draft_accepted_at: null,
    ai_draft_edited_by: null,
    ai_prompt_version_id: null,
    ai_draft_original: null,
    ai_draft_edits: [],
    final_note: null,
    tags: ['adverse_event', 'monitoring'],
    visibility: 'clinical_team',
  },

  // ── Additional VSC / FeelTru notes for export testing ─────────────────────
  {
    id: 'NOTE-00010',
    patient_id: 'PT-00012',
    order_id: null,
    clinic_id: 'vsc',
    author_user_id: 'user_claire',
    author_role: 'Prescriber',
    body: 'Reviewed questionnaire responses for new patient. Identity verified via Sumsub. Eligible for Mounjaro starter. Prescribing 2.5mg pen.',
    created_at: '2026-02-20T09:00:00Z',
    updated_at: '2026-02-20T09:00:00Z',
    edit_history: [],
    approval_gate_for_order_id: null,
    ai_drafted: false,
    ai_draft_accepted_at: null,
    ai_draft_edited_by: null,
    ai_prompt_version_id: null,
    ai_draft_original: null,
    ai_draft_edits: [],
    final_note: null,
    tags: ['intake'],
    visibility: 'clinical_team',
  },
  {
    id: 'NOTE-00011',
    patient_id: 'PT-00156',
    order_id: null,
    clinic_id: 'vsc',
    author_user_id: 'user_claire',
    author_role: 'Prescriber',
    body: 'Checking in following reported nausea. Confirmed dietary adjustments are helping. Continuing current dose. Patient reassured.',
    created_at: '2026-02-28T15:30:00Z',
    updated_at: '2026-02-28T15:30:00Z',
    edit_history: [],
    approval_gate_for_order_id: null,
    ai_drafted: false,
    ai_draft_accepted_at: null,
    ai_draft_edited_by: null,
    ai_prompt_version_id: null,
    ai_draft_original: null,
    ai_draft_edits: [],
    final_note: null,
    tags: ['monitoring', 'follow_up'],
    visibility: 'clinical_team',
  },
  {
    id: 'NOTE-00012',
    patient_id: 'PT-00198',
    order_id: null,
    clinic_id: 'feeltru',
    author_user_id: 'user_qadir',
    author_role: 'Admin',
    body: 'Patient requested address update. New address verified against identity documents. Updated in system. No clinical impact.',
    created_at: '2026-04-28T10:15:00Z',
    updated_at: '2026-04-28T10:15:00Z',
    edit_history: [],
    approval_gate_for_order_id: null,
    ai_drafted: false,
    ai_draft_accepted_at: null,
    ai_draft_edited_by: null,
    ai_prompt_version_id: null,
    ai_draft_original: null,
    ai_draft_edits: [],
    final_note: null,
    tags: ['admin'],
    visibility: 'clinical_team',
  },
  {
    id: 'NOTE-00013',
    patient_id: 'PT-00234',
    order_id: null,
    clinic_id: 'vsc',
    author_user_id: 'user_qadir',
    author_role: 'Admin',
    body: 'G6PD blood test result received and filed. Result negative — patient cleared for standard Mounjaro treatment pathway.',
    created_at: '2026-01-25T14:00:00Z',
    updated_at: '2026-01-25T14:00:00Z',
    edit_history: [],
    approval_gate_for_order_id: null,
    ai_drafted: false,
    ai_draft_accepted_at: null,
    ai_draft_edited_by: null,
    ai_prompt_version_id: null,
    ai_draft_original: null,
    ai_draft_edits: [],
    final_note: null,
    tags: ['g6pd', 'lab_result'],
    visibility: 'clinical_team',
  },
];

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** List notes for a clinic, optionally filtered */
export async function listClinicalNotes(
  clinicId: ClinicId,
  filters?: { patient_id?: string; order_id?: string },
): Promise<ClinicalNote[]> {
  await delay();
  let notes = MOCK_CLINICAL_NOTES.filter((n) => n.clinic_id === clinicId);
  if (filters?.patient_id) notes = notes.filter((n) => n.patient_id === filters.patient_id);
  if (filters?.order_id)   notes = notes.filter((n) => n.order_id   === filters.order_id);
  return notes.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Get a single note — throws NOT_FOUND if missing or wrong clinic */
export async function getClinicalNote(clinicId: ClinicId, noteId: string): Promise<ClinicalNote> {
  await delay();
  const note = MOCK_CLINICAL_NOTES.find((n) => n.id === noteId && n.clinic_id === clinicId);
  if (!note) throw new APIError('NOT_FOUND', `Clinical note '${noteId}' not found`);
  return note;
}

/**
 * createClinicalNote — BLD-4.2 + BLD-6.2 (AI audit trail on creation)
 * 3-layer chain:
 *   Layer 1 (UI): ClinicalNoteEditor / AINoteDraftingModal enforces role + minChars before calling
 *   Layer 2 (server): role + minChars re-checked here
 *   Layer 3 (audit): [AUDIT] on success AND failure
 */
export async function createClinicalNote(
  clinicId: ClinicId,
  payload: {
    patient_id: string;
    order_id: string | null;
    body: string;
    approval_gate_for_order_id: string | null;
    tags?: string[];
    visibility?: ClinicalNote['visibility'];
    // BLD-6.2 AI audit fields (optional — null when not AI-drafted)
    ai_drafted?: boolean;
    ai_draft_original?: string | null;
    ai_draft_edits?: ClinicalNote['ai_draft_edits'];
    final_note?: string | null;
    ai_draft_accepted_at?: string | null;
    ai_draft_edited_by?: string | null;
    ai_prompt_version_id?: string | null;
  },
): Promise<ClinicalNote> {
  await delay();

  const clinic = getClinicSync(clinicId);

  // Layer 2 — role gate
  if (!can(CURRENT_USER, 'write', 'clinical_notes')) {
    console.log('[AUDIT]', { event_type: 'clinical_note_create_blocked', outcome: 'PERMISSION_DENIED', actor_id: CURRENT_USER.id, clinic_id: clinicId });
    throw new APIError('SAFETY_VIOLATION', 'Only Prescribers and Admins may write clinical notes');
  }

  // Layer 2 — min-chars gate
  const minChars = clinic.config.clinical_note_min_chars;
  if (payload.body.length < minChars) {
    console.log('[AUDIT]', { event_type: 'clinical_note_create_blocked', outcome: 'TOO_SHORT', actor_id: CURRENT_USER.id, clinic_id: clinicId, body_length: payload.body.length, min_chars: minChars });
    throw new APIError('SAFETY_VIOLATION', `Clinical note must be at least ${minChars} characters`);
  }

  const aiDrafted = payload.ai_drafted ?? false;

  const note: ClinicalNote = {
    id: `NOTE-${String(MOCK_CLINICAL_NOTES.length + 1).padStart(5, '0')}`,
    patient_id: payload.patient_id,
    order_id: payload.order_id,
    clinic_id: clinicId,
    author_user_id: CURRENT_USER.id,
    author_role: CURRENT_USER.roles.includes('Prescriber') ? 'Prescriber' : 'Admin',
    body: payload.body,
    created_at: NOW,
    updated_at: NOW,
    edit_history: [],
    approval_gate_for_order_id: payload.approval_gate_for_order_id,
    ai_drafted: aiDrafted,
    ai_draft_accepted_at: payload.ai_draft_accepted_at ?? null,
    ai_draft_edited_by: payload.ai_draft_edited_by ?? null,
    ai_prompt_version_id: payload.ai_prompt_version_id ?? null,
    // BLD-6.1 — AI audit trail
    ai_draft_original: payload.ai_draft_original ?? null,
    ai_draft_edits: payload.ai_draft_edits ?? [],
    final_note: aiDrafted ? payload.body : null,
    tags: payload.tags ?? [],
    visibility: payload.visibility ?? 'clinical_team',
  };

  MOCK_CLINICAL_NOTES.push(note);

  // Layer 3 — audit
  console.log('[AUDIT]', {
    event_type:     'clinical_note_created',
    outcome:        'success',
    actor_id:       CURRENT_USER.id,
    note_id:        note.id,
    patient_id:     note.patient_id,
    clinic_id:      clinicId,
    approval_gate:  note.approval_gate_for_order_id,
    body_length:    note.body.length,
    ai_drafted:     note.ai_drafted,
    prompt_version: note.ai_prompt_version_id,
    timestamp:      NOW,
  });
  void recordAudit({
    clinic_id: clinicId,
    actor: CURRENT_USER,
    entity: { type: 'clinical_note', id: note.id },
    event_type: 'clinical_note_created',
    summary: `Clinical note ${note.id} created for ${note.patient_id} by ${CURRENT_USER.full_name}.`,
    after: {
      patient_id: note.patient_id,
      order_id: note.order_id,
      approval_gate_for_order_id: note.approval_gate_for_order_id,
      body_length: note.body.length,
      ai_drafted: note.ai_drafted,
    },
  });

  return note;
}

/**
 * updateClinicalNote — BLD-4.5 + BLD-6.4
 * BLD-4.5: Appends prior body to edit_history before saving.
 * BLD-6.4: When ai_drafted=true on the note, compute diff, append to ai_draft_edits,
 *           update final_note. [AUDIT] with event_type 'ai_clinical_note_saved'.
 * 3-layer chain same as create.
 */
export async function updateClinicalNote(
  clinicId: ClinicId,
  noteId: string,
  payload: { body: string },
): Promise<ClinicalNote> {
  await delay();

  const clinic = getClinicSync(clinicId);

  // Layer 2 — role gate
  if (!can(CURRENT_USER, 'write', 'clinical_notes')) {
    console.log('[AUDIT]', { event_type: 'clinical_note_update_blocked', outcome: 'PERMISSION_DENIED', actor_id: CURRENT_USER.id, note_id: noteId });
    throw new APIError('SAFETY_VIOLATION', 'Only Prescribers and Admins may update clinical notes');
  }

  // Layer 2 — min-chars gate
  const minChars = clinic.config.clinical_note_min_chars;
  if (payload.body.length < minChars) {
    console.log('[AUDIT]', { event_type: 'clinical_note_update_blocked', outcome: 'TOO_SHORT', actor_id: CURRENT_USER.id, note_id: noteId, body_length: payload.body.length });
    throw new APIError('SAFETY_VIOLATION', `Clinical note must be at least ${minChars} characters`);
  }

  const idx = MOCK_CLINICAL_NOTES.findIndex((n) => n.id === noteId && n.clinic_id === clinicId);
  if (idx === -1) throw new APIError('NOT_FOUND', `Clinical note '${noteId}' not found`);

  const existing = MOCK_CLINICAL_NOTES[idx]!;

  // Layer 2 — author-only gate (prescribers may only edit their own notes)
  if (existing.author_user_id !== CURRENT_USER.id) {
    console.log('[AUDIT]', { event_type: 'clinical_note_update_blocked', outcome: 'NOT_AUTHOR', actor_id: CURRENT_USER.id, note_id: noteId });
    throw new APIError('SAFETY_VIOLATION', 'You may only edit your own clinical notes');
  }

  // BLD-6.4 — AI diff tracking: if this note was AI-drafted, append to ai_draft_edits
  const newAiDraftEdits = existing.ai_drafted && payload.body !== existing.body
    ? [...existing.ai_draft_edits, { edited_at: NOW, prev_body: existing.body, new_body: payload.body }]
    : existing.ai_draft_edits;

  const updated: ClinicalNote = {
    ...existing,
    body: payload.body,
    updated_at: NOW,
    edit_history: [
      ...existing.edit_history,
      { edited_at: NOW, edited_by: CURRENT_USER.id, previous_body: existing.body },
    ],
    // BLD-6.4: update final_note and ai_draft_edits if AI-drafted
    ai_draft_edits: newAiDraftEdits,
    final_note: existing.ai_drafted ? payload.body : existing.final_note,
  };

  MOCK_CLINICAL_NOTES[idx] = updated;

  // Layer 3 — audit
  const eventType = existing.ai_drafted ? 'ai_clinical_note_saved' : 'clinical_note_updated';
  console.log('[AUDIT]', {
    event_type:     eventType,
    outcome:        'success',
    actor_id:       CURRENT_USER.id,
    note_id:        noteId,
    clinic_id:      clinicId,
    body_length:    updated.body.length,
    edit_count:     updated.edit_history.length,
    ai_drafted:     updated.ai_drafted,
    prompt_version: updated.ai_prompt_version_id,
    edits_count:    updated.ai_draft_edits.length,
    timestamp:      NOW,
  });
  void recordAudit({
    clinic_id: clinicId,
    actor: CURRENT_USER,
    entity: { type: 'clinical_note', id: noteId },
    event_type: eventType,
    summary: `Clinical note ${noteId} updated by ${CURRENT_USER.full_name}.`,
    before: { body_length: existing.body.length, edit_count: existing.edit_history.length },
    after: {
      body_length: updated.body.length,
      edit_count: updated.edit_history.length,
      ai_drafted: updated.ai_drafted,
    },
  });

  return updated;
}
