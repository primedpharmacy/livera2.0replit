"use client";

import { useState } from "react";
import { format, parseISO, differenceInHours } from "date-fns";
import { Phone, ExternalLink, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Consultation, ClinicId } from "@/types";

const NOW = new Date("2026-05-12T08:00:00Z");
const SLA_HOURS = 48;

const STATUS_CONFIG: Record<
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

const CLINICIAN_LABELS: Record<string, string> = {
  user_claire: "Claire Moynehan",
  user_olwyn:  "Olwyn Price",
  user_qadir:  "Qadir Hussain",
  user_admin:  "Admin",
};

type TabStatus = "all" | Consultation["status"];

const TABS: { id: TabStatus; label: string }[] = [
  { id: "all",       label: "All" },
  { id: "scheduled", label: "Scheduled" },
  { id: "completed", label: "Completed" },
  { id: "no_show",   label: "No-show" },
];

interface Props {
  consultations: Consultation[];
  patientNames: Record<string, string>;
  clinicId: ClinicId;
}

function slaLabel(scheduledStart: string): { text: string; kind: "ok" | "warn" | "err" } {
  const start = parseISO(scheduledStart);
  const hoursUntil = differenceInHours(start, NOW);
  if (hoursUntil < 0) return { text: "SLA breach", kind: "err" };
  if (hoursUntil <= 12) return { text: `${hoursUntil}h left`, kind: "warn" };
  return { text: `${hoursUntil}h left`, kind: "ok" };
}

export function WelcomeCallsClient({ consultations, patientNames, clinicId }: Props) {
  const [activeTab, setActiveTab] = useState<TabStatus>("all");

  const scheduled  = consultations.filter((c) => c.status === "scheduled").length;
  const completed  = consultations.filter((c) => c.status === "completed").length;
  const noShows    = consultations.filter((c) => c.status === "no_show").length;
  const slaBreached = consultations.filter(
    (c) => c.status === "scheduled" && differenceInHours(parseISO(c.scheduled_start), NOW) < 0
  ).length;

  const kpis = [
    { label: "Scheduled",     value: scheduled,              sub: "upcoming",           alert: false },
    { label: "Completed",     value: completed,              sub: "all time",            alert: false },
    { label: "No-shows",      value: noShows,                sub: "missed calls",        alert: noShows > 0 },
    { label: "SLA breach",    value: slaBreached,            sub: `of ${SLA_HOURS}h`,    alert: slaBreached > 0 },
    { label: "Total",         value: consultations.length,   sub: "welcome calls",       alert: false },
  ];

  const filtered =
    activeTab === "all"
      ? consultations
      : consultations.filter((c) => c.status === activeTab);

  return (
    <div>
      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-px bg-bdr border-b border-bdr">
        {kpis.map((k) => (
          <div key={k.label} className={cn("bg-surface px-5 py-3.5 flex flex-col gap-1", k.alert && "bg-err-bg")}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-t2">{k.label}</span>
            <span className={cn("text-[22px] font-bold leading-none tabular-nums", k.alert ? "text-err" : "text-t1")}>
              {k.value}
            </span>
            <span className={cn("text-[10px] font-semibold", k.alert ? "text-err" : "text-t3")}>{k.sub}</span>
          </div>
        ))}
      </div>

      <div className="px-6 py-6 flex flex-col gap-4">
        <div className="flex items-center gap-1 bg-surface border border-bdr rounded-xl p-1 w-fit">
          {TABS.map((tab) => {
            const count =
              tab.id === "all"
                ? consultations.length
                : consultations.filter((c) => c.status === tab.id).length;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id ? "bg-brand text-white" : "text-t2 hover:text-t1"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-px rounded-full ${
                    activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-t3"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="bg-surface rounded-xl border border-bdr overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bdr bg-page-bg">
                <th className="text-left px-4 py-3 text-xs font-bold text-t2 uppercase tracking-wider">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-t2 uppercase tracking-wider">Date &amp; Time</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-t2 uppercase tracking-wider">Clinician</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-t2 uppercase tracking-wider">SLA</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-t2 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-t3">
                    No welcome calls in this view
                  </td>
                </tr>
              ) : (
                filtered
                  .sort((a, b) => b.scheduled_start.localeCompare(a.scheduled_start))
                  .map((c) => {
                    const statusCfg = STATUS_CONFIG[c.status];
                    const dt = parseISO(c.scheduled_start);
                    const sla = c.status === "scheduled" ? slaLabel(c.scheduled_start) : null;
                    return (
                      <tr key={c.id} className="border-b border-bdr last:border-0 hover:bg-page-bg transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-t1">{patientNames[c.patient_id] ?? c.patient_id}</p>
                          <p className="text-xs text-t3 font-mono">{c.patient_id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-t1">{format(dt, "EEE d MMM yyyy")}</p>
                          <p className="text-xs text-t2">
                            {format(dt, "HH:mm")} – {format(parseISO(c.scheduled_end), "HH:mm")} BST
                          </p>
                        </td>
                        <td className="px-4 py-3 text-t1">
                          {CLINICIAN_LABELS[c.clinician_id] ?? c.clinician_id}
                        </td>
                        <td className="px-4 py-3">
                          {sla ? (
                            <span className={cn(
                              "text-[11px] font-semibold",
                              sla.kind === "err" ? "text-err" : sla.kind === "warn" ? "text-warn" : "text-ok"
                            )}>
                              {sla.text}
                            </span>
                          ) : (
                            <span className="text-[11px] text-t3">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-px rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/${clinicId}/schedule/${c.id}`} className="flex items-center gap-1 text-xs text-brand hover:underline">
                            Open <ChevronRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
