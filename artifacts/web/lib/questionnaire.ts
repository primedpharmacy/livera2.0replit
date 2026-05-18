import type { QuestionItem } from "@/types";

/**
 * Returns the clinical "flag" status for a single questionnaire answer.
 *
 * Only yes_no questions explicitly marked as safety questions raise a "Review needed"
 * warning when answered "yes". Non-safety yes_no answers stay neutral so clinicians
 * aren't desensitised by warnings on informational questions.
 */
export function qFlag(q: QuestionItem, val: unknown): "ok" | "warn" | "neutral" {
  if (q.type !== "yes_no" || !q.safety_flag) return "neutral";
  const s = String(val).toLowerCase().trim();
  if (s === "no" || s === "false") return "ok";
  if (s === "yes" || s === "true") return "warn";
  return "neutral";
}

/**
 * Counts the number of safety-flagged yes_no questions on this questionnaire
 * that the patient answered "yes" to. Used to surface a "N review needed" badge
 * on the Clinical Check queue so prescribers can prioritise real safety concerns.
 */
export function countReviewNeeded(
  questionConfig: QuestionItem[] | undefined,
  responses: Record<string, unknown> | undefined,
): number {
  if (!questionConfig || !responses) return 0;
  let n = 0;
  for (const q of questionConfig) {
    if (qFlag(q, responses[q.id]) === "warn") n++;
  }
  return n;
}

/**
 * A single safety-flagged answer surfaced on the Clinical Check queue popover.
 * Lets clinicians see *which* questions were flagged + the patient's literal
 * answer without having to open the slide-over.
 */
export type FlaggedAnswer = {
  id: string;
  label: string;
  answer: string;
};

/**
 * Returns the ordered list of safety-flagged yes_no questions the patient
 * answered "yes" to, with their labels and raw answers. Used by the
 * "N review needed" badge popover on the Clinical Check queue row.
 */
export function listFlaggedAnswers(
  questionConfig: QuestionItem[] | undefined,
  responses: Record<string, unknown> | undefined,
): FlaggedAnswer[] {
  if (!questionConfig || !responses) return [];
  const out: FlaggedAnswer[] = [];
  for (const q of questionConfig) {
    const val = responses[q.id];
    if (qFlag(q, val) === "warn") {
      out.push({ id: q.id, label: q.label, answer: String(val) });
    }
  }
  return out;
}
