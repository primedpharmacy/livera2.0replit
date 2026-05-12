"use client";

import { format, parseISO } from "date-fns";
import {
  Brain,
  Lock,
  Users,
  Calendar,
  TrendingDown,
  ShieldAlert,
  ChevronRight,
  Phone,
  Video,
  MessageSquare,
  AlertTriangle,
  Clock,
} from "lucide-react";
import Link from "next/link";
import type { Consultation, ClinicalEscalationFlag, ClinicId } from "@/types";
import type { CoachKpi, RosterRow } from "@/app/(workspace)/[clinic_id]/coach/page";

interface Props {
  clinicId: ClinicId;
  coachingEnabled: boolean;
  kpis: CoachKpi;
  roster: RosterRow[];
  todaySessions: Consultation[];
  openEscalations: ClinicalEscalationFlag[];
  coachName: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MODALITY_ICON = {
  phone: Phone,
  video: Video,
  chat: MessageSquare,
};

const ENTRY_TYPE_LABEL: Record<string, string> = {
  initial_call: "Initial call",
  check_in: "Check-in",
  escalation: "Escalation",
  note: "Note",
};

function kpiPct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

function kpiVariant(n: number, d: number, goodThreshold: number, warnThreshold: number) {
  if (d === 0) return "muted";
  const pct = n / d;
  if (pct >= goodThreshold) return "ok";
  if (pct >= warnThreshold) return "warn";
  return "err";
}

function rosterStatus(row: RosterRow): { label: string; cls: string } {
  if (row.hasOpenEscalation)
    return { label: "Escalated", cls: "bg-err-bg text-err border-err-bdr" };
  if (!row.lastLog)
    return { label: "New", cls: "bg-slate-100 text-t3 border-bdr" };
  const daysSinceLog =
    (Date.now() - new Date(row.lastLog.entry_date).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceLog > 35)
    return { label: "Overdue", cls: "bg-warn-bg text-warn border-warn-bdr" };
  return { label: "On track", cls: "bg-ok-bg text-ok border-ok-bdr" };
}

// ── Locked state ──────────────────────────────────────────────────────────────

function LockedState() {
  return (
    <>
      <div className="flex items-center gap-4 px-6 py-4 bg-surface border-b border-bdr">
        <div className="w-[52px] h-[52px] rounded-xl bg-gradient-to-br from-t3 to-slate-400 shadow-sm flex items-center justify-center shrink-0">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-t1">Coach Dashboard</h1>
          <p className="text-sm text-t2">Coaching programme management</p>
        </div>
      </div>
      <div className="px-6 py-16 flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Lock className="w-8 h-8 text-t3" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-t1 mb-1">Coaching not enabled</h2>
          <p className="text-sm text-t2 max-w-sm">
            The coaching programme is not active for this workspace. Contact Livera support to enable it.
          </p>
        </div>
      </div>
    </>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  variant,
}: {
  label: string;
  value: string;
  sub?: string;
  variant: "muted" | "ok" | "warn" | "err";
}) {
  const cls = {
    muted: "bg-surface border-bdr text-t2",
    ok:    "bg-ok-bg border-ok-bdr text-ok",
    warn:  "bg-warn-bg border-warn-bdr text-warn",
    err:   "bg-err-bg border-err-bdr text-err",
  }[variant];

  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-3xl font-bold tabular-nums leading-none">{value}</p>
      {sub && <p className="text-[11px] mt-1.5 opacity-60">{sub}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CoachDashboardClient({
  clinicId,
  coachingEnabled,
  kpis,
  roster,
  todaySessions,
  openEscalations,
  coachName,
}: Props) {
  if (!coachingEnabled) return <LockedState />;

  const k1Variant = kpiVariant(kpis.initial_call_within_7d.n, kpis.initial_call_within_7d.d, 0.8, 0.6);
  const k3Variant = kpiVariant(kpis.escalation_sla_met.n, kpis.escalation_sla_met.d, 0.9, 0.7);

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 bg-surface border-b border-bdr">
        <div className="w-[52px] h-[52px] rounded-xl bg-gradient-to-br from-brand to-brand-dark shadow-sm flex items-center justify-center shrink-0">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-t1">Coach Dashboard</h1>
          <p className="text-sm text-t2">{coachName} · {roster.length} assigned patients</p>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-5">

        {/* KPI strip — 3 cards */}
        <div className="grid grid-cols-3 gap-3">
          <KpiCard
            label="Initial call ≤ 7 days"
            value={kpiPct(kpis.initial_call_within_7d.n, kpis.initial_call_within_7d.d)}
            sub={`${kpis.initial_call_within_7d.n} of ${kpis.initial_call_within_7d.d} patients`}
            variant={k1Variant}
          />
          <KpiCard
            label="Avg contact delta"
            value={kpis.avg_contact_delta_days !== null ? `${kpis.avg_contact_delta_days}d` : "—"}
            sub="scheduled vs actual (90 days)"
            variant={
              kpis.avg_contact_delta_days === null
                ? "muted"
                : kpis.avg_contact_delta_days <= 1
                ? "ok"
                : kpis.avg_contact_delta_days <= 3
                ? "warn"
                : "err"
            }
          />
          <KpiCard
            label="Escalations resolved in SLA"
            value={kpiPct(kpis.escalation_sla_met.n, kpis.escalation_sla_met.d)}
            sub={`${kpis.escalation_sla_met.n} of ${kpis.escalation_sla_met.d} flags (90 days)`}
            variant={k3Variant}
          />
        </div>

        {/* Body — left panel + right rail */}
        <div className="grid grid-cols-5 gap-5 items-start">

          {/* Left — patient roster */}
          <div className="col-span-3 bg-surface rounded-xl border border-bdr overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-bdr">
              <h2 className="text-sm font-semibold text-t1 flex items-center gap-2">
                <Users className="w-4 h-4 text-t2" />
                My patient roster
              </h2>
              <span className="text-xs text-t2">{roster.length} patients</span>
            </div>

            {roster.length === 0 ? (
              <p className="px-4 py-8 text-sm text-t3 text-center">No patients assigned yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-page-bg border-b border-bdr">
                    <th className="text-left px-4 py-2.5 text-[11px] font-bold text-t2 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-bold text-t2 uppercase tracking-wider">
                      Weight Δ
                    </th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-bold text-t2 uppercase tracking-wider">
                      Last log
                    </th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-bold text-t2 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {roster.map((row) => {
                    const { label, cls } = rosterStatus(row);
                    const ModalityIcon = row.lastLog?.modality
                      ? MODALITY_ICON[row.lastLog.modality]
                      : null;
                    return (
                      <tr
                        key={row.patient.id}
                        className="border-b border-bdr last:border-0 hover:bg-page-bg transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {row.hasOpenEscalation && (
                              <AlertTriangle className="w-3.5 h-3.5 text-err shrink-0" />
                            )}
                            <div>
                              <p className="font-medium text-t1 text-[13px]">
                                {row.patient.demographic.full_name}
                              </p>
                              <p className="text-[11px] text-t3 font-mono">{row.patient.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {row.weightLossKg > 0 ? (
                            <div className="flex items-center gap-1">
                              <TrendingDown className="w-3.5 h-3.5 text-ok shrink-0" />
                              <span className="text-[13px] font-semibold text-ok">
                                −{row.weightLossKg} kg
                              </span>
                            </div>
                          ) : (
                            <span className="text-[13px] text-t3">—</span>
                          )}
                          <p className="text-[11px] text-t3">{row.weightLossPct}% loss</p>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-t2">
                          {row.lastLog ? (
                            <div className="flex items-center gap-1.5">
                              {ModalityIcon && (
                                <ModalityIcon className="w-3.5 h-3.5 text-t3 shrink-0" />
                              )}
                              <div>
                                <p className="text-t1">
                                  {ENTRY_TYPE_LABEL[row.lastLog.entry_type] ?? row.lastLog.entry_type}
                                </p>
                                <p className="text-t3 text-[11px]">
                                  {format(parseISO(row.lastLog.entry_date), "d MMM yyyy")}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-t3">No logs yet</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[11px] font-bold px-2 py-px rounded-full border ${cls}`}
                          >
                            {label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/${clinicId}/patients/${row.patient.id}?tab=coaching`}
                            className="flex items-center gap-0.5 text-xs text-brand hover:underline"
                          >
                            Coaching
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Right rail */}
          <div className="col-span-2 flex flex-col gap-4">

            {/* Today's sessions */}
            <div className="bg-surface rounded-xl border border-bdr overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-bdr">
                <h2 className="text-sm font-semibold text-t1 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-t2" />
                  Today&apos;s sessions
                </h2>
                <span className="text-xs font-bold text-brand bg-brand-light px-2 py-px rounded-full">
                  {todaySessions.length}
                </span>
              </div>
              {todaySessions.length === 0 ? (
                <p className="px-4 py-5 text-sm text-t3 text-center">No sessions today</p>
              ) : (
                <div className="flex flex-col divide-y divide-bdr">
                  {todaySessions.map((s) => {
                    const patient = roster.find((r) => r.patient.id === s.patient_id)?.patient;
                    const ModalityIcon = MODALITY_ICON[s.modality];
                    return (
                      <Link
                        key={s.id}
                        href={`/${clinicId}/patients/${s.patient_id}?tab=coaching`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-page-bg transition-colors"
                      >
                        <div className="w-1 self-stretch rounded-full bg-coach shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-t1 truncate">
                            {patient?.demographic.full_name ?? s.patient_id}
                          </p>
                          <p className="text-xs text-t2 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 shrink-0" />
                            {format(parseISO(s.scheduled_start), "HH:mm")}
                            {" · "}
                            <ModalityIcon className="w-3 h-3 shrink-0" />
                            {s.modality}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-t3 shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Open escalations */}
            {openEscalations.length > 0 && (
              <div className="bg-surface rounded-xl border border-err-bdr overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-err-bdr bg-err-bg">
                  <h2 className="text-sm font-semibold text-err flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    Open escalations
                  </h2>
                  <span className="text-xs font-bold text-err bg-err text-white px-2 py-px rounded-full">
                    {openEscalations.length}
                  </span>
                </div>
                <div className="flex flex-col divide-y divide-bdr">
                  {openEscalations.map((flag) => {
                    const patient = roster.find((r) => r.patient.id === flag.patient_id)?.patient;
                    return (
                      <Link
                        key={flag.id}
                        href={`/${clinicId}/patients/${flag.patient_id}?tab=coaching`}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-page-bg transition-colors"
                      >
                        <span
                          className={`mt-0.5 text-[10px] font-bold px-1.5 py-px rounded shrink-0 ${
                            flag.severity === "high"
                              ? "bg-err text-white"
                              : flag.severity === "medium"
                              ? "bg-warn text-white"
                              : "bg-info text-white"
                          }`}
                        >
                          {flag.severity.toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-t1 truncate">
                            {patient?.demographic.full_name ?? flag.patient_id}
                          </p>
                          <p className="text-[11px] text-t2 line-clamp-2">{flag.description}</p>
                          <p className="text-[11px] text-t3 mt-0.5">
                            SLA: {format(parseISO(flag.sla_deadline), "d MMM · HH:mm")}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
