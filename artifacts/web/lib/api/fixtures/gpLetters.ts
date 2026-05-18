/**
 * Livera GP letter fixtures — BLD-7.1 / BLD-7.4 / BLD-7.7 (Wave 5).
 *
 * Template seeds have been extracted to fixtures/gpLetterTemplates.ts (BLD-7.1).
 * This file manages GPLetter records and their lifecycle.
 *
 * DEC-22 lifecycle states:
 *   awaiting_consent — patient hasn't consented to GP correspondence
 *   owed             — consented + first treatment approved → letter queued
 *   sent             — Postmark delivery confirmed
 *   cancelled        — prescriber cancelled with reason (terminal; cannot revert)
 *   ad_hoc           — one-off letter (dose change / discontinuation / safeguarding)
 *
 * DEC-22 trigger rule:
 *   Letter enters 'owed' when AND ONLY WHEN:
 *     1. Patient consented to GP correspondence
 *     2. First treatment approved
 *   One workflow letter per patient lifetime. Subsequent triggers → 'ad_hoc'.
 */

import type { ClinicId, GPLetter } from '../types';
import { NOW, delay, APIError, CURRENT_USER } from '../constants';
import { MOCK_PATIENTS } from './patients';
import { recordAudit } from '../audit'; // Task-167 — durable spine

// Consent lookup constant — matches clinic_config.consents seed (consent_id: 'consent_gp').
// TODO V1.2: Replace with slug-based lookup. Current logic checks patient.consents_given
// by consent_id 'consent_gp' which maps to the consent titled 'Consent to GP communication'
// in clinic_config.consents. This is fragile if the consent_id is renamed.
// ConsentTemplate should gain a slug field (e.g. 'gp_communication_consent') in V1.2 schema migration.
const GP_CONSENT_ID = 'consent_gp';

