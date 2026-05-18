'use server';

/**
 * Clinical Note server actions — Task-194 / Task-293.
 */

import {
  requireServerActionUser,
  requirePermission,
} from '@/lib/auth/session';
import { createClinicalNote, updateClinicalNote } from '@/lib/api/mock';
import type { ClinicId, ClinicalNote } from '@/lib/api/types';

type CreateClinicalNotePayload = Parameters<typeof createClinicalNote>[1];

export async function createClinicalNoteAction(
  clinicId: ClinicId,
  payload: CreateClinicalNotePayload,
): Promise<ClinicalNote> {
  const actor = await requireServerActionUser();
  requirePermission(actor, 'write', 'clinical_notes');
  return createClinicalNote(clinicId, payload, actor);
}

export async function updateClinicalNoteAction(
  clinicId: ClinicId,
  noteId: string,
  payload: { body: string },
): Promise<ClinicalNote> {
  const actor = await requireServerActionUser();
  requirePermission(actor, 'write', 'clinical_notes');
  return updateClinicalNote(clinicId, noteId, payload, actor);
}
