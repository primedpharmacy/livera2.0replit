'use server';

/**
 * GP Letter server actions — BLD-7.3 / BLD-7.4 (Wave 5), Task-194 / Task-293.
 *
 * Server actions allow the GPLetterDetailClient (client component) to
 * orchestrate Node.js-only operations (pdfkit, Postmark) without bundling
 * them into the client JavaScript.
 *
 * sendGPLetterAction pipeline:
 *   1. generateGpLetterPdf  → pdf_buffer, filename, byte_size
 *   2. sendViaPostmark      → message_id
 *   3. sendGPLetter fixture → updated GPLetter (audit payload written + Layer 3 log)
 *
 * All three layers of the safety chain are enforced:
 *   Layer 1 — UI gate in GPLetterDetailClient (button disabled)
 *   Layer 2 — server gate in sendGPLetter fixture (consent/terminal state checks)
 *   Layer 3 — audit log in sendGPLetter fixture ([AUDIT] entry)
 *
 * Task-194: actor is resolved server-side via requireServerActionUser().
 * Task-293: per-action role gate runs before the fixture — GP letter
 * authoring is restricted to Owner/Admin/Prescriber (Coach is read-only per
 * BLD-2.1; Coach attempts produce a `gp_letter_*_blocked` audit line).
 */

import {
  requireServerActionUser,
  requireAnyRole,
} from '@/lib/auth/session';
import { generateGpLetterPdf } from '@/lib/integrations/pdfGeneration';
import { sendViaPostmark } from '@/lib/integrations/postmark';
import {
  getGPLetter,
  getPatient,
  getClinic,
  createGPLetter,
  sendGPLetter,
  cancelGPLetter,
  listClinicalNotes,
  listTeamMembers,
} from '@/lib/api/mock';
import { userNameLookupFromUsers } from '@/lib/exports/clinicalNoteSerializer';
import type { ClinicalNote, ClinicId, GPLetter } from '@/lib/api/types';

const GP_LETTER_WRITER_ROLES = ['Owner', 'RM', 'Admin', 'Prescriber'] as const;

type CreateGPLetterPayload = Parameters<typeof createGPLetter>[1];

// ---------------------------------------------------------------------------
// createGPLetterAction — Task-194
// ---------------------------------------------------------------------------

export async function createGPLetterAction(
  clinicId: ClinicId,
  payload: CreateGPLetterPayload,
): Promise<GPLetter> {
  const actor = await requireServerActionUser();
  requireAnyRole(actor, GP_LETTER_WRITER_ROLES, 'gp_letter_create');
  return createGPLetter(clinicId, payload, actor);
}

// ---------------------------------------------------------------------------
// sendGPLetterAction — BLD-7.3 orchestration
// ---------------------------------------------------------------------------

export async function sendGPLetterAction(
  clinicId: ClinicId,
  letterId: string,
): Promise<GPLetter> {
  const actor = await requireServerActionUser();
  requireAnyRole(actor, GP_LETTER_WRITER_ROLES, 'gp_letter_send');

  const [letter, clinic] = await Promise.all([
    getGPLetter(clinicId, letterId),
    getClinic(clinicId),
  ]);

  const patient = await getPatient(clinicId, letter.patient_id);
  const gpEmail = patient.gp?.email ?? null;

  if (!gpEmail) {
    throw new Error('No GP email address on record for this patient');
  }

  // Task-230 — Quote only the clinical rationale that explicitly anchored
  // this letter. For auto-triggered letters that means the approval-gate
  // note for `anchor_order_id`; for manually composed letters (no anchor)
  // nothing is auto-attached, so we never leak unrelated internal notes
  // into outbound GP correspondence. Whatever IS quoted flows through
  // `serializeClinicalNoteForExport`, so reversed notes carry the
  // "[REVERSED on …]" marker and a GP cannot act on undone rationale.
  // Templates opt in by referencing `{{clinical_notes}}`; passing notes
  // is a no-op for templates that don't.
  let quotedNotes: ClinicalNote[] = [];
  if (letter.anchor_order_id) {
    const allNotes = await listClinicalNotes(clinicId, {
      patient_id: letter.patient_id,
      order_id:   letter.anchor_order_id,
    });
    quotedNotes = allNotes.filter(
      (n) => n.approval_gate_for_order_id === letter.anchor_order_id,
    );
  }
  const teamMembers = await listTeamMembers(clinicId);
  const userNameLookup = userNameLookupFromUsers(teamMembers);

  // Step 1 — Generate PDF
  const pdfResult = await generateGpLetterPdf({
    template:        letter.body,
    patient,
    order:           null,
    clinic,
    prescriber_name: actor.full_name,
    quoted_clinical_notes: quotedNotes,
    user_name_lookup:      userNameLookup,
  });

  // Step 2 — Send via Postmark (or mock)
  const postmarkResult = await sendViaPostmark({
    to_email:   gpEmail,
    subject:    letter.subject,
    email_body: letter.body,
    pdf_buffer: pdfResult.pdf_buffer,
    pdf_filename: pdfResult.filename,
  });

  // Step 3 — Record send + audit payload (Layer 2 + Layer 3 in fixture)
  const updated = await sendGPLetter(clinicId, letterId, {
    email_body_sent:      letter.body,
    pdf_filename:         pdfResult.filename,
    postmark_message_id:  postmarkResult.message_id,
    byte_size:            pdfResult.byte_size,
  }, actor);

  return updated;
}

// ---------------------------------------------------------------------------
// cancelGPLetterAction — BLD-7.7
// ---------------------------------------------------------------------------

export async function cancelGPLetterAction(
  clinicId: ClinicId,
  letterId: string,
  cancelReason: string,
): Promise<GPLetter> {
  const actor = await requireServerActionUser();
  requireAnyRole(actor, GP_LETTER_WRITER_ROLES, 'gp_letter_cancel');
  return cancelGPLetter(clinicId, letterId, cancelReason, actor);
}