export const MOCK_GP_LETTERS: GPLetter[] = [
  // GPL-001: feeltru — sent (workflow letter, first treatment)
  {
    id: 'GPL-001',
    clinic_id: 'feeltru',
    patient_id: 'PT-00378',
    template_id: 'TMPL-001',
    subject: 'Treatment commencement notification — Zara Ahmed',
    body: `Dear Dr. Patel,

I am writing to notify you that your patient Zara Ahmed has commenced treatment with FeelTru.

Please find the full clinical details in the attached formal letter.

Kind regards,
Claire Moynehan
FeelTru
admin@feeltru.com`,
    lifecycle_status: 'sent',
    status: 'delivered',
    patient_consent_verified: true,
    sent_at: '2026-04-10T10:30:00Z',
    sent_to_email: 'dr.patel@holborngp.nhs.uk',
    created_by_user_id: 'user_qadir',
    created_at: '2026-04-10T10:00:00Z',
    cancel_reason: null,
    email_body_sent: `Dear Dr. Patel,\n\nI am writing to notify you that your patient Zara Ahmed has commenced treatment with FeelTru.\n\nPlease find the full clinical details in the attached formal letter.\n\nKind regards,\nClaire Moynehan\nFeelTru\nadmin@feeltru.com`,
    pdf_filename: 'gp_letter_PT-00378_2026-04-10T103000Z.pdf',
    postmark_message_id: 'postmark-msg-gpl001',
    sent_by_user_id: 'user_qadir',
    byte_size: 48392,
    anchor_order_id: null,
    auto_triggered: false,
  },
  // GPL-002: feeltru — owed (consented, awaiting send)
  {
    id: 'GPL-002',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    template_id: 'TMPL-002',
    subject: 'Dose escalation notification — Sarah Cookland',
    body: `Dear Dr. Williams,

I am writing to inform you of a dose adjustment for your patient Sarah Cookland, currently under the care of FeelTru.

Full clinical details are in the attached formal letter.

Kind regards,
Claire Moynehan
FeelTru
admin@feeltru.com`,
    lifecycle_status: 'owed',
    status: 'draft',
    patient_consent_verified: true,
    sent_at: null,
    sent_to_email: null,
    created_by_user_id: 'user_qadir',
    created_at: '2026-05-10T14:00:00Z',
    cancel_reason: null,
    email_body_sent: null,
    pdf_filename: null,
    postmark_message_id: null,
    sent_by_user_id: null,
    byte_size: null,
    anchor_order_id: 'ORD-00441',
    auto_triggered: true,
  },
  // GPL-003: feeltru — awaiting_consent
  {
    id: 'GPL-003',
    clinic_id: 'feeltru',
    patient_id: 'PT-00445',
    template_id: 'TMPL-004',
    subject: 'Adverse event notification — Fiona MacLeod',
    body: `Dear Dr. Singh,

URGENT: I am writing regarding an adverse event experienced by your patient Fiona MacLeod while under the care of FeelTru.

Please review the attached formal letter at your earliest convenience.

Kind regards,
Claire Moynehan
FeelTru
admin@feeltru.com`,
    lifecycle_status: 'awaiting_consent',
    status: 'draft',
    patient_consent_verified: false,
    sent_at: null,
    sent_to_email: null,
    created_by_user_id: 'user_qadir',
    created_at: '2026-05-11T07:30:00Z',
    cancel_reason: null,
    email_body_sent: null,
    pdf_filename: null,
    postmark_message_id: null,
    sent_by_user_id: null,
    byte_size: null,
    anchor_order_id: null,
    auto_triggered: false,
  },
  // GPL-004: vsc — sent (workflow letter)
  {
    id: 'GPL-004',
    clinic_id: 'vsc',
    patient_id: 'PT-00234',
    template_id: 'TMPL-005',
    subject: 'Progress update — James Hartley',
    body: `Dear Dr. Khan,

I am writing to provide a progress update for your patient James Hartley, currently under the care of VSC Health.

Full clinical details are in the attached formal letter.

Kind regards,
Claire Moynehan
VSC Health
admin@vsc.com`,
    lifecycle_status: 'sent',
    status: 'sent',
    patient_consent_verified: true,
    sent_at: '2026-05-08T09:00:00Z',
    sent_to_email: 'dr.khan@mancgp.nhs.uk',
    created_by_user_id: 'user_vsc_admin',
    created_at: '2026-05-08T08:30:00Z',
    cancel_reason: null,
    email_body_sent: `Dear Dr. Khan,\n\nI am writing to provide a progress update for your patient James Hartley, currently under the care of VSC Health.\n\nFull clinical details are in the attached formal letter.\n\nKind regards,\nClaire Moynehan\nVSC Health\nadmin@vsc.com`,
    pdf_filename: 'gp_letter_PT-00234_2026-05-08T090000Z.pdf',
    postmark_message_id: 'postmark-msg-gpl004',
    sent_by_user_id: 'user_vsc_admin',
    byte_size: 51204,
    anchor_order_id: null,
    auto_triggered: false,
  },
  // GPL-005: feeltru — cancelled (terminal state seed)
  {
    id: 'GPL-005',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    template_id: 'TMPL-003',
    subject: 'Treatment cessation notification — Sarah Cookland',
    body: '',
    lifecycle_status: 'cancelled',
    status: 'draft',
    patient_consent_verified: true,
    sent_at: null,
    sent_to_email: null,
    created_by_user_id: 'user_qadir',
    created_at: '2026-04-15T11:00:00Z',
    cancel_reason: 'Patient requested that no GP correspondence be sent at this time. Verbal confirmation received and documented. Revisit at next clinical review.',
    email_body_sent: null,
    pdf_filename: null,
    postmark_message_id: null,
    sent_by_user_id: null,
    byte_size: null,
    anchor_order_id: null,
    auto_triggered: false,
  },
  // GPL-006: feeltru — ad_hoc (dose change follow-up, not consent-triggered workflow)
  {
    id: 'GPL-006',
    clinic_id: 'feeltru',
    patient_id: 'PT-00378',
    template_id: 'TMPL-002',
    subject: 'Dose escalation notification — Zara Ahmed',
    body: `Dear Dr. Patel,

I am writing to inform you of a dose adjustment for your patient Zara Ahmed, currently under the care of FeelTru.

Full clinical details are in the attached formal letter.

Kind regards,
Claire Moynehan
FeelTru
admin@feeltru.com`,
    lifecycle_status: 'ad_hoc',
    status: 'draft',
    patient_consent_verified: true,
    sent_at: null,
    sent_to_email: null,
    created_by_user_id: 'user_qadir',
    created_at: '2026-05-05T09:00:00Z',
    cancel_reason: null,
    email_body_sent: null,
    pdf_filename: null,
    postmark_message_id: null,
    sent_by_user_id: null,
    byte_size: null,
    anchor_order_id: null,
    auto_triggered: false,
  },
];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listGPLetters(
  clinic_id: ClinicId,
  opts?: {
    patient_id?: string;
    status?: GPLetter['status'];
    lifecycle_status?: GPLetter['lifecycle_status'];
  },
): Promise<GPLetter[]> {
  await delay();
  let results = MOCK_GP_LETTERS.filter((g) => g.clinic_id === clinic_id);
  if (opts?.patient_id) results = results.filter((g) => g.patient_id === opts.patient_id);
  if (opts?.status) results = results.filter((g) => g.status === opts.status);
  if (opts?.lifecycle_status)
    results = results.filter((g) => g.lifecycle_status === opts.lifecycle_status);
  return results;
}

