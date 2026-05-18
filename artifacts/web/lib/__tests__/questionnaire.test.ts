/**
 * listFlaggedAnswers — Task-169.
 *
 * Pins which questionnaire answers surface in the "N review needed" hover
 * popover on the Clinical Check queue:
 *   - Only yes_no questions with safety_flag=true and a literal "yes" answer
 *     are surfaced.
 *   - Non-safety yes_no questions are ignored even when answered "yes".
 *   - "no" / empty / missing answers are ignored.
 *   - Undefined config / responses degrade safely to an empty list.
 */

import { describe, it, expect } from 'vitest';
import { listFlaggedAnswers } from '../questionnaire';
import type { QuestionItem } from '@/types';

const questions: QuestionItem[] = [
  { id: 'q_pregnant', label: 'Are you pregnant?', type: 'yes_no', required: true, order: 1, safety_flag: true },
  { id: 'q_eating_disorder', label: 'History of eating disorder?', type: 'yes_no', required: true, order: 2, safety_flag: true },
  { id: 'q_marketing_optin', label: 'Marketing opt-in?', type: 'yes_no', required: false, order: 3, safety_flag: false },
  { id: 'q_weight', label: 'Current weight (kg)', type: 'number', required: true, order: 4 },
];

describe('listFlaggedAnswers — Task-169', () => {
  it('returns only safety-flagged yes_no questions answered "yes"', () => {
    const out = listFlaggedAnswers(questions, {
      q_pregnant: 'yes',
      q_eating_disorder: 'no',
      q_marketing_optin: 'yes',
      q_weight: 92,
    });
    expect(out).toEqual([
      { id: 'q_pregnant', label: 'Are you pregnant?', answer: 'yes', category: 'pregnancy' },
    ]);
  });

  it('ignores non-safety yes_no questions even when answered "yes"', () => {
    const out = listFlaggedAnswers(questions, { q_marketing_optin: 'yes' });
    expect(out).toEqual([]);
  });

  it('ignores "no", empty and missing answers on safety questions', () => {
    const out = listFlaggedAnswers(questions, {
      q_pregnant: 'no',
      q_eating_disorder: '',
      // q_marketing_optin not answered
    });
    expect(out).toEqual([]);
  });

  it('returns flagged answers in question-config order', () => {
    const out = listFlaggedAnswers(questions, {
      q_eating_disorder: 'yes',
      q_pregnant: 'yes',
    });
    expect(out.map((f) => f.id)).toEqual(['q_pregnant', 'q_eating_disorder']);
  });

  it('returns [] when config or responses are undefined', () => {
    expect(listFlaggedAnswers(undefined, { q_pregnant: 'yes' })).toEqual([]);
    expect(listFlaggedAnswers(questions, undefined)).toEqual([]);
    expect(listFlaggedAnswers(undefined, undefined)).toEqual([]);
  });
});
