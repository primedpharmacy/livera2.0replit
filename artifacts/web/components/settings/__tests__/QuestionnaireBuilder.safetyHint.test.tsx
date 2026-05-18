/**
 * Tests for the "Looks like a safety question — mark it?" hint in
 * the QuestionnaireBuilder row (BLD-13.4 follow-up — Task #84).
 *
 * Locks in three behaviours so future refactors of the keyword list or
 * QuestionRow component don't silently regress them:
 *   1. Keyword matcher returns the matched keyword for safety-ish labels
 *      and null otherwise.
 *   2. Hint appears for yes_no questions whose label contains a keyword,
 *      and clicking "Mark as safety" calls onToggleSafety. Once the
 *      parent flips safety_flag, the hint disappears.
 *   3. Clicking the dismiss (X) button hides the hint locally even though
 *      the underlying keyword still matches.
 *   4. Hint does not render for non-yes_no question types, nor when
 *      safety_flag is already true.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QuestionRow, matchesSafetyKeyword } from "../QuestionnaireBuilder";
import type { QuestionItem, QuestionType } from "@/types";

afterEach(() => cleanup());

function makeQuestion(overrides: Partial<QuestionItem> = {}): QuestionItem {
  return {
    id: "q1",
    label: "Sample question",
    type: "yes_no",
    required: false,
    order: 0,
    ...overrides,
  };
}

function renderRow(
  q: QuestionItem,
  handlers: Partial<{
    onMove: (idx: number, dir: "up" | "down") => void;
    onToggleRequired: (id: string) => void;
    onToggleSafety: (id: string) => void;
    onDelete: (id: string) => void;
  }> = {},
) {
  const onMove = handlers.onMove ?? vi.fn();
  const onToggleRequired = handlers.onToggleRequired ?? vi.fn();
  const onToggleSafety = handlers.onToggleSafety ?? vi.fn();
  const onDelete = handlers.onDelete ?? vi.fn();
  const utils = render(
    <QuestionRow
      q={q}
      idx={0}
      total={1}
      onMove={onMove}
      onToggleRequired={onToggleRequired}
      onToggleSafety={onToggleSafety}
      onDelete={onDelete}
    />,
  );
  return { ...utils, onMove, onToggleRequired, onToggleSafety, onDelete };
}

const HINT_TEXT = /Looks like a safety question/i;

describe("matchesSafetyKeyword", () => {
  it("returns the matched keyword when present (case-insensitive)", () => {
    expect(matchesSafetyKeyword("Are you currently pregnant?")).toBe("pregnant");
    expect(matchesSafetyKeyword("Any KNOWN allergies?")).toBe("allergies");
    expect(matchesSafetyKeyword("History of high blood pressure?")).toBe(
      "blood pressure",
    );
  });

  it("returns null for non-safety labels", () => {
    expect(matchesSafetyKeyword("What is your favourite colour?")).toBeNull();
    expect(matchesSafetyKeyword("")).toBeNull();
  });
});

describe("QuestionRow safety-flag hint", () => {
  it("shows the hint for a yes_no question whose label matches a keyword", () => {
    renderRow(
      makeQuestion({ label: "Are you currently pregnant?", type: "yes_no" }),
    );
    expect(screen.getByText(HINT_TEXT)).toBeTruthy();
    expect(screen.getByText(/matched "pregnant"/i)).toBeTruthy();
  });

  it("calls onToggleSafety when 'Mark as safety' is clicked, and hint disappears once safety_flag flips", () => {
    const onToggleSafety = vi.fn();
    const q = makeQuestion({
      label: "Do you have any allergies?",
      type: "yes_no",
    });
    const { rerender } = renderRow(q, { onToggleSafety });

    fireEvent.click(screen.getByRole("button", { name: /mark as safety/i }));
    expect(onToggleSafety).toHaveBeenCalledWith("q1");

    // Simulate the parent flipping safety_flag on the question.
    rerender(
      <QuestionRow
        q={{ ...q, safety_flag: true }}
        idx={0}
        total={1}
        onMove={vi.fn()}
        onToggleRequired={vi.fn()}
        onToggleSafety={onToggleSafety}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText(HINT_TEXT)).toBeNull();
  });

  it("hides the hint when the dismiss button is clicked", () => {
    renderRow(makeQuestion({ label: "Any heart problems?", type: "yes_no" }));
    expect(screen.getByText(HINT_TEXT)).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /dismiss safety suggestion/i }),
    );
    expect(screen.queryByText(HINT_TEXT)).toBeNull();
  });

  it("does not render the hint for non-yes_no question types even if the label matches", () => {
    const nonYesNo: QuestionType[] = ["text", "scale", "number", "choice"];
    for (const type of nonYesNo) {
      cleanup();
      renderRow(
        makeQuestion({
          id: `q-${type}`,
          label: "Any allergies?",
          type,
          ...(type === "scale" ? { scale_min: 1, scale_max: 10 } : {}),
          ...(type === "choice" ? { options: ["a", "b"] } : {}),
        }),
      );
      expect(screen.queryByText(HINT_TEXT)).toBeNull();
    }
  });

  it("does not render the hint when safety_flag is already true", () => {
    renderRow(
      makeQuestion({
        label: "Are you currently pregnant?",
        type: "yes_no",
        safety_flag: true,
      }),
    );
    expect(screen.queryByText(HINT_TEXT)).toBeNull();
  });
});