export async function getGPLetter(clinic_id: ClinicId, id: string): Promise<GPLetter> {
  await delay();
  const g = MOCK_GP_LETTERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!g) throw new APIError('NOT_FOUND', 'GP letter not found');
  return g;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * createGPLetter — creates a new GP letter record.
 *
 * DEC-22 trigger rule enforced here:
 *   - consent check uses GP_CONSENT_ID ('consent_gp') — see TODO comment at top of file.
 *   - "One workflow letter per patient lifetime" — if a prior workflow letter exists,
 *     subsequent creation sets lifecycle_status to 'ad_hoc' automatically.
 */
export async function createGPLetter(
  clinic_id: ClinicId,
  data: {
    patient_id: string;
    template_id?: string;
    subject?: string;
    body?: string;
    // CLARIFY-1 (Wave 5) — auto-trigger fields (passed by decideOrder on approval)
    anchor_order_id?: string;
    prescriber_id?: string;
    auto_triggered?: boolean;
  },
): Promise<GPLetter> {
  await delay(400);

  const patient = MOCK_PATIENTS.find(
    (p) => p.clinic_id === clinic_id && p.id === data.patient_id,
  );
  if (!patient) throw new APIError('NOT_FOUND', 'Patient not found');

  // DEC-22: consent check (case-sensitive exact match on consent_id)
  const consentVerified = patient.consents_given.some(
    (c) => c.consent_id === GP_CONSENT_ID,
  );

  // DEC-22: "one workflow letter per patient lifetime"
  const hasExistingWorkflowLetter = MOCK_GP_LETTERS.some(
    (l) =>
      l.clinic_id === clinic_id &&
      l.patient_id === data.patient_id &&
      (l.lifecycle_status === 'owed' ||
        l.lifecycle_status === 'sent' ||
        l.lifecycle_status === 'cancelled'),
  );

  let lifecycle_status: GPLetter['lifecycle_status'];
  if (!consentVerified) {
    lifecycle_status = 'awaiting_consent';
  } else if (hasExistingWorkflowLetter) {
    lifecycle_status = 'ad_hoc';
  } else {
    lifecycle_status = 'owed';
  }

  const letter: GPLetter = {
    id: `GPL-${String(MOCK_GP_LETTERS.length + 1).padStart(3, '0')}`,
    clinic_id,
    patient_id: data.patient_id,
    template_id: data.template_id ?? '',
    subject: data.subject ?? '',
    body: data.body ?? '',
    lifecycle_status,
    status: 'draft',
    patient_consent_verified: consentVerified,
    sent_at: null,
    sent_to_email: null,
    created_by_user_id: data.prescriber_id ?? CURRENT_USER.id,
    created_at: NOW,
    cancel_reason: null,
    email_body_sent: null,
    pdf_filename: null,
    postmark_message_id: null,
    sent_by_user_id: null,
    byte_size: null,
    anchor_order_id: data.anchor_order_id ?? null,
    auto_triggered: data.auto_triggered ?? false,
  };

  MOCK_GP_LETTERS.push(letter);

  console.log('[AUDIT]', {
    event_type: 'gp_letter_created',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    letter_id: letter.id,
    patient_id: data.patient_id,
    clinic_id,
    lifecycle_status,
    timestamp: NOW,
  });

  return letter;
}

/**
 * sendGPLetter — transitions letter from owed/draft → sent.
 * Called after PDF generation and Postmark send complete (BLD-7.3/7.4).
 * Callers pass audit payload from the Postmark response.
 */
