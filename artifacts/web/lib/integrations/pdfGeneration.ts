/**
 * Livera GP Letter PDF generation — BLD-7.2 (Wave 5).
 *
 * Library: pdfkit (pure Node.js — zero native binaries, NixOS/Replit compatible).
 * Chosen over puppeteer-core/@sparticuz/chromium (80–100 MB Chromium binary, Lambda-only)
 * and playwright-core (same binary risk). GP letters are structured text documents;
 * pdfkit's programmatic layout is fully sufficient.
 *
 * Feature flag: LIVERA_PDF_GENERATION_LIVE (default true in dev).
 *   false → returns a minimal stub PDF buffer with correct PDF magic bytes.
 *   true  → generates a full formatted GP letter PDF.
 *
 * Failure handling: throws APIError('PDF_GENERATION_FAILED', ...) on rendering errors.
 * Caller is responsible for logging to audit and surfacing UI message.
 *
 * Variable substitution supports:
 *   {{patient_name}}, {{patient_dob}}, {{patient_address}},
 *   {{gp_name}}, {{gp_surgery}}, {{clinic_name}}, {{prescriber_name}},
 *   {{order_summary}}, {{medication}}, {{dose}},
 *   {{clinic_email}}, {{clinic_phone}}, {{today_date}}
 */

import PDFDocument from 'pdfkit';
import type { Patient, Order, Clinic, ClinicalNote } from '@/lib/api/types';
import { APIError, NOW } from '@/lib/api/constants';
import {
  serializeClinicalNoteForExport,
  type UserNameLookup,
} from '@/lib/exports/clinicalNoteSerializer';

export type GpLetterPdfInput = {
  /** The pdf_letter_template string with {{variable}} placeholders */
  template: string;
  patient: Patient;
  order: Order | null;
  clinic: Clinic;
  /** Display name of the prescriber who is signing the letter */
  prescriber_name: string;
  /**
   * Task-230 — Clinical notes quoted in the letter as supporting
   * rationale. Each note is serialised via `serializeClinicalNoteForExport`
   * so reversed notes carry a "[REVERSED on <date> by <clinician>] …"
   * marker — preventing recipients from acting on rationale that has
   * since been undone. Defaults to `[]` (no quoted notes).
   *
   * Substituted into the `{{clinical_notes}}` template variable. Templates
   * that don't reference the variable produce no quoted-notes section
   * (current behaviour); templates that do will render a bulleted block
   * with the reversed marker applied per note.
   */
  quoted_clinical_notes?: ClinicalNote[];
  /**
   * Optional id → display-name lookup so the reversal annotation can
   * name the clinician. Falls back to the raw user id when missing.
   */
  user_name_lookup?: UserNameLookup;
};

export type GpLetterPdfResult = {
  pdf_buffer: Buffer;
  filename: string;
  byte_size: number;
};

// ---------------------------------------------------------------------------
// Variable substitution
// ---------------------------------------------------------------------------

function formatAddress(
  addr: Patient['demographic']['address'],
): string {
  const parts = [addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean);
  return parts.join(', ');
}

function formatDob(dob: string): string {
  try {
    return new Date(dob).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dob;
  }
}

