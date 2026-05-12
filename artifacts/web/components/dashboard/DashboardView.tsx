/**
 * DashboardView — BLD-2.8 (minimal).
 *
 * Renders ONLY the coaching escalation priority banner.
 * Shown to Prescriber, Admin, and Owner. Hidden from Coach.
 * Red when any open flag has sla_deadline < NOW (SLA breached).
 * Amber when all open flags are within SLA.
 * Hidden when there are zero open escalations or coaching is disabled.
 */

import Link from "next/link";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { NOW } from "@/lib/api/constants";
import type { ClinicalEscalationFlag, ClinicId, Role } from "@/types";

interface DashboardViewProps {
  clinicId: ClinicId;
  coachingEnabled: boolean;
  openEscalations: ClinicalEscalationFlag[];
  currentUserRoles: Role[];
}

export function DashboardView({
  clinicId,
  coachingEnabled,
  openEscalations,
  currentUserRoles,
}: DashboardViewProps) {
  const canSeeBanner =
    coachingEnabled &&
    openEscalations.length > 0 &&
    !currentUserRoles.includes("Coach");

  if (!canSeeBanner) return null;

  const breached = openEscalations.some((f) => f.sla_deadline < NOW);

  const bannerCls = breached
    ? "bg-err-bg border-err-bdr"
    : "bg-warn-bg border-warn-bdr";
  const iconBgCls  = breached ? "bg-err"  : "bg-warn";
  const textCls    = breached ? "text-err" : "text-warn";
  const subTextCls = breached ? "text-err/70" : "text-warn/70";

  return (
    <div className="px-6 pt-6">
      <Link
        href={`/${clinicId}/coach`}
        className={`flex items-center gap-4 px-5 py-4 rounded-xl border ${bannerCls} hover:opacity-90 transition-opacity group`}
      >
        <div className={`w-10 h-10 rounded-lg ${iconBgCls} flex items-center justify-center shrink-0`}>
          <ShieldAlert className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${textCls}`}>
            {openEscalations.length} clinical escalation{openEscalations.length !== 1 ? "s" : ""} awaiting prescriber review
          </p>
          <p className={`text-[12px] mt-0.5 ${subTextCls}`}>
            {breached
              ? "SLA breached · Immediate prescriber action required"
              : "Raised by coaching team · SLA in progress · Prescriber action required"}
          </p>
        </div>
        <ArrowRight className={`w-4 h-4 shrink-0 ${textCls} group-hover:translate-x-1 transition-transform`} />
      </Link>
    </div>
  );
}