export async function sendGPLetter(
  clinic_id: ClinicId,
  id: string,
  auditPayload?: {
    email_body_sent: string;
    pdf_filename: string;
    postmark_message_id: string | null;
    byte_size: number;
  },
): Promise<GPLetter> {
  await delay(600);

  const g = MOCK_GP_LETTERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!g) {
    console.log('[AUDIT]', {
      event_type: 'gp_letter_sent',
      outcome: 'not_found',
      clinic_id,
      letter_id: id,
      actor_id: CURRENT_USER.id,
      timestamp: NOW,
    });
    throw new APIError('NOT_FOUND', 'GP letter not found');
  }

  if (g.lifecycle_status === 'cancelled') {
    // Layer 2 — server gate: cancelled is terminal
    console.log('[AUDIT]', {
      event_type: 'gp_letter_sent',
      outcome: 'safety_violation',
      reason: 'cancelled_letter_is_terminal',
      clinic_id,
      letter_id: id,
      actor_id: CURRENT_USER.id,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Cancelled letters cannot be sent');
  }

  if (!g.patient_consent_verified) {
    console.log('[AUDIT]', {
      event_type: 'gp_letter_sent',
      outcome: 'consent_violation',
      clinic_id,
      letter_id: id,
      actor_id: CURRENT_USER.id,
      timestamp: NOW,
    });
    throw new APIError('CONSENT_VIOLATION', 'Patient has not consented to GP communication');
  }

  const patient = MOCK_PATIENTS.find(
    (p) => p.clinic_id === clinic_id && p.id === g.patient_id,
  );
  const gpEmail = patient?.gp?.email ?? null;
  if (!gpEmail) {
    console.log('[AUDIT]', {
      event_type: 'gp_letter_sent',
      outcome: 'no_gp_email',
      clinic_id,
      letter_id: id,
      actor_id: CURRENT_USER.id,
      timestamp: NOW,
    });
    throw new APIError('NO_GP_EMAIL', 'No GP email address on record for this patient');
  }

  const oldLifecycle = g.lifecycle_status;

  g.lifecycle_status = 'sent';
  g.status = 'sent';
  g.sent_at = NOW;
  g.sent_to_email = gpEmail;
  g.sent_by_user_id = CURRENT_USER.id;

  if (auditPayload) {
    g.email_body_sent = auditPayload.email_body_sent;
    g.pdf_filename = auditPayload.pdf_filename;
    g.postmark_message_id = auditPayload.postmark_message_id;
    g.byte_size = auditPayload.byte_size;
  }

  // Layer 3 — audit log (BLD-7.4)
  console.log('[AUDIT]', {
    event_type: 'gp_letter_sent',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    letter_id: id,
    clinic_id,
    old_lifecycle_status: oldLifecycle,
    new_lifecycle_status: 'sent',
    sent_to: gpEmail,
    pdf_filename: g.pdf_filename,
    postmark_message_id: g.postmark_message_id,
    byte_size: g.byte_size,
    timestamp: NOW,
  });

  return g;
}

/**
 * cancelGPLetter — terminal action. Cannot be reversed.
 * BLD-7.7: requires documented reason (min 20 chars enforced at UI layer).
 */
export async function cancelGPLetter(
  clinic_id: ClinicId,
  id: string,
  cancel_reason: string,
): Promise<GPLetter> {
  await delay(400);

  const g = MOCK_GP_LETTERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!g) throw new APIError('NOT_FOUND', 'GP letter not found');

  // Layer 2 — server gate: cancelled is terminal; sent cannot be cancelled
  if (g.lifecycle_status === 'cancelled') {
    console.log('[AUDIT]', {
      event_type: 'gp_letter_cancelled',
      outcome: 'safety_violation',
      reason: 'already_cancelled',
      clinic_id,
      letter_id: id,
      actor_id: CURRENT_USER.id,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Letter is already cancelled');
  }
  if (g.lifecycle_status === 'sent') {
    console.log('[AUDIT]', {
      event_type: 'gp_letter_cancelled',
      outcome: 'safety_violation',
      reason: 'sent_letter_cannot_be_cancelled',
      clinic_id,
      letter_id: id,
      actor_id: CURRENT_USER.id,
      timestamp: NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Sent letters cannot be cancelled');
  }

  const oldLifecycle = g.lifecycle_status;
  g.lifecycle_status = 'cancelled';
  g.cancel_reason = cancel_reason;

  // Layer 3 — audit log
  console.log('[AUDIT]', {
    event_type: 'gp_letter_cancelled',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    letter_id: id,
    clinic_id,
    old_lifecycle_status: oldLifecycle,
    new_lifecycle_status: 'cancelled',
    cancel_reason,
    timestamp: NOW,
  });
  void recordAudit({
    clinic_id,
    actor: CURRENT_USER,
    entity: { type: 'gp_letter', id },
    event_type: 'gp_letter_cancelled',
    summary: `GP letter ${id} cancelled by ${CURRENT_USER.full_name}.`,
    before: { lifecycle_status: oldLifecycle },
    after: { lifecycle_status: 'cancelled', cancel_reason },
  });

  return g;
}
