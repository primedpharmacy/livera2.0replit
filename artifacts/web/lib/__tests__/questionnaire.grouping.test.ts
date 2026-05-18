/**
 * Tests for Task-168 — grouping safety-flagged answers by clinical category
 * so the Clinical Check popover stays scannable for long lists.
 *
 * Locks in:
 *   1. resolveSafetyCategory respects an explicit safety_category and
 *      otherwise infers from common label keywords (drug allergies →
 *      allergy, side effects → medication, heart history → cardiac, …).
 *   2. listFlaggedAnswers stamps every flagged answer with a category.
 *   3. groupFlaggedAnswersByCategory preserves the canonical category
 *      priority order (cardiac → mental_health → safeguarding → … → other)
 *      and skips categories with no items.
 */

import { describe, it, expect } from "vitest";
import type { QuestionItem } from "@/types";
import {
  resolveSafetyCategory,
  listFlaggedAnswers,
  groupFlaggedAnswersByCategory,
} from "../questionnaire";

function q(overrides: Partial<QuestionItem> & { id: string; label: string }): QuestionItem {
  return {
    type: "yes_no",
    required: true,
    order: 1,
    safety_flag: true,
    ...overrides,
  };
}

describe("resolveSafetyCategory", () => {
  it("uses an explicit safety_category when set", () => {
    expect(resolveSafetyCategory(q({ id: "1", label: "anything", safety_category: "cardiac" })))
      .toBe("cardiac");
  });
  it("infers allergy from drug allergy labels", () => {
    expect(resolveSafetyCategory(q({ id: "1", label: "Do you have any drug allergies?" })))
      .toBe("allergy");
  });
  it("infers medication from side effects", () => {
    expect(resolveSafetyCategory(q({ id: "1", label: "Have you experienced any side effects?" })))
      .toBe("medication");
  });
  it("infers cardiac from heart history", () => {
    expect(resolveSafetyCategory(q({ id: "1", label: "Any history of heart problems?" })))
      .toBe("cardiac");
  });
  it("infers pregnancy from breastfeeding mention", () => {
    expect(resolveSafetyCategory(q({ id: "1", label: "Are you pregnant or breastfeeding?" })))
      .toBe("pregnancy");
  });
  it("infers mental_health from eating disorder mention", () => {
    expect(resolveSafetyCategory(q({ id: "1", label: "History of an eating disorder?" })))
      .toBe("mental_health");
  });
  it("infers safeguarding from safeguarding keyword", () => {
    expect(resolveSafetyCategory(q({ id: "1", label: "Any safeguarding concerns?" })))
      .toBe("safeguarding");
  });
  it("falls back to other when no keyword matches", () => {
    expect(resolveSafetyCategory(q({ id: "1", label: "Random unrelated question" })))
      .toBe("other");
  });
});

describe("listFlaggedAnswers stamps category", () => {
  it("returns flagged answers with their resolved category", () => {
    const config: QuestionItem[] = [
      q({ id: "a", label: "Do you have any drug allergies?" }),
      q({ id: "b", label: "Heart disease history?" }),
      q({ id: "c", label: "Random non-flagged question", safety_flag: false }),
    ];
    const flagged = listFlaggedAnswers(config, { a: "yes", b: "yes", c: "yes" });
    expect(flagged.map((f) => [f.id, f.category])).toEqual([
      ["a", "allergy"],
      ["b", "cardiac"],
    ]);
  });
});

describe("groupFlaggedAnswersByCategory", () => {
  it("groups by category in canonical priority order, skipping empty groups", () => {
    const config: QuestionItem[] = [
      q({ id: "ssr", label: "Any safeguarding concerns?" }),
      q({ id: "all", label: "Drug allergies?" }),
      q({ id: "med", label: "Other medications?" }),
      q({ id: "crd", label: "Heart problems?" }),
      q({ id: "all2", label: "Latex allergy?" }),
    ];
    const flagged = listFlaggedAnswers(config, {
      ssr: "yes", all: "yes", med: "yes", crd: "yes", all2: "yes",
    });
    const groups = groupFlaggedAnswersByCategory(flagged);
    expect(groups.map((g) => g.category)).toEqual([
      "cardiac",
      "safeguarding",
      "allergy",
      "medication",
    ]);
    expect(groups.find((g) => g.category === "allergy")?.items.map((i) => i.id))
      .toEqual(["all", "all2"]);
  });

  it("returns empty array for empty input", () => {
    expect(groupFlaggedAnswersByCategory([])).toEqual([]);
  });
});
