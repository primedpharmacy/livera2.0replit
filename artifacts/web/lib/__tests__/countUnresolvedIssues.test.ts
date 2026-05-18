/**
 * countUnresolvedIssues — Task-242.
 *
 * Pins the per-order issue summary surfaced as a one-glance badge on the
 * Orders list. The badge counts safety-flagged "yes" answers plus missing
 * required answers, so triagers can see at a glance which orders still need
 * a clinician's eye before opening them.
 */

import { describe, it, expect } from 'vitest';
import { countUnresolvedIssues } from '../questionnaire';
import type { QuestionItem } from '@/types';

const questions: QuestionItem[] = [
  { id: 'q_pregnant',        label: 'Are you pregnant?',         type: 'yes_no', required: true,  order: 1, safety_flag: true },
  { id: 'q_eating_disorder', label: 'History of eating disorder?', type: 'yes_no', required: true,  order: 2, safety_flag: true },
  { id: 'q_marketing_optin', label: 'Marketing opt-in?',         type: 'yes_no', required: false, order: 3, safety_flag: false },
  { id: 'q_weight',          label: 'Current weight (kg)',       type: 'number', required: true,  order: 4 },
  { id: 'q_notes',           label: 'Anything else?',            type: 'text',   required: false, order: 5 },
];

describe('countUnresolvedIssues — Task-242', () => {
  it('counts safety-flagged "yes" answers and missing required answers separately', () => {
    const out = countUnresolvedIssues(questions, {
      q_pregnant: 'yes',          // flagged
      q_eating_disorder: 'no',    // safe
      q_marketing_optin: 'yes',   // ignored — non-safety
      // q_weight missing — counts as missing required
      // q_notes missing — not required, ignored
    });
    expect(out).toEqual({ warn: 1, missing: 1, total: 2 });
  });

  it('reports zero issues when every required answer is provided and nothing is flagged', () => {
    const out = countUnresolvedIssues(questions, {
      q_pregnant: 'no',
      q_eating_disorder: 'no',
      q_weight: 92,
    });
    expect(out).toEqual({ warn: 0, missing: 0, total: 0 });
  });

  it('treats empty strings as missing for required questions', () => {
    const out = countUnresolvedIssues(questions, {
      q_pregnant: 'no',
      q_eating_disorder: 'no',
      q_weight: '',
    });
    expect(out).toEqual({ warn: 0, missing: 1, total: 1 });
  });

  it('returns zeros when config or responses are missing', () => {
    expect(countUnresolvedIssues(undefined, { q_weight: 92 })).toEqual({ warn: 0, missing: 0, total: 0 });
    expect(countUnresolvedIssues(questions, undefined)).toEqual({ warn: 0, missing: 0, total: 0 });
  });
});
