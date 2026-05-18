'use server';

/**
 * GP Letter server actions — BLD-7.3 / BLD-7.4 (Wave 5), Task-194.
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
 */

import { requireServerActionUser } from '@/lib/auth/session';
import { generateGpLetterPdf } from '@/lib/integrations/pdfGeneration';
import { sendViaPostmark } from '@/lib/integrations/postmark';
import {
  getGPLetter,
  getPatient,
  getClinic,
  createGPLetter,
  sendGPLetter,
  cancelGPLetter,
} from '@/lib/api/mock';
import type { ClinicId, GPLetter } from '@/lib/api/types';

type CreateGPLetterPayload = Parameters<typeof createGPLetter>[1];

// ---------------------------------------------------------------------------
// createGPLetterAction — Task-194
// ---------------------------------------------------------------------------

export async function createGPLetterAction(
  clinicId: ClinicId,
  payload: CreateGPLetterPayload,
): Promise<GPLetter> {
  const actor = await requireServerActionUser();
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

  const [letter, clinic] = await Promise.all([
    getGPLetter(clinicId, letterId),
    getClinic(clinicId),
  ]);

  const patient = await getPatient(clinicId, letter.patient_id);
  const gpEmail = patient.gp?.email ?? null;

  if (!gpEmail) {
    throw new Error('No GP email address on record for this patient');
  }

  // Step 1 — Generate PDF
  const pdfResult = await generateGpLetterPdf({
    template:        letter.body,
    patient,
    order:           null,
    clinic,
    prescriber_name: actor.full_name,
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
  return cancelGPLetter(clinicId, letterId, cancelReason, actor);
}
