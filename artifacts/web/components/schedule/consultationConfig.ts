/**
 * Consultation shared config — pure TypeScript, no JSX.
 * UI primitives (KV, RailRow) live in consultationPrimitives.tsx.
 */

import type { Consultation } from "@/types";

export const TYPE_CONFIG: Record<
  Consultation["consultation_type"],
  { label: string; bg: string; border: string; text: string }
> = {
  clinical_consult: {
    label: "Clinical consult",
    bg: "bg-clinical-bg",
    border: "border-clinical-bdr",
    text: "text-clinical",
  },
  coaching: {
    label: "Coaching",
    bg: "bg-coach-bg",
    border: "border-coach-bdr",
    text: "text-coach",
  },
  welcome_call: {
    label: "Welcome call",
    bg: "bg-welcome-bg",
    border: "border-welcome-bdr",
    text: "text-welcome",
  },
  follow_up: {
    label: "Follow-up",
    bg: "bg-info-bg",
    border: "border-info-bdr",
    text: "text-info",
  },
};

export const STATUS_CONFIG: Record<
  Consultation["status"],
  { label: string; bg: string; text: string; border: string }
> = {
  scheduled:   { label: "Scheduled",   bg: "bg-info-bg",    text: "text-info",  border: "border-info-bdr"  },
  in_progress: { label: "In progress", bg: "bg-warn-bg",    text: "text-warn",  border: "border-warn-bdr"  },
  completed:   { label: "Completed",   bg: "bg-ok-bg",      text: "text-ok",    border: "border-ok-bdr"    },
  no_show:     { label: "No-show",     bg: "bg-err-bg",     text: "text-err",   border: "border-err-bdr"   },
  cancelled:   { label: "Cancelled",   bg: "bg-slate-100",  text: "text-t3",    border: "border-bdr"       },
  rescheduled: { label: "Rescheduled", bg: "bg-warn-bg",    text: "text-warn",  border: "border-warn-bdr"  },
};

export const CLINICIAN_INFO: Record<string, { name: string; role: string; reg?: string }> = {
  user_claire: { name: "Claire Moynehan", role: "Nurse Prescriber", reg: "NMC 1234567" },
  user_olwyn:  { name: "Olwyn Price",      role: "Coach" },
  user_qadir:  { name: "Qadir Hussain",    role: "Owner" },
  user_admin:  { name: "Admin",            role: "Admin" },
};

export const PHASES = [
  { label: "Booked"    },
  { label: "Pre-call"  },
  { label: "In call"   },
  { label: "Post-call" },
];

export function getPhaseIndex(status: Consultation["status"]): number {
  if (status === "in_progress") return 2;
  if (status === "completed" || status === "no_show" || status === "cancelled") return 3;
  return 1; // scheduled / rescheduled → pre-call
}

export const G6_LABELS: Record<string, string> = {
  A1: "Acute pancreatitis",
  A2: "Severe renal impairment",
  B1: "BMI below 27",
  B4: "Pregnancy risk or recent delivery",
  C1: "Drug interaction — MAOI",
  D1: "Eating disorder (active)",
};
