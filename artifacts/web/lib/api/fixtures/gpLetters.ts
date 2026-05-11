/**
 * Livera GP letter fixtures — extracted from mock.ts (Mini-wave 6a cleanup).
 * Contains: MOCK_GP_LETTER_TEMPLATES, MOCK_GP_LETTERS, all GP letter endpoints.
 */

import type { ClinicId, GPLetter, GPLetterTemplate } from '../types';
import { delay, APIError, scopedToClinic, CURRENT_USER } from '../constants';
import { MOCK_PATIENTS } from './patients';

export const MOCK_GP_LETTER_TEMPLATES: GPLetterTemplate[] = [
  {
    id: 'TMPL-001',
    name: 'Treatment commencement notification',
    body_template: `Dear {{gp_name}},

I am writing to notify you that your patient {{patient_name}} has commenced treatment with our clinic.

They have been prescribed {{medication}} at {{dose}} following a comprehensive clinical assessment. We have reviewed their medical history and ensured this treatment is appropriate.

Please do not hesitate to contact us if you have any concerns or require further clinical information.

Kind regards,
The Clinical Team
{{clinic_name}}
{{clinic_email}}`,
  },
  {
    id: 'TMPL-002',
    name: 'Dose escalation notification',
    body_template: `Dear {{gp_name}},

I am writing to inform you that we have escalated the dose of {{medication}} for your patient {{patient_name}}.

Following clinical review, the dose has been increased to {{dose}}. The patient is tolerating treatment well and has been counselled regarding the change.

We will continue to monitor and will keep you informed of any further changes.

Kind regards,
The Clinical Team
{{clinic_name}}
{{clinic_email}}`,
  },
  {
    id: 'TMPL-003',
    name: 'Treatment cessation notification',
    body_template: `Dear {{gp_name}},

I am writing to inform you that your patient {{patient_name}} has discontinued treatment with our clinic.

Treatment with {{medication}} has been stopped. The patient has been advised to follow up with your practice if they wish to explore further weight management options.

Please update your records accordingly.

Kind regards,
The Clinical Team
{{clinic_name}}
{{clinic_email}}`,
  },
  {
    id: 'TMPL-004',
    name: 'Adverse event notification',
    body_template: `Dear {{gp_name}},

I am writing urgently to notify you of an adverse event experienced by your patient {{patient_name}} during treatment with {{medication}} at {{dose}}.

The patient has reported [adverse event details]. We have taken the following actions: [actions taken].

We would recommend a clinical review at your earliest convenience. A Yellow Card report has been / is being submitted to the MHRA.

Kind regards,
The Clinical Team
{{clinic_name}}
{{clinic_email}}`,
  },
  {
    id: 'TMPL-005',
    name: 'Progress update',
    body_template: `Dear {{gp_name}},

Please find below a progress update for your patient {{patient_name}}, who is currently under our care for weight management.

Current medication: {{medication}} at {{dose}}
Treatment duration: [duration]
Weight change: [weight change]
Tolerability: [tolerability notes]

We are satisfied with the patient's progress and plan to continue treatment. Please contact us if you have any questions.

Kind regards,
The Clinical Team
{{clinic_name}}
{{clinic_email}}`,
  },
];

export const MOCK_GP_LETTERS: GPLetter[] = [
  {
    id: 'GPL-001',
    clinic_id: 'feeltru',
    patient_id: 'PT-00378',
    template_id: 'TMPL-001',
    subject: 'Treatment commencement notification — Zara Ahmed',
    body: `Dear Dr. Patel,

I am writing to notify you that your patient Zara Ahmed has commenced treatment with our clinic.

They have been prescribed Mounjaro (tirzepatide) at 2.5mg weekly following a comprehensive clinical assessment. We have reviewed their medical history and ensured this treatment is appropriate.

Please do not hesitate to contact us if you have any concerns or require further clinical information.

Kind regards,
The Clinical Team
FeelTru
admin@feeltru.com`,
    status: 'delivered',
    patient_consent_verified: true,
    sent_at: '2026-04-10T10:30:00Z',
    sent_to_email: 'dr.patel@holborngp.nhs.uk',
    created_by_user_id: 'user_qadir',
    created_at: '2026-04-10T10:00:00Z',
  },
  {
    id: 'GPL-002',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    template_id: 'TMPL-002',
    subject: 'Dose escalation notification — Sarah Cookland',
    body: `Dear Dr. Williams,

I am writing to inform you that we have escalated the dose of Mounjaro (tirzepatide) for your patient Sarah Cookland.

Following clinical review, the dose has been increased to 7.5mg weekly. The patient is tolerating treatment well and has been counselled regarding the change.

We will continue to monitor and will keep you informed of any further changes.

Kind regards,
The Clinical Team
FeelTru
admin@feeltru.com`,
    status: 'draft',
    patient_consent_verified: true,
    sent_at: null,
    sent_to_email: null,
    created_by_user_id: 'user_qadir',
    created_at: '2026-05-10T14:00:00Z',
  },
  {
    id: 'GPL-003',
    clinic_id: 'feeltru',
    patient_id: 'PT-00445',
    template_id: 'TMPL-004',
    subject: 'Adverse event notification — Fiona MacLeod',
    body: `Dear Dr. Singh,

I am writing urgently to notify you of an adverse event experienced by your patient Fiona MacLeod during treatment with Mounjaro (tirzepatide) at 5mg weekly.

The patient has reported severe nausea, fatigue and hair thinning. We have taken the following actions: dose held, safety review initiated, patient contacted.

We would recommend a clinical review at your earliest convenience.

Kind regards,
The Clinical Team
FeelTru
admin@feeltru.com`,
    status: 'draft',
    patient_consent_verified: false,
    sent_at: null,
    sent_to_email: null,
    created_by_user_id: 'user_qadir',
    created_at: '2026-05-11T07:30:00Z',
  },
  {
    id: 'GPL-004',
    clinic_id: 'vsc',
    patient_id: 'PT-00234',
    template_id: 'TMPL-005',
    subject: 'Progress update — James Hartley',
    body: `Dear Dr. Khan,

Please find below a progress update for your patient James Hartley, who is currently under our care for weight management.

Current medication: Mounjaro (tirzepatide) at 5mg weekly
Treatment duration: 3 months
Weight change: -8.2kg
Tolerability: Good, mild nausea initially, now resolved

We are satisfied with the patient's progress and plan to continue treatment.

Kind regards,
The Clinical Team
VSC Health
admin@vsc.com`,
    status: 'sent',
    patient_consent_verified: true,
    sent_at: '2026-05-08T09:00:00Z',
    sent_to_email: 'dr.khan@mancgp.nhs.uk',
    created_by_user_id: 'user_vsc_admin',
    created_at: '2026-05-08T08:30:00Z',
  },
];

