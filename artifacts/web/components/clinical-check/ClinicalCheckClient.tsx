"use client";

import { useState, useMemo } from "react";
import { Stethoscope, AlertTriangle } from "lucide-react";
import { OrderListTable } from "@/components/orders/OrderListTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { LatestCoachingLogCard } from "@/components/clinical-check/LatestCoachingLogCard";
import { SlaTimerWidget } from "@/components/sla/SlaTimerWidget";
import { NOW } from "@/lib/api/constants";
import type { Order, Clinic, CoachingLog, ClinicId } from "@/types";

type SubTab = "all" | "awaiting_photos" | "g6_flagged" | "reorders";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "all",             label: "All orders"      },
  { key: "awaiting_photos", label: "Awaiting Photos" },
  { key: "g6_flagged",      label: "G6 Flagged"      },
  { key: "reorders",        label: "Reorders"        },
];

interface ClinicalCheckClientProps {
  orders: Order[];
  clinic: Clinic;
  clinicId: ClinicId;
  // BLD-2.9 — coaching logs keyed by patient_id for Reorders sub-tab
  coachingLogsByPatientId?: Record<string, CoachingLog[]>;
  patientNames?: Record<string, string>;
}

export function ClinicalCheckClient({
  orders,
  clinic,
  clinicId,
  coachingLogsByPatientId,
  patientNames = {},
}: ClinicalCheckClientProps) {
  const [activeTab, setActiveTab] = useState<SubTab>("all");

  const now = new Date(NOW).getTime();

  const warnCount = orders.filter((o) => {
    const warnAt   = new Date(o.sla_warn_at).getTime();
    const breachAt = new Date(o.sla_breach_at).getTime();
    return now > warnAt && now <= breachAt;
  }).length;

  const breachCount = orders.filter(
    (o) => now > new Date(o.sla_breach_at).getTime()
  ).length;

  const tabCounts: Record<SubTab, number> = useMemo(() => ({
    all:             orders.length,
    awaiting_photos: orders.filter(
      (o) => "bmi_photo_url" in o.questionnaire_responses && !o.questionnaire_responses["bmi_photo_url"]
    ).length,
    g6_flagged: orders.filter((o) => o.g6_flags.length > 0).length,
    reorders:   orders.filter((o) => o.type === "reorder").length,
  }), [orders]);

  const filtered = useMemo(() => {
    if (activeTab === "all")             return orders;
    if (activeTab === "awaiting_photos") return orders.filter(
      (o) => "bmi_photo_url" in o.questionnaire_responses && !o.questionnaire_responses["bmi_photo_url"]
    );
    if (activeTab === "g6_flagged") return orders.filter((o) => o.g6_flags.length > 0);
    if (activeTab === "reorders")   return orders.filter((o) => o.type === "reorder");
    return orders;
  }, [orders, activeTab]);

  // ── BLD-2.9: unique patients with coaching logs in the current reorders set ──
  const reorderPatientsWithLogs = useMemo(() => {
    if (activeTab !== "reorders" || !coachingLogsByPatientId) return [];
    const seen = new Set<string>();
    const rows: { patientId: string; patientName: string; logs: CoachingLog[] }[] = [];
    for (const order of filtered) {
      const pid = order.patient_id;
      if (seen.has(pid)) continue;
      const logs = coachingLogsByPatientId[pid];
      if (logs && logs.length > 0) {
        seen.add(pid);
        rows.push({
          patientId: pid,
          patientName: patientNames[pid] ?? pid,
          logs,
        });
      }
    }
    return rows;
  }, [activeTab, filtered, coachingLogsByPatientId, patientNames]);

  return (
    <div>
      {/* SLA stats card */}
      <div className="px-6 py-4 border-b border-bdr bg-surface">
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            label="Total in queue"
            value={orders.length}
            variant="neutral"
          />
          <StatTile
            label={`Warning — within ${clinic.config.default_slas.approval_warn_hours}h`}
            value={warnCount}
            variant={warnCount > 0 ? "warn" : "neutral"}
          />
          <StatTile
            label={`Breached — past ${clinic.config.default_slas.approval_breach_hours}h`}
            value={breachCount}
            variant={breachCount > 0 ? "err" : "neutral"}
          />
        </div>

        {/* BLD-3.1 — SlaTimerWidget for most-urgent order in queue */}
        {(() => {
          const urgent = [...orders]
            .filter((o) => o.status === "clinical_check")
            .sort((a, b) => a.sla_breach_at.localeCompare(b.sla_breach_at))[0];
          if (!urgent) return null;
          return (
            <div className="mt-3">
              <SlaTimerWidget
                sla_deadline={urgent.sla_breach_at}
                sla_warn_at={urgent.sla_warn_at}
                label={`Next breach — ${urgent.id}`}
                total_hours={clinic.config.default_slas.approval_breach_hours}
                variant="full"
              />
            </div>
          );
        })()}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center border-b border-bdr bg-surface px-6 overflow-x-auto">
        {SUB_TABS.filter((t) => t.key === "all" || tabCounts[t.key] > 0).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? "border-brand text-brand"
                : "border-transparent text-t2 hover:text-t1"
            }`}
          >
            {tab.label}
            <span className={`text-[10px] font-bold tabular-nums ${activeTab === tab.key ? "opacity-80" : "opacity-50"}`}>
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="px-6 py-4 flex flex-col gap-4">
        {/* BLD-2.9 — coaching context cards above reorders table */}
        {reorderPatientsWithLogs.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-bold text-t3 uppercase tracking-wider">
              Coaching context for reorder patients
            </p>
            {reorderPatientsWithLogs.map(({ patientId, patientName, logs }) => (
              <LatestCoachingLogCard
                key={patientId}
                patientId={patientId}
                patientName={patientName}
                clinicId={clinicId}
                logs={logs}
              />
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No orders in this filter"
            description="Try switching to a different sub-tab."
          />
        ) : (
          <OrderListTable orders={filtered} clinicId={clinicId} clinic={clinic} showQueueAge />
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "neutral" | "warn" | "err";
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3.5 flex items-center gap-3 ${
        variant === "err"  ? "bg-err-bg border-err-bdr"   :
        variant === "warn" ? "bg-warn-bg border-warn-bdr" :
        "bg-page-bg border-bdr"
      }`}
    >
      {variant !== "neutral" && (
        <AlertTriangle
          className={`w-5 h-5 shrink-0 ${variant === "err" ? "text-err" : "text-warn"}`}
        />
      )}
      <div>
        <div className={`text-[26px] font-bold tabular-nums leading-none ${
          variant === "err" ? "text-err" : variant === "warn" ? "text-warn" : "text-t1"
        }`}>
          {value}
        </div>
        <div className={`text-[11px] mt-0.5 leading-tight ${
          variant === "neutral" ? "text-t3" :
          variant === "err"     ? "text-err" :
          "text-warn"
        }`}>
          {label}
        </div>
      </div>
    </div>
  );
}
