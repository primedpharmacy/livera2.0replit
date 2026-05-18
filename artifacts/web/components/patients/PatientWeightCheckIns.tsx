"use client";

/**
 * Task-244 — Recent weight check-ins list shown on the patient profile
 * Measurements panel.
 *
 * Surfaces the staff/patient attribution baked into `PatientWeightCheckIn`
 * so a coach can tell at a glance which rows came from a clinician and
 * which were self-reported by the patient via the magic-link page. Each
 * unacknowledged patient-sourced row carries a "New from patient" badge
 * and an Acknowledge button — clicking it stamps coach_acknowledged_at so
 * the badge disappears for everyone on the team.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCircle2, Stethoscope, BellRing, Check } from "lucide-react";
import {
  acknowledgePatientWeightCheckIn,
  type PatientWeightCheckIn,
} from "@/lib/api/mock";
import type { ClinicId } from "@/lib/api/types";

interface Props {
  clinicId: ClinicId;
  checkIns: PatientWeightCheckIn[];
  canAcknowledge: boolean;
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function PatientWeightCheckIns({ clinicId, checkIns, canAcknowledge }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (checkIns.length === 0) return null;

  const recent = [...checkIns]
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    .slice(0, 5);

  const unseenPatient = checkIns.filter(
    (c) => c.source === "patient" && c.coach_acknowledged_at === null,
  ).length;

  async function ack(id: string) {
    setBusyId(id);
    try {
      await acknowledgePatientWeightCheckIn(clinicId, id);
      startTransition(() => router.refresh());
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-t2 uppercase tracking-wide">
          Recent check-ins
        </p>
        {unseenPatient > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-dark bg-brand-bg border border-brand-bdr rounded px-1.5 py-0.5">
            <BellRing className="w-2.5 h-2.5" /> {unseenPatient} new from patient
          </span>
        )}
      </div>
      <ul className="space-y-1">
        {recent.map((c) => {
          const isPatient = c.source === "patient";
          const unseen = isPatient && c.coach_acknowledged_at === null;
          return (
            <li
              key={c.id}
              className={`flex items-start justify-between gap-2 text-[11px] rounded px-2 py-1.5 border ${
                unseen ? "bg-brand-bg border-brand-bdr" : "bg-page-bg border-bdr"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-t1 font-medium">
                  {isPatient ? (
                    <UserCircle2 className="w-3 h-3 text-brand" aria-hidden />
                  ) : (
                    <Stethoscope className="w-3 h-3 text-t3" aria-hidden />
                  )}
                  <span>{c.weight_kg.toFixed(1)} kg</span>
                  <span className="text-t3">·</span>
                  <span className="text-t2">BMI {c.bmi.toFixed(1)}</span>
                </div>
                <div className="text-t3 mt-0.5 truncate">
                  {formatRelative(c.recorded_at)} ·{" "}
                  {isPatient ? "Patient self-report" : `Recorded by ${c.actor_name}`}
                </div>
              </div>
              {unseen && canAcknowledge && (
                <button
                  type="button"
                  onClick={() => ack(c.id)}
                  disabled={busyId === c.id}
                  className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-white bg-brand rounded hover:bg-brand-dark disabled:opacity-50"
                >
                  <Check className="w-2.5 h-2.5" />
                  {busyId === c.id ? "…" : "Acknowledge"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
