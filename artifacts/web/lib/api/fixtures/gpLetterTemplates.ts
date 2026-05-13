/**
 * Livera GP Letter Template fixtures — BLD-7.1 / BLD-7.6 (Wave 5).
 *
 * Extracted from gpLetters.ts (previously MOCK_GP_LETTER_TEMPLATES with single body_template).
 * BLD-7.1: split into email_body_template (brief intro) + pdf_letter_template (full clinical).
 *
 * Supported {{variables}} for substitution:
 *   {{patient_name}}, {{patient_dob}}, {{patient_address}},
 *   {{gp_name}}, {{gp_surgery}}, {{clinic_name}}, {{prescriber_name}},
 *   {{order_summary}}, {{medication}}, {{dose}},
 *   {{clinic_email}}, {{clinic_phone}}, {{today_date}}
 *
 * CRUD functions used by BLD-7.6 Settings editor.
 * 3-layer safety chain on create/update/delete.
 */

import type { ClinicId, GPLetterTemplate } from '../types';
import { NOW, delay, APIError, CURRENT_USER } from '../constants';
import { can } from '@/lib/permissions';

export const MOCK_GP_LETTER_TEMPLATES: GPLetterTemplate[] = [
  {
    id: 'TMPL-001',
    clinic_id: 'shared',
    name: 'Treatment commencement notification',
    description:
      'Sent when a patient begins treatment for the first time. Covers medication, dose, and clinical rationale.',
    category: 'initial_treatment',
    email_body_template: `Dear {{gp_name}},

I am writing to notify you that your patient {{patient_name}} has commenced treatment with {{clinic_name}}.

Please find the full clinical details in the attached formal letter.

Kind regards,
{{prescriber_name}}
{{clinic_name}}
{{clinic_email}}`,
    pdf_letter_template: `{{clinic_name}}
{{clinic_email}} | {{clinic_phone}}

{{today_date}}

Dear {{gp_name}},
{{gp_surgery}}

Re: {{patient_name}} | DOB: {{patient_dob}}
    {{patient_address}}

TREATMENT COMMENCEMENT NOTIFICATION

I am writing to notify you that your patient {{patient_name}} has commenced treatment with {{clinic_name}}.

Following a comprehensive clinical assessment, {{patient_name}} has been prescribed {{medication}} at {{dose}}.

We have reviewed their medical history and are satisfied that this treatment is clinically appropriate. The patient has been fully counselled regarding the medication, expected benefits, potential side effects, and monitoring requirements.

We will continue to monitor the patient's progress and will keep you informed of any clinically significant changes.

Please do not hesitate to contact us if you have any concerns or require further clinical information.

Yours sincerely,

{{prescriber_name}}
{{clinic_name}}`,
  },
  {
    id: 'TMPL-002',
    clinic_id: 'shared',
    name: 'Dose escalation notification',
    description:
      "Sent when a patient's medication dose is increased following clinical review.",
    category: 'dose_change',
    email_body_template: `Dear {{gp_name}},

I am writing to inform you of a dose adjustment for your patient {{patient_name}}, currently under the care of {{clinic_name}}.

Full clinical details are in the attached formal letter.

Kind regards,
{{prescriber_name}}
{{clinic_name}}
{{clinic_email}}`,
    pdf_letter_template: `{{clinic_name}}
{{clinic_email}} | {{clinic_phone}}

{{today_date}}

Dear {{gp_name}},
{{gp_surgery}}

Re: {{patient_name}} | DOB: {{patient_dob}}
    {{patient_address}}

DOSE ESCALATION NOTIFICATION

I am writing to inform you that we have reviewed and escalated the dose of {{medication}} for your patient {{patient_name}}.

Following clinical review, the dose has been increased to {{dose}}. The patient is tolerating treatment well and has been counselled regarding the dose change, including updated side effect profile and monitoring requirements.

We will continue to monitor and will keep you informed of any further clinically significant changes.

Please do not hesitate to contact us if you have any concerns.

Yours sincerely,

{{prescriber_name}}
{{clinic_name}}`,
  },
  {
    id: 'TMPL-003',
    clinic_id: 'shared',
    name: 'Treatment cessation notification',
    description: 'Sent when a patient discontinues treatment.',
    category: 'dose_change',
    email_body_template: `Dear {{gp_name}},

I am writing to notify you of the cessation of treatment for your patient {{patient_name}} at {{clinic_name}}.

Full details are contained in the attached formal letter.

Kind regards,
{{prescriber_name}}
{{clinic_name}}
{{clinic_email}}`,
    pdf_letter_template: `{{clinic_name}}
{{clinic_email}} | {{clinic_phone}}

{{today_date}}

Dear {{gp_name}},
{{gp_surgery}}

Re: {{patient_name}} | DOB: {{patient_dob}}
    {{patient_address}}

TREATMENT CESSATION NOTIFICATION

I am writing to inform you that your patient {{patient_name}} has discontinued treatment with {{medication}} at {{clinic_name}}.

{{order_summary}}

The patient has been advised to follow up with your practice if they wish to explore further weight management options. We recommend a clinical review at your practice to discuss ongoing care planning.

Please update your records accordingly.

Yours sincerely,

{{prescriber_name}}
{{clinic_name}}`,
  },
  {
    id: 'TMPL-004',
    clinic_id: 'shared',
    name: 'Adverse event notification',
    description:
      'Urgent notification of an adverse event experienced by a patient during treatment.',
    category: 'safeguarding',
    email_body_template: `Dear {{gp_name}},

URGENT: I am writing regarding an adverse event experienced by your patient {{patient_name}} while under the care of {{clinic_name}}.

Please review the attached formal letter at your earliest convenience.

Kind regards,
{{prescriber_name}}
{{clinic_name}}
{{clinic_email}}`,
    pdf_letter_template: `{{clinic_name}}
{{clinic_email}} | {{clinic_phone}}

{{today_date}}

Dear {{gp_name}},
{{gp_surgery}}

Re: {{patient_name}} | DOB: {{patient_dob}}
    {{patient_address}}

ADVERSE EVENT NOTIFICATION — URGENT

I am writing urgently to notify you of an adverse event experienced by your patient {{patient_name}} during treatment with {{medication}} at {{dose}} with {{clinic_name}}.

{{order_summary}}

We would recommend a clinical review at your earliest convenience. A Yellow Card report has been submitted / is being submitted to the MHRA where appropriate.

We have placed the patient's prescription on hold pending further review and have made direct contact with the patient.

Please do not hesitate to contact us urgently if you have any clinical concerns.

Yours sincerely,

{{prescriber_name}}
{{clinic_name}}`,
  },
  {
    id: 'TMPL-005',
    clinic_id: 'shared',
    name: 'Progress update',
    description: "Periodic update on patient progress for the GP's records.",
    category: 'progress_update',
    email_body_template: `Dear {{gp_name}},

I am writing to provide a progress update for your patient {{patient_name}}, currently under the care of {{clinic_name}}.

Full clinical details are in the attached formal letter.

Kind regards,
{{prescriber_name}}
{{clinic_name}}
{{clinic_email}}`,
    pdf_letter_template: `{{clinic_name}}
{{clinic_email}} | {{clinic_phone}}

{{today_date}}

Dear {{gp_name}},
{{gp_surgery}}

Re: {{patient_name}} | DOB: {{patient_dob}}
    {{patient_address}}

PATIENT PROGRESS UPDATE

I am writing to provide a progress update for your patient {{patient_name}}, who is currently under our care for weight management at {{clinic_name}}.

{{order_summary}}

Current medication: {{medication}} at {{dose}}.

We are satisfied with the patient's progress and intend to continue treatment under ongoing clinical review. Please contact us if you have any questions or wish to discuss the patient's care.

Yours sincerely,

{{prescriber_name}}
{{clinic_name}}`,
  },
];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listGPLetterTemplates(
  clinic_id?: ClinicId,
): Promise<GPLetterTemplate[]> {
  await delay(100);
  if (!clinic_id) return MOCK_GP_LETTER_TEMPLATES;
  return MOCK_GP_LETTER_TEMPLATES.filter(
    (t) => t.clinic_id === clinic_id || t.clinic_id === 'shared',
  );
}

