"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, Check, AlertTriangle, Minus, ChevronUp, ChevronDown } from "lucide-react";
import { DCard } from "./orderPrimitives";
import { qFlag } from "@/lib/questionnaire";
import { cn } from "@/lib/utils";
import type { QuestionItem, QuestionType } from "@/types";

function typeLabel(type: QuestionType): string {
  switch (type) {
    case "yes_no": return "Yes / No";
    case "number": return "Number";
    case "scale":  return "Scale";
    case "text":   return "Text";
    case "choice": return "Choice";
    default:       return type;
  }
}

function formatValue(type: QuestionType, val: unknown, q: QuestionItem): string {
  if (val === null || val === undefined || val === "") return "—";
  if (type === "scale") return `${val} / ${q.scale_max ?? 10}`;
  if (type === "number") return `${val}`;
  return String(val);
}

interface Props {
  questionnaire_responses: Record<string, unknown>;
  questionConfig?: QuestionItem[];
  /**
   * When this nonce changes (and is truthy), the card scrolls to the first
   * safety-flagged ("warn") answer and briefly highlights it so the clinician's
   * eye lands on it. Used by the Clinical Check slide-over.
   */
  scrollToFlaggedNonce?: number;
}

export function OrderQuestionnaireCard({
  questionnaire_responses,
  questionConfig,
  scrollToFlaggedNonce,
}: Props) {
  const configProvided = questionConfig !== undefined;
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightedQid, setHighlightedQid] = useState<string | null>(null);
  const [highlightKind, setHighlightKind] = useState<"warn" | "missing">("warn");
  const [currentIssueIdx, setCurrentIssueIdx] = useState(0);

  // Ordered list of issues — flagged ("warn") answers plus missing required
  // answers — in question order, so clinicians can sweep through both kinds
  // in a single pass.
  const issues = useMemo(() => {
    if (!questionConfig) return [] as { id: string; kind: "warn" | "missing" }[];
    return questionConfig
      .slice()
      .sort((a, b) => a.order - b.order)
      .reduce<{ id: string; kind: "warn" | "missing" }[]>((acc, q) => {
        const val = questionnaire_responses[q.id];
        const answered = val !== undefined && val !== null && val !== "";
        if (!answered) {
          if (q.required) acc.push({ id: q.id, kind: "missing" });
        } else if (qFlag(q, val) === "warn") {
          acc.push({ id: q.id, kind: "warn" });
        }
        return acc;
      }, []);
  }, [questionConfig, questionnaire_responses]);

  const issueCount = issues.length;
  const warnCount = useMemo(() => issues.filter((i) => i.kind === "warn").length, [issues]);
  const missingCount = issueCount - warnCount;

  // Reset to the first issue whenever the dataset or jump nonce changes.
  useEffect(() => {
    setCurrentIssueIdx(0);
  }, [issueCount, scrollToFlaggedNonce]);

  // Scroll + highlight whichever issue is currently selected. Runs on initial
  // jump (nonce change) and on every next/prev navigation.
  function focusIssue(idx: number) {
    if (issues.length === 0) return;
    const issue = issues[idx];
    const el = itemRefs.current[issue.id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightKind(issue.kind);
    setHighlightedQid(issue.id);
  }

  useEffect(() => {
    if (highlightedQid == null) return;
    const t = setTimeout(() => setHighlightedQid(null), 2200);
    return () => clearTimeout(t);
  }, [highlightedQid]);

  // Jump to first issue when the slide-over nonce changes.
  useEffect(() => {
    if (!scrollToFlaggedNonce || scrollToFlaggedNonce <= 0) return;
    if (issues.length === 0) return;
    const raf = requestAnimationFrame(() => focusIssue(0));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToFlaggedNonce, issues]);

  function goToIssue(delta: 1 | -1) {
    if (issues.length === 0) return;
    setCurrentIssueIdx((prev) => {
      const next = (prev + delta + issues.length) % issues.length;
      requestAnimationFrame(() => focusIssue(next));
      return next;
    });
  }

  // Keyboard shortcut: `f` advances to the next issue (wraps).
  useEffect(() => {
    if (issues.length === 0) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        goToIssue(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues]);

  const currentIssueKind = issues[currentIssueIdx]?.kind ?? "warn";
  const counterClass =
    currentIssueKind === "missing"
      ? "bg-info-bg text-info border-info-bdr"
      : "bg-warn-bg text-warn border-warn-bdr";

  const headerExtra =
    issueCount > 0 ? (
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5",
            counterClass,
          )}
        >
          <AlertTriangle className="w-3 h-3" />
          Issue {currentIssueIdx + 1} of {issueCount}
        </span>
        {warnCount > 0 && missingCount > 0 && (
          <span
            className="hidden sm:inline-flex items-center text-[10px] font-bold uppercase tracking-wide text-t3"
            title={`${warnCount} flagged · ${missingCount} missing required`}
          >
            {warnCount}F · {missingCount}M
          </span>
        )}
        <button
          type="button"
          onClick={() => goToIssue(-1)}
          className="rounded border border-bdr bg-surface hover:bg-page-bg text-t2 hover:text-t1 transition-colors p-1"
          aria-label="Previous issue"
          title="Previous issue"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => goToIssue(1)}
          className="rounded border border-bdr bg-surface hover:bg-page-bg text-t2 hover:text-t1 transition-colors p-1"
          aria-label="Next issue"
          title="Next issue (F)"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    ) : null;

  return (
    <DCard icon={ClipboardList} title="Questionnaire Responses" headerExtra={headerExtra}>
      {configProvided ? (
        questionConfig.length === 0 ? (
          <p className="text-[12px] text-t3">No questions configured for this clinic.</p>
        ) : (
          <div className="divide-y divide-bdr -mx-4 -mb-3">
            {questionConfig
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((q, idx) => {
                const val  = questionnaire_responses[q.id];
                const answered = val !== undefined && val !== null && val !== "";
                const flag = answered ? qFlag(q, val) : "neutral";
                const displayVal = answered ? formatValue(q.type, val, q) : "Not answered";

                const isHighlighted = highlightedQid === q.id;
                const highlightClass =
                  isHighlighted && highlightKind === "missing"
                    ? "bg-info-bg ring-2 ring-info ring-inset"
                    : isHighlighted
                    ? "bg-warn-bg ring-2 ring-warn ring-inset"
                    : "";
                return (
                  <div
                    key={q.id}
                    ref={(el) => { itemRefs.current[q.id] = el; }}
                    className={cn(
                      "grid grid-cols-[28px_1fr] gap-3 px-4 py-3.5 items-start transition-all duration-500 scroll-mt-4",
                      highlightClass,
                    )}
                  >
                    <div className="text-[10px] font-bold text-t3 bg-page-bg border border-bdr rounded text-center py-1 tabular-nums shrink-0">
                      Q{idx + 1}
                    </div>
                    <div>
                      <div className="flex items-start gap-2 flex-wrap mb-1">
                        <span className="text-[12.5px] text-t1 font-semibold leading-snug flex-1 min-w-0">
                          {q.label}
                        </span>
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-px rounded bg-page-bg text-t3 border border-bdr uppercase tracking-wide">
                          {typeLabel(q.type)}
                        </span>
                        {q.required && (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-px rounded bg-info-bg text-info border border-info-bdr tracking-wide">
                            required
                          </span>
                        )}
                      </div>
                      {q.help_text && (
                        <p className="text-[11px] text-t3 mb-2 leading-snug">{q.help_text}</p>
                      )}
                      <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded border text-[12.5px] font-semibold ${
                        !answered
                          ? "bg-page-bg border-bdr text-t3 italic"
                          : flag === "ok"
                          ? "bg-ok-bg border-ok-bdr text-ok"
                          : flag === "warn"
                          ? "bg-warn-bg border-warn-bdr text-warn"
                          : "bg-page-bg border-bdr text-t1"
                      }`}>
                        <span className="flex items-center gap-1.5">
                          {answered && flag === "ok"   && <Check         className="w-3.5 h-3.5 text-ok shrink-0" />}
                          {answered && flag === "warn" && <AlertTriangle  className="w-3.5 h-3.5 text-warn shrink-0" />}
                          {(!answered || flag === "neutral") && <Minus    className="w-3.5 h-3.5 text-t3 shrink-0" />}
                          <span className={!answered ? "font-normal" : ""}>{displayVal}</span>
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60 shrink-0">
                          {!answered ? "Missing" : flag === "ok" ? "No flag" : flag === "warn" ? "Review" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )
      ) : (
        Object.entries(questionnaire_responses).length === 0 ? (
          <p className="text-[12px] text-t3">No responses recorded.</p>
        ) : (
          <div className="divide-y divide-bdr -mx-4 -mb-3">
            {Object.entries(questionnaire_responses).map(([key, val], idx) => (
              <div key={key} className="grid grid-cols-[28px_1fr] gap-3 px-4 py-3.5 items-start">
                <div className="text-[10px] font-bold text-t3 bg-page-bg border border-bdr rounded text-center py-1 tabular-nums shrink-0">
                  Q{idx + 1}
                </div>
                <div>
                  <span className="text-[12.5px] text-t1 font-semibold leading-snug block mb-2">
                    {key.replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-2 px-3 py-2 rounded border bg-page-bg border-bdr text-t1 text-[12.5px] font-semibold">
                    <Minus className="w-3.5 h-3.5 text-t3 shrink-0" />
                    {String(val)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </DCard>
  );
}