export async function listGPLetters(
  clinic_id: ClinicId,
  opts?: { patient_id?: string; status?: GPLetter['status'] }
): Promise<GPLetter[]> {
  await delay();
  let results = scopedToClinic(MOCK_GP_LETTERS, clinic_id);
  if (opts?.patient_id) results = results.filter((g) => g.patient_id === opts.patient_id);
  if (opts?.status) results = results.filter((g) => g.status === opts.status);
  return results;
}

export async function getGPLetter(clinic_id: ClinicId, id: string): Promise<GPLetter> {
  await delay();
  const g = MOCK_GP_LETTERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!g) throw new APIError('NOT_FOUND', 'GP letter not found');
  return g;
}

export async function createGPLetter(
  clinic_id: ClinicId,
  data: { patient_id: string; template_id: string; subject: string; body: string }
): Promise<GPLetter> {
  await delay(400);
  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === data.patient_id);
  if (!patient) throw new APIError('NOT_FOUND', 'Patient not found');
  const consentVerified = patient.consents_given.some((c) => c.consent_id === 'consent_gp');
  const letter: GPLetter = {
    id: `GPL-${String(MOCK_GP_LETTERS.length + 1).padStart(3, '0')}`,
    clinic_id,
    patient_id: data.patient_id,
    template_id: data.template_id,
    subject: data.subject,
    body: data.body,
    status: 'draft',
    patient_consent_verified: consentVerified,
    sent_at: null,
    sent_to_email: null,
    created_by_user_id: CURRENT_USER.id,
    created_at: new Date().toISOString(),
  };
  MOCK_GP_LETTERS.push(letter);
  console.log('[AUDIT]', { action: 'gp_letter.created', letter_id: letter.id, patient_id: data.patient_id, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return letter;
}

export async function sendGPLetter(clinic_id: ClinicId, id: string): Promise<GPLetter> {
  await delay(600);
  const g = MOCK_GP_LETTERS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!g) {
    console.log('[AUDIT]', { event_type: 'gp_letter_send_result', outcome: 'not_found', clinic_id, letter_id: id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
    throw new APIError('NOT_FOUND', 'GP letter not found');
  }
  if (g.status !== 'draft') {
    console.log('[AUDIT]', { event_type: 'gp_letter_send_result', outcome: 'invalid_state', clinic_id, letter_id: id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
    throw new APIError('INVALID_STATE', 'Letter is not in draft status');
  }
  if (!g.patient_consent_verified) {
    console.log('[AUDIT]', { event_type: 'gp_letter_send_result', outcome: 'consent_violation', clinic_id, letter_id: id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
    throw new APIError('CONSENT_VIOLATION', 'Patient has not consented to GP communication');
  }
  const patient = MOCK_PATIENTS.find((p) => p.clinic_id === clinic_id && p.id === g.patient_id);
  const gpEmail = patient?.gp?.email ?? null;
  if (!gpEmail) {
    console.log('[AUDIT]', { event_type: 'gp_letter_send_result', outcome: 'no_gp_email', clinic_id, letter_id: id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
    throw new APIError('NO_GP_EMAIL', 'No GP email address on record for this patient');
  }
  g.status = 'sent';
  g.sent_at = new Date().toISOString();
  g.sent_to_email = gpEmail;
  console.log('[AUDIT]', { action: 'gp_letter.sent', letter_id: id, sent_to: gpEmail, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return g;
}

export async function listGPLetterTemplates(): Promise<GPLetterTemplate[]> {
  await delay(100);
  return MOCK_GP_LETTER_TEMPLATES;
}