export async function getGPLetterTemplate(id: string): Promise<GPLetterTemplate> {
  await delay(100);
  const t = MOCK_GP_LETTER_TEMPLATES.find((x) => x.id === id);
  if (!t) throw new APIError('NOT_FOUND', 'GP letter template not found');
  return t;
}

// ---------------------------------------------------------------------------
// Mutations (3-layer safety chain) — BLD-7.6 Settings editor
// ---------------------------------------------------------------------------

export async function createGPLetterTemplate(
  clinic_id: ClinicId,
  data: Omit<GPLetterTemplate, 'id' | 'clinic_id'>,
): Promise<GPLetterTemplate> {
  await delay(400);

  // Layer 2 — server gate
  if (!can(CURRENT_USER, 'write', 'gp_letter_templates')) {
    console.log('[AUDIT]', {
      event_type: 'gp_letter_template_created',
      outcome: 'safety_violation',
      actor_id: CURRENT_USER.id,
      clinic_id,
      timestamp: NOW,
    });
    throw new APIError(
      'SAFETY_VIOLATION',
      'Insufficient permissions to create GP letter template',
    );
  }

  const template: GPLetterTemplate = {
    id: `TMPL-${String(MOCK_GP_LETTER_TEMPLATES.length + 1).padStart(3, '0')}`,
    clinic_id,
    ...data,
  };
  MOCK_GP_LETTER_TEMPLATES.push(template);

  // Layer 3 — audit log
  console.log('[AUDIT]', {
    event_type: 'gp_letter_template_created',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    template_id: template.id,
    clinic_id,
    timestamp: NOW,
  });
  return template;
}

