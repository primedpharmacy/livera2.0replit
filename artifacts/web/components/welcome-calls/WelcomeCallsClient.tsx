"use client";

import { useState } from "react";
import { Phone, PhoneOff, Check, AlertTriangle, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { WelcomeCall, WelcomeCallStatus, ClinicId } from "@/types";

const STATUS_CONFIG: Record<WelcomeCallStatus, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  awaiting:    { label: "Awaiting",    bg: "bg-warn-bg",  text: "text-warn",  border: "border-warn-bdr",  icon: Phone },
  attempted:   { label: "Attempted",   bg: "bg-info-bg",  text: "text-info",  border: "border-info-bdr",  icon: Phone },
  completed:   { label: "Completed",   bg: "bg-ok-bg",    text: "text-ok",    border: "border-ok-bdr",    icon: Check },
  unreachable: { label: "Unreachable", bg: "bg-err-bg",   text: "text-err",   border: "border-err-bdr",   icon: AlertTriangle },
};

type TabKey = "all" | WelcomeCallStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "awaiting",    label: "Awaiting" },
  { key: "attempted",   label: "Attempted" },
  { key: "completed",   label: "Completed" },
  { key: "unreachable", label: "Unreachable" },
];

function hoursAgo(iso: string, nowIso = "2026-05-11T08:00:00Z"): string {
  const h = Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 3600000);
  if (h < 24) return `${h}h since trigger`;
  const d = Math.floor(h / 24);
  return `${d}d since trigger`;
}

interface Props {
  calls: WelcomeCall[];
  patientNames: Record<string, string>;
  clinicId: ClinicId;
}

export function WelcomeCallsClient({ calls, patientNames, clinicId }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const filtered = activeTab === "all"
    ? calls
    : calls.filter((c) => c.status === activeTab);

  const tabCount = (key: TabKey) =>
    key === "all" ? calls.length : calls.filter((c) => c.status === key).length;

  return (
    <div className="px-6 py-5 flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        {TABS.map((tab) => {
          const count = tabCount(tab.key);
          const isErr = tab.key === "unreachable" && count > 0;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors",
                activeTab === tab.key
                  ? isErr ? "bg-err text-white" : "bg-brand text-white"
                  : "text-t2 hover:text-t1"
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-px rounded-full",
                  activeTab === tab.key ? "bg-white/20 text-white" : "bg-surface-2 text-t3"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              {["Call ID", "Patient", "Trigger", "Attempts", "Status", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-t3 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-t3">
                  No welcome calls in this view.
                </td>
              </tr>
            ) : (
              filtered.map((call) => {
                const sc = STATUS_CONFIG[call.status];
                const StatusIcon = sc.icon;
                const patientName = patientNames[call.patient_id] ?? call.patient_id;
                const initials = patientName.split(" ").map((p: string) => p[0]).join("").toUpperCase().slice(0, 2);
                const isUrgent = call.status === "unreachable" || call.status === "awaiting";

                return (
                  <tr
                    key={call.id}
                    onClick={() => router.push(`/${clinicId}/welcome-calls/${call.id}`)}
                    className={cn(
                      "border-b border-border last:border-0 hover:bg-surface-2 cursor-pointer transition-colors",
                      isUrgent && "bg-warn-bg/30"
                    )}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] text-t3 bg-surface-2 px-2 py-0.5 rounded">
                        {call.id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                          {initials}
                        </span>
                        <div>
                          <p className="text-[13px] font-medium text-t1">{patientName}</p>
                          <p className="text-[11px] text-t3 font-mono">{call.patient_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[12px] text-t2">{hoursAgo(call.triggered_at)}</p>
                      <p className="text-[11px] text-t3 mt-0.5">{call.order_id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-semibold text-t1">{call.attempts.length}</span>
                      <span className="text-[11px] text-t3 ml-1">
                        {call.attempts.length === 1 ? "attempt" : "attempts"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border",
                        sc.bg, sc.text, sc.border
                      )}>
                        <StatusIcon className="w-3 h-3 shrink-0" />
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-t3" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
