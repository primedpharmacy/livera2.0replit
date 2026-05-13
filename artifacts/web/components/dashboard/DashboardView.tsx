/**
 * DashboardView — BLD-2.8 (escalation banner) + BLD-3.3 (SLA breach banner)
 *                + BLD-INT-MHRA-03 (MHRA gov.uk alerts rollup card, DEC-39)
 *
 * Renders:
 *   1. SLA breach banner — any open SlaBreach records (BLD-3.3)
 *   2. Coaching escalation banner — open ClinicalEscalationFlags (BLD-2.8)
 *   3. MHRA alerts rollup card — last 30d gov.uk drug/device alerts routed to this workspace
 *
 * Banners hidden from Coach role.
 */

import Link from "next/link";
import { ShieldAlert, ArrowRight, Clock, ExternalLink } from "lucide-react";
import { NOW } from "@/lib/api/constants";
import type { ClinicalEscalationFlag, SlaBreach, ClinicId, Role } from "@/types";

interface DashboardViewProps {
  clinicId: ClinicId;
  coachingEnabled: boolean;
  openEscalations: ClinicalEscalationFlag[];
  openSlaBreaches: SlaBreach[];
  currentUserRoles: Role[];
}

// ── BLD-INT-MHRA-03: Mock MHRA alert data ────────────────────────────────────

type AlertKind = "DSU" | "FSN" | "CHM";

type MhraAlert = {
  id: string;
  kind: AlertKind;
  title: string;
  meta: string;
  status: "pending" | "acked" | "resolved";
  ackedAt?: string;
  pending?: boolean;
};

const MHRA_ALERTS: MhraAlert[] = [
  {
    id: "mhra-a001",
    kind: "DSU",
    title: "GLP-1 receptor agonists: vision changes",
    meta: "10 May · matches: semaglutide · tirzepatide · liraglutide · 3 watchlist hits",
    status: "pending",
  },
  {
    id: "mhra-a002",
    kind: "DSU",
    title: "Tirzepatide: severe pancreatitis cases",
    meta: "02 May · matches: Mounjaro / tirzepatide · prescribers cascaded",
    status: "acked",
    ackedAt: "RM ack 03 May",
  },
  {
    id: "mhra-a003",
    kind: "FSN",
    title: "FlexPen needle attachment guidance",
    meta: "28 Apr · Class 4 caution · device watchlist match",
    status: "resolved",
  },
];

const KIND_STYLES: Record<AlertKind, { gradient: string; text: string }> = {
  DSU: { gradient: "from-yellow-200 to-yellow-600",  text: "DSU" },
  FSN: { gradient: "from-blue-200 to-blue-800",      text: "FSN" },
  CHM: { gradient: "from-purple-200 to-purple-700",  text: "CHM" },
};

const pendingCount = MHRA_ALERTS.filter((a) => a.status === "pending").length;

export function DashboardView({
  clinicId,
  coachingEnabled,
  openEscalations,
  openSlaBreaches,
  currentUserRoles,
}: DashboardViewProps) {
  const isCoach = currentUserRoles.includes("Coach") &&
    !currentUserRoles.some((r) => r === "Prescriber" || r === "Admin" || r === "Owner");

  const showEscalationBanner = !isCoach && coachingEnabled && openEscalations.length > 0;
  const showSlaBanner        = !isCoach && openSlaBreaches.length > 0;

  const escalationBreached = openEscalations.some((f) => f.sla_deadline < NOW);

  const orderBreaches = openSlaBreaches.filter((b) => b.entity_type === "order").length;
  const otherBreaches = openSlaBreaches.length - orderBreaches;

  return (
    <div className="px-6 pt-6 pb-8 space-y-4">

      {/* ── BLD-3.3: SLA breach banner ──────────────────────────────────────── */}
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

      {/* ── BLD-2.8: Coaching escalation banner ─────────────────────────────── */}
      {showEscalationBanner && (
        <Link
          href={`/${clinicId}/coach`}
          className={`flex items-center gap-4 px-5 py-4 rounded-xl border ${
            escalationBreached ? "bg-err-bg border-err-bdr" : "bg-warn-bg border-warn-bdr"
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

      {/* ── BLD-INT-MHRA-03: MHRA alerts rollup card (DEC-39) ──────────────── */}
      {!isCoach && (
        <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-bdr bg-gradient-to-b from-page-bg to-surface">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-t1">🟡 MHRA alerts — last 30 days</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-t1 text-white tracking-wide">
                {pendingCount} ROUTED
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-ok-bg text-ok border border-ok-bdr tracking-wide">
                BLD-INT-MHRA-03
              </span>
            </div>
            <Link
              href={`/${clinicId}/settings`}
              className="text-[12px] text-brand hover:underline font-medium"
            >
              View all →
            </Link>
          </div>

          {/* Alert rows */}
          <div className="divide-y divide-bdr">
            {MHRA_ALERTS.map((alert) => {
              const kindStyle = KIND_STYLES[alert.kind];
              const isPending = alert.status === "pending";

              return (
                <div
                  key={alert.id}
                  className={`flex items-center gap-3 px-5 py-3 ${isPending ? "bg-warn-bg/40" : ""}`}
                >
                  {/* Kind avatar */}
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${kindStyle.gradient} flex items-center justify-center shrink-0`}>
                    <span className="text-[10px] font-black text-white tracking-tight">{kindStyle.text}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-t1 truncate">{alert.title}</p>
                    <p className="text-[11px] text-t3 mt-0.5 truncate">{alert.meta}</p>
                  </div>

                  {/* Status chip */}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 ${
                    isPending
                      ? "bg-warn-bg text-warn border-warn-bdr"
                      : "bg-ok-bg text-ok border-ok-bdr"
                  }`}>
                    {alert.status === "pending" ? "RM ack pending" : alert.ackedAt ?? "Resolved"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-dashed border-bdr bg-page-bg/50">
            <p className="text-[11px] text-t3 leading-relaxed">
              <span className="font-semibold text-t2">Source:</span>{" "}
              daily poll of{" "}
              <a
                href="https://www.gov.uk/drug-device-alerts"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-t2 hover:text-brand inline-flex items-center gap-0.5"
              >
                gov.uk/drug-device-alerts <ExternalLink className="w-3 h-3" />
              </a>
              {" "}· 14 alerts processed (30d) · 11 skipped (no watchlist match) · last poll 10 May 04:01 BST ·{" "}
              <Link href={`/${clinicId}/settings`} className="text-brand font-semibold hover:underline">
                configure ↗
              </Link>
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