export async function updateGPLetterTemplate(
  id: string,
  data: Partial<Omit<GPLetterTemplate, 'id' | 'clinic_id'>>,
): Promise<GPLetterTemplate> {
  await delay(300);

  // Layer 2 — server gate
  if (!can(CURRENT_USER, 'write', 'gp_letter_templates')) {
    console.log('[AUDIT]', {
      event_type: 'gp_letter_template_updated',
      outcome: 'safety_violation',
      actor_id: CURRENT_USER.id,
      template_id: id,
      timestamp: NOW,
    });
    throw new APIError(
      'SAFETY_VIOLATION',
      'Insufficient permissions to update GP letter template',
    );
  }

  const t = MOCK_GP_LETTER_TEMPLATES.find((x) => x.id === id);
  if (!t) throw new APIError('NOT_FOUND', 'GP letter template not found');

  Object.assign(t, data);

  // Layer 3 — audit log
  console.log('[AUDIT]', {
    event_type: 'gp_letter_template_updated',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    template_id: id,
    timestamp: NOW,
  });
  return t;
}

export async function deleteGPLetterTemplate(id: string): Promise<void> {
  await delay(300);

  // Layer 2 — server gate
  if (!can(CURRENT_USER, 'write', 'gp_letter_templates')) {
    console.log('[AUDIT]', {
      event_type: 'gp_letter_template_deleted',
      outcome: 'safety_violation',
      actor_id: CURRENT_USER.id,
      template_id: id,
      timestamp: NOW,
    });
    throw new APIError(
      'SAFETY_VIOLATION',
      'Insufficient permissions to delete GP letter template',
    );
  }

  const idx = MOCK_GP_LETTER_TEMPLATES.findIndex((x) => x.id === id);
  if (idx === -1) throw new APIError('NOT_FOUND', 'GP letter template not found');
  MOCK_GP_LETTER_TEMPLATES.splice(idx, 1);

  // Layer 3 — audit log
  console.log('[AUDIT]', {
    event_type: 'gp_letter_template_deleted',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    template_id: id,
    timestamp: NOW,
  });
}
