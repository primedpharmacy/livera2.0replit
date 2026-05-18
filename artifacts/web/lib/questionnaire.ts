import type { QuestionItem, SafetyCategory } from "@/types";

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
 * Per-order summary of unresolved questionnaire issues — safety-flagged "yes"
 * answers plus required questions the patient hasn't answered. Used by the
 * Orders list to surface a one-glance badge so triagers know which rows still
 * need a clinician's eye before opening them.
 */
export type UnresolvedIssueCounts = {
  warn: number;     // safety-flagged "yes" answers
  missing: number;  // required questions left unanswered
  total: number;
};

export function countUnresolvedIssues(
  questionConfig: QuestionItem[] | undefined,
  responses: Record<string, unknown> | undefined,
): UnresolvedIssueCounts {
  if (!questionConfig || !responses) return { warn: 0, missing: 0, total: 0 };
  let warn = 0;
  let missing = 0;
  for (const q of questionConfig) {
    const val = responses[q.id];
    const answered = val !== undefined && val !== null && val !== "";
    if (!answered) {
      if (q.required) missing++;
    } else if (qFlag(q, val) === "warn") {
      warn++;
    }
  }
  return { warn, missing, total: warn + missing };
}

/**
 * A single safety-flagged answer surfaced on the Clinical Check queue popover.
 * Lets clinicians see *which* questions were flagged + the patient's literal
 * answer without having to open the slide-over.
 *
 * Task-168 — `category` lets the popover group long lists by clinical theme
 * (cardiac, mental health, safeguarding, …) so the highest-concern area is
 * spottable at a glance.
 */
export type FlaggedAnswer = {
  id: string;
  label: string;
  answer: string;
  category: SafetyCategory;
};

// ── Safety category metadata ─────────────────────────────────────────────────
// Display label + colour-coded pill classes used both in the questionnaire
// builder (category chip) and the Clinical Check popover (grouped headings).
// Colours mirror the existing FLAG_COLORS palette on OrderListTable so the
// popover groupings feel consistent with the row-level flag pills.
export const SAFETY_CATEGORY_META: Record<
  SafetyCategory,
  { label: string; pillCls: string; dotCls: string }
> = {
  cardiac: {
    label: "Cardiac",
    pillCls: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
    dotCls: "bg-[#b91c1c]",
  },
  mental_health: {
    label: "Mental health",
    pillCls: "bg-[#fdf4ff] text-[#7e22ce] border-[#e9d5ff]",
    dotCls: "bg-[#7e22ce]",
  },
  safeguarding: {
    label: "Safeguarding",
    pillCls: "bg-[#fef2f2] text-[#991b1b] border-[#fca5a5]",
    dotCls: "bg-[#991b1b]",
  },
  allergy: {
    label: "Allergy",
    pillCls: "bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]",
    dotCls: "bg-[#c2410c]",
  },
  pregnancy: {
    label: "Pregnancy",
    pillCls: "bg-[#fdf2f8] text-[#be185d] border-[#fbcfe8]",
    dotCls: "bg-[#be185d]",
  },
  medication: {
    label: "Medication",
    pillCls: "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]",
    dotCls: "bg-[#1d4ed8]",
  },
  other: {
    label: "Other",
    pillCls: "bg-[#f9fafb] text-[#374151] border-[#d1d5db]",
    dotCls: "bg-[#6b7280]",
  },
};

export const SAFETY_CATEGORIES: SafetyCategory[] = [
  "cardiac",
  "mental_health",
  "safeguarding",
  "allergy",
  "pregnancy",
  "medication",
  "other",
];

// Keyword → category mapping used to *infer* a category for safety questions
// authored before Task-168 (no `safety_category` set). Order matters: the
// first matching keyword wins, so list more specific phrases before broad ones.
const CATEGORY_KEYWORD_MAP: ReadonlyArray<{ keyword: string; category: SafetyCategory }> = [
  // Cardiac
  { keyword: "cardiac",         category: "cardiac" },
  { keyword: "heart attack",    category: "cardiac" },
  { keyword: "heart",           category: "cardiac" },
  { keyword: "chest pain",      category: "cardiac" },
  { keyword: "stroke",          category: "cardiac" },
  { keyword: "blood pressure",  category: "cardiac" },
  { keyword: "hypertension",    category: "cardiac" },
  // Mental health
  { keyword: "mental health",   category: "mental_health" },
  { keyword: "depression",      category: "mental_health" },
  { keyword: "anxiety",         category: "mental_health" },
  { keyword: "suicidal",        category: "mental_health" },
  { keyword: "self-harm",       category: "mental_health" },
  { keyword: "self harm",       category: "mental_health" },
  { keyword: "eating disorder", category: "mental_health" },
  { keyword: "anorexia",        category: "mental_health" },
  { keyword: "bulimia",         category: "mental_health" },
  // Safeguarding
  { keyword: "safeguarding",    category: "safeguarding" },
  { keyword: "abuse",           category: "safeguarding" },
  { keyword: "coercion",        category: "safeguarding" },
  // Allergy
  { keyword: "allergy",         category: "allergy" },
  { keyword: "allergic",        category: "allergy" },
  { keyword: "allergies",       category: "allergy" },
  // Pregnancy
  { keyword: "pregnant",        category: "pregnancy" },
  { keyword: "pregnancy",       category: "pregnancy" },
  { keyword: "breastfeeding",   category: "pregnancy" },
  // Medication
  { keyword: "medication",      category: "medication" },
  { keyword: "medicine",        category: "medication" },
  { keyword: "drug",            category: "medication" },
  { keyword: "side effect",     category: "medication" },
  { keyword: "side-effect",     category: "medication" },
  { keyword: "diagnosis",       category: "medication" },
  { keyword: "diagnoses",       category: "medication" },
  { keyword: "diagnosed",       category: "medication" },
];

/**
 * Returns the safety category for a question. Uses the explicit
 * `safety_category` if set; otherwise infers from the label keyword.
 * Falls back to "other" so every flagged answer has a group.
 */
export function resolveSafetyCategory(q: QuestionItem): SafetyCategory {
  if (q.safety_category) return q.safety_category;
  const lower = q.label.toLowerCase();
  for (const { keyword, category } of CATEGORY_KEYWORD_MAP) {
    if (lower.includes(keyword)) return category;
  }
  return "other";
}

/**
 * Returns the ordered list of safety-flagged yes_no questions the patient
 * answered "yes" to, with their labels, raw answers, and clinical category.
 * Used by the "N review needed" badge popover on the Clinical Check queue row.
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
      out.push({
        id: q.id,
        label: q.label,
        answer: String(val),
        category: resolveSafetyCategory(q),
      });
    }
  }
  return out;
}

/**
 * Groups flagged answers by their clinical category, preserving the category
 * priority order from SAFETY_CATEGORIES (most concerning themes first). Used
 * by the Clinical Check popover to keep long lists scannable.
 */
export function groupFlaggedAnswersByCategory(
  flagged: FlaggedAnswer[],
): Array<{ category: SafetyCategory; items: FlaggedAnswer[] }> {
  const buckets = new Map<SafetyCategory, FlaggedAnswer[]>();
  for (const f of flagged) {
    const arr = buckets.get(f.category) ?? [];
    arr.push(f);
    buckets.set(f.category, arr);
  }
  const groups: Array<{ category: SafetyCategory; items: FlaggedAnswer[] }> = [];
  for (const cat of SAFETY_CATEGORIES) {
    const items = buckets.get(cat);
    if (items && items.length > 0) groups.push({ category: cat, items });
  }
  return groups;
}