function todayFormatted(): string {
  // Use a fixed reference date consistent with NOW anchor.
  // In production this would use real Date.now().
  return new Date(NOW).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// TODO V1.2: Rich formatting (bold/italic/bullets/tables/embedded
// images) is NOT supported in V1.1 — templates are rendered as
// plain text paragraphs split on \n\n. If a future template
// requires inline formatting, migrate to HTML-to-PDF (puppeteer
// + @sparticuz/chromium) with the bundle-size and NixOS-deploy
// trade-off accepted.
/**
 * Render the supplied clinical notes as a bulleted block. Reversed notes
 * carry a "[REVERSED on <date> by <clinician>] …" marker so a GP reading
 * the letter cannot mistake undone rationale for current clinical
 * reasoning (Task-230).
 *
 * Returns an empty string when no notes are quoted, so callers can safely
 * substitute the {{clinical_notes}} variable in any template.
 */
export function renderQuotedClinicalNotes(input: GpLetterPdfInput): string {
  const notes = input.quoted_clinical_notes ?? [];
  if (notes.length === 0) return '';
  return notes
    .map((n) => `• ${serializeClinicalNoteForExport(n, input.user_name_lookup)}`)
    .join('\n');
}

function substituteVariables(
  template: string,
  input: GpLetterPdfInput,
): string {
  const { patient, order, clinic, prescriber_name } = input;

  const addressLine = formatAddress(patient.demographic.address);
  const gpName = patient.gp?.name ?? 'Dear GP';
  const gpSurgery = patient.gp?.address ?? '';
  const medication = order?.product.medication ?? 'prescribed medication';
  const dose = order?.product.dose ?? 'prescribed dose';
  const orderSummary = order
    ? `Order ${order.id}: ${order.product.medication} ${order.product.dose} — status: ${order.status}`
    : 'Treatment record on file';

  const clinicalNotesBlock = renderQuotedClinicalNotes(input);

  return template
    .replace(/\{\{clinical_notes\}\}/g, clinicalNotesBlock)
    .replace(/\{\{patient_name\}\}/g, patient.demographic.full_name)
    .replace(/\{\{patient_dob\}\}/g, formatDob(patient.demographic.dob))
    .replace(/\{\{patient_address\}\}/g, addressLine)
    .replace(/\{\{gp_name\}\}/g, gpName)
    .replace(/\{\{gp_surgery\}\}/g, gpSurgery)
    .replace(/\{\{clinic_name\}\}/g, clinic.config.clinic_name)
    .replace(/\{\{clinic_email\}\}/g, clinic.config.reply_email)
    .replace(/\{\{clinic_phone\}\}/g, '') // clinic_phone not in V1.1 schema; omitted cleanly
    .replace(/\{\{prescriber_name\}\}/g, prescriber_name)
    .replace(/\{\{medication\}\}/g, medication)
    .replace(/\{\{dose\}\}/g, dose)
    .replace(/\{\{order_summary\}\}/g, orderSummary)
    .replace(/\{\{today_date\}\}/g, todayFormatted());
}

// ---------------------------------------------------------------------------
// Stub PDF (flag off)
// ---------------------------------------------------------------------------

function buildStubPdf(filename: string): GpLetterPdfResult {
  // Minimal valid PDF with correct magic bytes — %PDF-1.4 header.
  const stub =
    '%PDF-1.4\n1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj ' +
    '2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj ' +
    '3 0 obj<</Type /Page /MediaBox [0 0 612 792]>>endobj ' +
    'xref\n0 4\n0000000000 65535 f\n' +
    'trailer<</Size 4 /Root 1 0 R>>\nstartxref\n%%EOF\n';
  const pdf_buffer = Buffer.from(stub, 'utf-8');
  return { pdf_buffer, filename, byte_size: pdf_buffer.length };
}

// ---------------------------------------------------------------------------
// Full PDF via pdfkit
// ---------------------------------------------------------------------------

function buildFullPdf(
  renderedBody: string,
  filename: string,
): Promise<GpLetterPdfResult> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      info: {
        Title: 'GP Letter',
        Author: 'Livera',
        Subject: 'GP Correspondence',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      const pdf_buffer = Buffer.concat(chunks);
      resolve({ pdf_buffer, filename, byte_size: pdf_buffer.length });
    });
    doc.on('error', (err: Error) => reject(err));

    // Render the substituted template body as paragraphs.
    // Split on double newlines → paragraphs; single newlines → line breaks within para.
    const paragraphs = renderedBody.split(/\n\n+/);

    doc.font('Helvetica').fontSize(11);

    let isFirst = true;
    for (const para of paragraphs) {
      if (!para.trim()) continue;
      if (!isFirst) doc.moveDown(0.8);
      doc.text(para.trim(), { lineGap: 3 });
      isFirst = false;
    }

    doc.end();
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * generateGpLetterPdf — generates a PDF for a GP letter.
 *
 * @param input.template   pdf_letter_template string (with {{variables}})
 * @param input.patient    Patient record
 * @param input.order      Linked Order (or null for ad-hoc letters)
 * @param input.clinic     Clinic record (for header/branding)
 * @param input.prescriber_name  Display name of signing prescriber
 *
 * @returns { pdf_buffer, filename, byte_size }
 * @throws APIError('PDF_GENERATION_FAILED', ...) on rendering errors
 */
export async function generateGpLetterPdf(
  input: GpLetterPdfInput,
): Promise<GpLetterPdfResult> {
  const flag = process.env.LIVERA_PDF_GENERATION_LIVE;
  const isLive = flag === undefined || flag === 'true'; // default true in dev

  // File naming: gp_letter_{patient_id}_{timestamp-slug}.pdf
  const timestamp = NOW.replace(/[^0-9]/g, '').slice(0, 15); // derived from NOW — single source of truth
  const filename = `gp_letter_${input.patient.id}_${timestamp}.pdf`;

  try {
    if (!isLive) {
      console.log(
        `[PDF_STUB] generateGpLetterPdf — LIVERA_PDF_GENERATION_LIVE=false. ` +
          `Returning stub PDF for patient ${input.patient.id}.`,
      );
      return buildStubPdf(filename);
    }

    const renderedBody = substituteVariables(input.template, input);
    const result = await buildFullPdf(renderedBody, filename);

    console.log(
      `[PDF] Generated ${result.filename} — ${result.byte_size} bytes ` +
        `for patient ${input.patient.id}`,
    );

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[PDF_GENERATION_FAILED]', message);
    throw new APIError('PDF_GENERATION_FAILED', `PDF generation failed: ${message}`);
  }
}
