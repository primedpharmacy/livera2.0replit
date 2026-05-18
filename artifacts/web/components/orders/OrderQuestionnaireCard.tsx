"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardList, Check, AlertTriangle, Minus } from "lucide-react";
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

  useEffect(() => {
    if (!scrollToFlaggedNonce || scrollToFlaggedNonce <= 0) return;
    if (!questionConfig) return;
    const firstFlagged = questionConfig
      .slice()
      .sort((a, b) => a.order - b.order)
      .find((q) => {
        const val = questionnaire_responses[q.id];
        const answered = val !== undefined && val !== null && val !== "";
        return answered && qFlag(q, val) === "warn";
      });
    if (!firstFlagged) return;
    // Defer to next frame so the tab body is laid out before we scroll.
    const raf = requestAnimationFrame(() => {
      const el = itemRefs.current[firstFlagged.id];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedQid(firstFlagged.id);
      }
    });
    const t = setTimeout(() => setHighlightedQid(null), 2200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [scrollToFlaggedNonce, questionConfig, questionnaire_responses]);

  return (
    <DCard icon={ClipboardList} title="Questionnaire Responses">
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
                return (
                  <div
                    key={q.id}
                    ref={(el) => { itemRefs.current[q.id] = el; }}
                    className={cn(
                      "grid grid-cols-[28px_1fr] gap-3 px-4 py-3.5 items-start transition-all duration-500 scroll-mt-4",
                      isHighlighted && "bg-warn-bg ring-2 ring-warn ring-inset"
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
