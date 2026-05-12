/**
 * DashboardView — BLD-2.8 (escalation banner) + BLD-3.3 (SLA breach banner).
 *
 * Renders two alert banners:
 *   1. SLA breach banner — any open SlaBreach records (BLD-3.3)
 *   2. Coaching escalation banner — open ClinicalEscalationFlags (BLD-2.8)
 *
 * Both hidden from Coach role.
 * SLA breach banner hidden if zero open breaches.
 * Escalation banner hidden if coaching disabled or zero open escalations.
 */

import Link from "next/link";
import { ShieldAlert, ArrowRight, Clock } from "lucide-react";
import { NOW } from "@/lib/api/constants";
import type { ClinicalEscalationFlag, SlaBreach, ClinicId, Role } from "@/types";

interface DashboardViewProps {
  clinicId: ClinicId;
  coachingEnabled: boolean;
  openEscalations: ClinicalEscalationFlag[];
  openSlaBreaches: SlaBreach[];
  currentUserRoles: Role[];
}

export function DashboardView({
  clinicId,
  coachingEnabled,
  openEscalations,
  openSlaBreaches,
  currentUserRoles,
}: DashboardViewProps) {
  const isCoach = currentUserRoles.includes("Coach") && !currentUserRoles.some((r) => r === "Prescriber" || r === "Admin" || r === "Owner");

  const showEscalationBanner =
    !isCoach && coachingEnabled && openEscalations.length > 0;

  const showSlaBanner = !isCoach && openSlaBreaches.length > 0;

  if (!showSlaBanner && !showEscalationBanner) return null;

  const escalationBreached = openEscalations.some((f) => f.sla_deadline < NOW);

  // Group breach counts by entity type for display
  const orderBreaches   = openSlaBreaches.filter((b) => b.entity_type === "order").length;
  const otherBreaches   = openSlaBreaches.length - orderBreaches;

  return (
    <div className="px-6 pt-6 space-y-3">
      {/* ── BLD-3.3: SLA breach banner ─────────────────────────────────── */}
      {showSlaBanner && (
        <Link
          href={`/${clinicId}/settings/slas`}
          className="flex items-center gap-4 px-5 py-4 rounded-xl border bg-err-bg border-err-bdr hover:opacity-90 transition-opacity group"
        >
          <div className="w-10 h-10 rounded-lg bg-err flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-err">
              {openSlaBreaches.length} SLA breach{openSlaBreaches.length !== 1 ? "es" : ""} require acknowledgement
            </p>
            <p className="text-[12px] mt-0.5 text-err/70">
              {orderBreaches > 0 && `${orderBreaches} order${orderBreaches !== 1 ? "s" : ""}`}
              {orderBreaches > 0 && otherBreaches > 0 && " · "}
              {otherBreaches > 0 && `${otherBreaches} other`}
              {" "}· Review and acknowledge in SLA log
            </p>
          </div>
          <ArrowRight className="w-4 h-4 shrink-0 text-err group-hover:translate-x-1 transition-transform" />
        </Link>
      )}

      {/* ── BLD-2.8: Coaching escalation banner ────────────────────────── */}
      {showEscalationBanner && (
        <Link
          href={`/${clinicId}/coach`}
          className={`flex items-center gap-4 px-5 py-4 rounded-xl border ${
            escalationBreached
              ? "bg-err-bg border-err-bdr"
              : "bg-warn-bg border-warn-bdr"
          } hover:opacity-90 transition-opacity group`}
        >
          <div className={`w-10 h-10 rounded-lg ${escalationBreached ? "bg-err" : "bg-warn"} flex items-center justify-center shrink-0`}>
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${escalationBreached ? "text-err" : "text-warn"}`}>
              {openEscalations.length} clinical escalation{openEscalations.length !== 1 ? "s" : ""} awaiting prescriber review
            </p>
            <p className={`text-[12px] mt-0.5 ${escalationBreached ? "text-err/70" : "text-warn/70"}`}>
              {escalationBreached
                ? "SLA breached · Immediate prescriber action required"
                : "Raised by coaching team · SLA in progress · Prescriber action required"}
            </p>
          </div>
          <ArrowRight className={`w-4 h-4 shrink-0 ${escalationBreached ? "text-err" : "text-warn"} group-hover:translate-x-1 transition-transform`} />
        </Link>
      )}
    </div>
  );
}
