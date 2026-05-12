"use client";

import { useState, useMemo } from "react";
import { Stethoscope, AlertTriangle } from "lucide-react";
import { OrderListTable } from "@/components/orders/OrderListTable";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Order, Clinic } from "@/types";

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
  clinicId: string;
}

export function ClinicalCheckClient({ orders, clinic, clinicId }: ClinicalCheckClientProps) {
  const [activeTab, setActiveTab] = useState<SubTab>("all");

  const now = Date.now();

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
      <div className="px-6 py-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No orders in this filter"
            description="Try switching to a different sub-tab."
          />
        ) : (
          <OrderListTable orders={filtered} clinicId={clinicId} clinic={clinic} />
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
