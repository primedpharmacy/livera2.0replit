"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lock, ChevronRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ClinicId } from "@/types";

type Outcome =
  | "continue_dose"
  | "dose_escalation"
  | "decline"
  | "refer_gp"
  | "schedule_follow_up";

const OUTCOMES: { value: Outcome; label: string; description: string }[] = [
  {
    value: "continue_dose",
    label: "Continue current dose",
    description: "No changes — patient continues on existing treatment",
  },
  {
    value: "dose_escalation",
    label: "Approve dose escalation",
    description: "Trigger reorder amendment to next dose tier",
  },
  {
    value: "decline",
    label: "Decline — treatment not appropriate",
    description: "Document reason; patient notified; no reorder",
  },
  {
    value: "refer_gp",
    label: "Refer to GP",
    description: "Clinical concerns requiring primary care review",
  },
  {
    value: "schedule_follow_up",
    label: "Schedule follow-up",
    description: "Book another consultation before deciding outcome",
  },
];

interface Props {
  isCompleted: boolean;
  clinicId: ClinicId;
  patientId: string;
  linkedOrderId: string | null;
}

export function ConsultationPostCallActions({
  isCompleted,
  clinicId,
  patientId,
  linkedOrderId,
}: Props) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!outcome) return;
    console.log("[AUDIT] AUD-04", {
      event_type: "consultation_outcome_recorded",
      outcome,
      clinic_id: clinicId,
      patient_id: patientId,
      timestamp: new Date().toISOString(),
    });
    setSubmitted(true);
  }

  if (!isCompleted) {
    return (
      <div className="bg-surface rounded-xl border border-dashed border-bdr p-4 opacity-60">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-t3" />
          <h3 className="text-sm font-semibold text-t2">Post-call Actions</h3>
          <span className="ml-auto flex items-center gap-1 text-xs text-t3">
            <Lock className="w-3.5 h-3.5" />
            Available after call ends
          </span>
        </div>
        <p className="text-xs text-t3">
          Clinical outcome selection, note drafting, and order updates unlock once the
          consultation is marked completed.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-ok-bdr p-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-brand" />
        <h3 className="text-sm font-semibold text-t1">Post-call Actions</h3>
        <span className="ml-2 text-[10px] font-bold text-ok bg-ok-bg border border-ok-bdr px-1.5 py-px rounded">
          Call ended
        </span>
      </div>

      {submitted ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-ok text-sm font-semibold bg-ok-bg border border-ok-bdr rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Outcome recorded — {OUTCOMES.find((o) => o.value === outcome)?.label}
          </div>

          <p className="text-xs font-medium text-t2 mb-1">Complete the consultation record:</p>
          <div className="flex flex-col gap-2">
            <Link
              href={`/${clinicId}/patients/${patientId}?tab=notes`}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-bdr hover:bg-page-bg hover:border-brand transition-colors group"
            >
              <span className="text-sm text-t1 font-medium group-hover:text-brand transition-colors">
                Draft clinical note (AI-assisted)
              </span>
              <ChevronRight className="w-4 h-4 text-t3 group-hover:text-brand transition-colors" />
            </Link>

            <Link
              href={`/${clinicId}/gp-letters`}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-bdr hover:bg-page-bg hover:border-brand transition-colors group"
            >
              <span className="text-sm text-t1 font-medium group-hover:text-brand transition-colors">
                Send GP letter
              </span>
              <ChevronRight className="w-4 h-4 text-t3 group-hover:text-brand transition-colors" />
            </Link>

            {linkedOrderId && (
              <Link
                href={`/${clinicId}/orders/${linkedOrderId}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-bdr hover:bg-page-bg hover:border-brand transition-colors group"
              >
                <span className="text-sm text-t1 font-medium group-hover:text-brand transition-colors">
                  View / update order {linkedOrderId}
                </span>
                <ChevronRight className="w-4 h-4 text-t3 group-hover:text-brand transition-colors" />
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-t2 font-medium">Select clinical outcome:</p>
          <div className="flex flex-col gap-2">
            {OUTCOMES.map((o) => (
              <label
                key={o.value}
                className={cn(
                  "flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all",
                  outcome === o.value
                    ? "border-brand bg-brand-light"
                    : "border-bdr hover:border-brand/50 hover:bg-page-bg"
                )}
              >
                <input
                  type="radio"
                  name="outcome"
                  value={o.value}
                  checked={outcome === o.value}
                  onChange={() => setOutcome(o.value)}
                  className="mt-0.5 accent-brand shrink-0"
                />
                <div>
                  <p className={cn(
                    "text-sm font-medium transition-colors",
                    outcome === o.value ? "text-brand" : "text-t1"
                  )}>
                    {o.label}
                  </p>
                  <p className="text-[11px] text-t3 mt-0.5">{o.description}</p>
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!outcome}
            className="w-full mt-1 py-2 px-4 rounded-lg bg-brand text-white text-sm font-semibold transition-colors hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Record outcome & continue
          </button>
        </div>
      )}
    </div>
  );
}
