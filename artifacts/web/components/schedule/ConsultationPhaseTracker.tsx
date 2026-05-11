"use client";

import { CheckCircle2 } from "lucide-react";
import { PHASES, getPhaseIndex } from "./consultationConfig";
import type { Consultation } from "@/types";

interface Props {
  status: Consultation["status"];
}

export function ConsultationPhaseTracker({ status }: Props) {
  const phaseIndex = getPhaseIndex(status);

  return (
    <div className="flex items-center px-6 py-4 bg-surface border-b border-bdr gap-0">
      {PHASES.map((phase, i) => {
        const isDone   = i < phaseIndex;
        const isActive = i === phaseIndex;
        return (
          <div key={i} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                isDone
                  ? "bg-brand border-brand"
                  : isActive
                    ? "bg-brand-light border-brand"
                    : "bg-surface border-bdr"
              }`}>
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                ) : (
                  <span className={`text-xs font-bold ${isActive ? "text-brand" : "text-t3"}`}>
                    {i + 1}
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                isActive ? "text-brand" : isDone ? "text-t2" : "text-t3"
              }`}>
                {phase.label}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${
                i < phaseIndex ? "bg-brand" : "bg-bdr"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
