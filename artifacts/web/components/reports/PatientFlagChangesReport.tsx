"use client";

/**
 * PatientFlagChangesReport — Task-226
 *
 * Cross-patient audit/activity view for the VIP / status / coach
 * breadcrumbs already surfaced per-patient (task-150). Compliance
 * reviewers wanted a single global "who changed what, when" view to
 * sit alongside the other AUD-1x reports.
 *
 * Source: PATIENT_FLAG_CHANGES fixture (`patient_vip_updated`,
 * `patient_status_updated`, `patient_coach_updated`). Filterable by
 * actor and date range; each row links back to the affected patient.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity, Star, UserCog, Download, ExternalLink, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PatientFlagChange, PatientFlagChangeKind } from "@/lib/api/mock";

type PatientRef = { id: string; full_name: string };

interface Props {
  clinicId: string;
  changes: PatientFlagChange[];
  patients: PatientRef[];
}

const KIND_META: Record<PatientFlagChangeKind, {
  label: string;
  event: string;
  Icon: React.ElementType;
  badge: string;
}> = {
  vip: {
    label: "VIP flag",
    event: "patient_vip_updated",
    Icon: Star,
    badge: "bg-warn-bg text-warn border-warn-bdr",
  },
  status: {
    label: "Patient status",
    event: "patient_status_updated",
    Icon: Activity,
    badge: "bg-info-bg text-info border-info-bdr",
  },
  coach: {
    label: "Coach",
    event: "patient_coach_updated",
    Icon: UserCog,
    badge: "bg-brand-light text-brand border-brand/20",
  },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function toCsv(rows: Array<PatientFlagChange & { patient_name: string }>): string {
  const header = [
    "id", "event", "changed_at", "patient_id", "patient_name",
    "previous_value", "new_value", "actor_id", "actor_name",
  ];
  const esc = (v: string) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) => [
    r.id,
    KIND_META[r.kind].event,
    r.changed_at,
    r.patient_id,
    r.patient_name,
    r.previous_display ?? r.previous_value,
    r.new_display ?? r.new_value,
    r.actor_id,
    r.actor_name,
  ].map(esc).join(","));
  return [header.join(","), ...lines].join("\n");
}

export function PatientFlagChangesReport({ clinicId, changes, patients }: Props) {
  const patientNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of patients) m.set(p.id, p.full_name);
    return m;
  }, [patients]);

  const actorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of changes) seen.set(c.actor_id, c.actor_name);
    return Array.from(seen, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [changes]);

  const [actorId, setActorId] = useState<string>("all");
  const [kind, setKind] = useState<"all" | PatientFlagChangeKind>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const filtered = useMemo(() => {
    return changes
      .filter((c) => actorId === "all" || c.actor_id === actorId)
      .filter((c) => kind === "all" || c.kind === kind)
      .filter((c) => {
        if (!fromDate) return true;
        return c.changed_at >= `${fromDate}T00:00:00Z`;
      })
      .filter((c) => {
        if (!toDate) return true;
        return c.changed_at <= `${toDate}T23:59:59Z`;
      })
      .map((c) => ({ ...c, patient_name: patientNameById.get(c.patient_id) ?? c.patient_id }))
      .sort((a, b) => b.changed_at.localeCompare(a.changed_at));
  }, [changes, actorId, kind, fromDate, toDate, patientNameById]);

  const onExport = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patient-flag-changes-${clinicId}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setActorId("all");
    setKind("all");
    setFromDate("");
    setToDate("");
  };

  const counts = useMemo(() => {
    const c = { vip: 0, status: 0, coach: 0 };
    for (const r of filtered) c[r.kind]++;
    return c;
  }, [filtered]);

  return (
    <div className="p-6 space-y-5">
      {/* Filters + export */}
      <div className="bg-surface border border-bdr rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-bold text-t3 uppercase tracking-wider mb-1">
              Actor
            </label>
            <select
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              className="h-8 min-w-[180px] px-2 text-[12px] bg-page-bg border border-bdr rounded-md text-t1"
            >
              <option value="all">All actors</option>
              {actorOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-t3 uppercase tracking-wider mb-1">
              Event
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "all" | PatientFlagChangeKind)}
              className="h-8 min-w-[180px] px-2 text-[12px] bg-page-bg border border-bdr rounded-md text-t1"
            >
              <option value="all">All events</option>
              <option value="vip">patient_vip_updated</option>
              <option value="status">patient_status_updated</option>
              <option value="coach">patient_coach_updated</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-t3 uppercase tracking-wider mb-1">
              From
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 px-2 text-[12px] bg-page-bg border border-bdr rounded-md text-t1"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-t3 uppercase tracking-wider mb-1">
              To
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 px-2 text-[12px] bg-page-bg border border-bdr rounded-md text-t1"
            />
          </div>
          <button
            type="button"
            onClick={reset}
            className="h-8 px-3 text-[12px] font-semibold text-t2 bg-page-bg border border-bdr rounded-md hover:bg-surface"
          >
            Reset
          </button>
          <div className="ml-auto flex items-end gap-2">
            <button
              type="button"
              onClick={onExport}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-t2 bg-surface border border-bdr rounded-md hover:bg-page-bg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-t3 mt-3 pt-3 border-t border-bdr">
          <span className="font-semibold text-t2">{filtered.length} event{filtered.length === 1 ? "" : "s"}</span>
          <span className="inline-flex items-center gap-1"><Star className="w-3 h-3 text-warn" /> VIP · {counts.vip}</span>
          <span className="inline-flex items-center gap-1"><Activity className="w-3 h-3 text-info" /> Status · {counts.status}</span>
          <span className="inline-flex items-center gap-1"><UserCog className="w-3 h-3 text-brand" /> Coach · {counts.coach}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-bdr">
          <History className="w-3.5 h-3.5 text-brand" />
          <p className="text-[11px] font-bold text-t3 uppercase tracking-wider">
            Patient flag changes
          </p>
          <span className="text-[10px] text-t3 ml-auto">
            Source: patient_vip_updated · patient_status_updated · patient_coach_updated
          </span>
        </div>

        {filtered.length === 0 ? (
          <p className="p-6 text-center text-[12px] text-t3">
            No patient flag changes match the current filters.
          </p>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-page-bg border-b border-bdr">
              <tr>
                <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">When</th>
                <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Event</th>
                <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Patient</th>
                <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Change</th>
                <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Actor</th>
                <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bdr">
              {filtered.map((r) => {
                const meta = KIND_META[r.kind];
                const Icon = meta.Icon;
                const prev = r.previous_display ?? r.previous_value;
                const next = r.new_display ?? r.new_value;
                return (
                  <tr key={r.id} className="hover:bg-page-bg/60 transition-colors">
                    <td className="py-2.5 px-3 text-t2 tabular-nums whitespace-nowrap">
                      {formatDateTime(r.changed_at)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border",
                        meta.badge,
                      )}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <Link
                        href={`/${clinicId}/patients/${r.patient_id}`}
                        className="inline-flex items-center gap-1 text-brand font-semibold hover:underline"
                      >
                        {r.patient_name}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <p className="text-[10px] text-t3 font-mono">{r.patient_id}</p>
                    </td>
                    <td className="py-2.5 px-3 text-t2">
                      <span className="font-semibold text-t1">{prev}</span>
                      <span className="text-t3"> → </span>
                      <span className="font-semibold text-t1">{next}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="text-t1 font-semibold">{r.actor_name}</p>
                      <p className="text-[10px] text-t3 font-mono">{r.actor_id}</p>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-t3">{r.id}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
