/**
 * Anthropic integration — BLD-6.2 (Wave 4).
 *
 * DEC-07: Model claude-sonnet-4-20250514.
 * Feature-flagged by LIVERA_AI_NOTE_DRAFTING_LIVE (default false).
 *
 * When false: returns a deterministic stub draft (no API call).
 * When true:  calls Anthropic API via Replit AI Integrations proxy.
 *
 * GOVERNANCE: BLD-6.5 system prompt sign-off MUST precede setting
 * LIVERA_AI_NOTE_DRAFTING_LIVE=true in production.
 */

import {
  AI_CLINICAL_NOTE_PROMPT_V1,
  AI_CLINICAL_NOTE_PROMPT_VERSION_ID,
  AI_CLINICAL_NOTE_DECLINE_CONTEXT,
  AI_CLINICAL_NOTE_INTERVENTION_CONTEXT,
} from '@/lib/ai/clinicalNotePrompt';

const AI_LIVE = process.env['LIVERA_AI_NOTE_DRAFTING_LIVE'] === 'true';

export type AIDraftContext = 'approve' | 'decline' | 'intervention';

export interface AIDraftInput {
  context: AIDraftContext;
  order_id: string;
  patient_summary: {
    full_name: string;
    age_years: number;
    sex_at_birth: string;
    bmi: number;
    weight_kg: number;
    baseline_weight_kg: number;
  };
  product: {
    medication: string;
    dose: string;
    type: 'new' | 'reorder';
  };
  questionnaire_summary: string;
  g6_flags: string[];
}

export interface AIDraftResult {
  draft: string;
  prompt_version_id: string;
  model: string;
  is_stub: boolean;
}

function buildStubDraft(input: AIDraftInput): string {
  const { patient_summary: p, product, order_id, context } = input;
  const weightChange = +(p.baseline_weight_kg - p.weight_kg).toFixed(1);
  const contextLabel =
    context === 'decline' ? 'DECLINE' :
    context === 'intervention' ? 'QUERY / INTERVENTION' :
    'APPROVAL';

  return `[AI DRAFT — STUB — ${contextLabel}]
Order: ${order_id} | ${product.type.toUpperCase()} ORDER

Patient: ${p.full_name}, ${p.age_years}y ${p.sex_at_birth}
BMI: ${p.bmi.toFixed(1)} | Weight: ${p.weight_kg}kg (${weightChange >= 0 ? '+' : ''}${weightChange}kg from baseline)
Product: ${product.medication} ${product.dose}
${input.g6_flags.length > 0 ? `Clinical flags: ${input.g6_flags.join(', ')}` : 'No active clinical flags.'}

Questionnaire summary: ${input.questionnaire_summary}

[PRESCRIBER TO COMPLETE — review above, edit as needed, then sign off]

This note was AI-drafted (development stub). Replace with real Anthropic output once LIVERA_AI_NOTE_DRAFTING_LIVE=true and BLD-6.5 prompt signed off.`;
}

/**
 * Generate an AI-drafted clinical note.
 * Returns stub draft when LIVERA_AI_NOTE_DRAFTING_LIVE=false.
 * Returns real Anthropic response when flag=true (post BLD-6.5 sign-off).
 */
export async function generateClinicalNoteDraft(input: AIDraftInput): Promise<AIDraftResult> {
  console.log('[AUDIT]', {
    event_type:      'ai_draft_requested',
    order_id:        input.order_id,
    context:         input.context,
    prompt_version:  AI_CLINICAL_NOTE_PROMPT_VERSION_ID,
    model:           'claude-sonnet-4-20250514',
    live:            AI_LIVE,
  });

  if (!AI_LIVE) {
    const draft = buildStubDraft(input);
    console.info('[ANTHROPIC]', `generateClinicalNoteDraft stub — order=${input.order_id} context=${input.context}`);
    return {
      draft,
      prompt_version_id: AI_CLINICAL_NOTE_PROMPT_VERSION_ID,
      model:             'claude-sonnet-4-20250514',
      is_stub:           true,
    };
  }

  // Real Anthropic call — BLOCKED until BLD-6.5 prompt signed off
  // Uses Replit AI Integrations proxy (see .local/skills/ai-integrations-anthropic/SKILL.md)
  const systemPrompt =
    input.context === 'decline'      ? AI_CLINICAL_NOTE_DECLINE_CONTEXT :
    input.context === 'intervention' ? AI_CLINICAL_NOTE_INTERVENTION_CONTEXT :
    AI_CLINICAL_NOTE_PROMPT_V1;

  const userMessage = `Patient: ${input.patient_summary.full_name}
Age: ${input.patient_summary.age_years}y | Sex: ${input.patient_summary.sex_at_birth}
BMI: ${input.patient_summary.bmi} | Weight: ${input.patient_summary.weight_kg}kg
Product: ${input.product.medication} ${input.product.dose} (${input.product.type})
Flags: ${input.g6_flags.join(', ') || 'none'}
Questionnaire: ${input.questionnaire_summary}`;

  // webpackIgnore: true — SDK is only present in the live server environment.
  // When LIVERA_AI_NOTE_DRAFTING_LIVE=false (default) this branch is never reached.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — @anthropic-ai/sdk is a runtime-only dep; not installed in dev
  const { default: Anthropic } = await import(/* webpackIgnore: true */ '@anthropic-ai/sdk');
  const client = new Anthropic({ baseURL: process.env['ANTHROPIC_BASE_URL'] });

  const message = await client.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userMessage }],
  });

  const draft = message.content[0]?.type === 'text' ? message.content[0].text : '[No content returned]';

  console.log('[AUDIT]', {
    event_type:      'ai_draft_generated',
    order_id:        input.order_id,
    prompt_version:  AI_CLINICAL_NOTE_PROMPT_VERSION_ID,
    draft_length:    draft.length,
    timestamp:       new Date().toISOString(),
  });

  return {
    draft,
    prompt_version_id: AI_CLINICAL_NOTE_PROMPT_VERSION_ID,
    model:             'claude-sonnet-4-20250514',
    is_stub:           false,
  };
}
