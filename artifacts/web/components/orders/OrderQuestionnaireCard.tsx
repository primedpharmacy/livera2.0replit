"use client";

import { ClipboardList, Check, AlertTriangle } from "lucide-react";
import { DCard } from "./orderPrimitives";

const Q_DEFS: Record<string, { question: string; sub?: string; safetyChain?: boolean }> = {
  weight_today: {
    question: "What's your current weight in kg?",
    sub: "We use this to track your progress.",
  },
  side_effects: {
    question: "Have you had any of these side effects?",
    sub: "Tick all that apply. Severe responses trigger an order pause and incident write.",
    safetyChain: true,
  },
  medication_changes: {
    question: "Has anything changed in your medical history since your last order?",
    sub: "New conditions, medications, surgeries, or hospital admissions.",
  },
};

function qFlag(key: string, val: unknown): "ok" | "warn" | "neutral" {
  if (key === "weight_today") return "neutral";
  const s = String(val).toLowerCase().trim();
  if (s === "none" || s === "no" || s === "none of these") return "ok";
  return "warn";
}

interface Props {
  questionnaire_responses: Record<string, unknown>;
}

export function OrderQuestionnaireCard({ questionnaire_responses }: Props) {
  return (
    <DCard icon={ClipboardList} title="Questionnaire Responses">
      {Object.entries(questionnaire_responses).length === 0 ? (
        <p className="text-[12px] text-t3">No responses recorded.</p>
      ) : (
        <div className="divide-y divide-bdr -mx-4 -mb-3">
          {Object.entries(questionnaire_responses).map(([key, val], idx) => {
            const def  = Q_DEFS[key];
            const flag = qFlag(key, val);
            return (
              <div key={key} className="grid grid-cols-[28px_1fr] gap-3 px-4 py-3.5 items-start">
                <div className="text-[10px] font-bold text-t3 bg-page-bg border border-bdr rounded text-center py-1 tabular-nums shrink-0">
                  Q{idx + 1}
                </div>
                <div>
                  <div className="flex items-start gap-2 flex-wrap mb-1">
                    <span className="text-[12.5px] text-t1 font-semibold leading-snug">
                      {def?.question ?? key.replace(/_/g, " ")}
                    </span>
                    {def?.safetyChain && (
                      <span className="shrink-0 text-[9px] font-bold px-1.5 py-px rounded bg-err-bg text-err border border-err-bdr tracking-wide">
                        SAFETY CHAIN
                      </span>
                    )}
                  </div>
                  {def?.sub && (
                    <p className="text-[11px] text-t3 mb-2 leading-snug">{def.sub}</p>
                  )}
                  <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded border text-[12.5px] font-semibold ${
                    flag === "ok"
                      ? "bg-ok-bg border-ok-bdr text-ok"
                      : flag === "warn"
                      ? "bg-warn-bg border-warn-bdr text-warn"
                      : "bg-page-bg border-bdr text-t1"
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {flag === "ok"   && <Check className="w-3.5 h-3.5 text-ok" />}
                      {flag === "warn" && <AlertTriangle className="w-3.5 h-3.5 text-warn" />}
                      {key === "weight_today" ? `${val} kg` : String(val)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
                      {flag === "ok" ? "No flag" : flag === "warn" ? "Review" : ""}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DCard>
  );
}
