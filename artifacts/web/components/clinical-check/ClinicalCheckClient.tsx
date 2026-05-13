"use client";

import { useState, useMemo } from "react";
import { Stethoscope, Flag } from "lucide-react";
import { OrderListTable } from "@/components/orders/OrderListTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { LatestCoachingLogCard } from "@/components/clinical-check/LatestCoachingLogCard";
import { NOW } from "@/lib/api/constants";
import { cn } from "@/lib/utils";
import type { Order, Clinic, CoachingLog, ClinicId } from "@/types";

type FilterChip = "all" | "flagged" | "mounjaro" | "wegovy" | "dose_increase";

const CHIPS: { value: FilterChip; label: string }[] = [
  { value: "all",          label: "All orders"   },
  { value: "flagged",      label: "Flagged only"  },
  { value: "mounjaro",     label: "Mounjaro"      },
  { value: "wegovy",       label: "Wegovy"        },
  { value: "dose_increase",label: "Dose increase" },
];

interface ClinicalCheckClientProps {
  orders: Order[];
  clinic: Clinic;
  clinicId: ClinicId;
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
  const [activeChip, setActiveChip] = useState<FilterChip>("all");
  const now = new Date(NOW).getTime();

  // ── KPI bucket counts (absolute wait time) ────────────────────────────────
  const { under4, btw4to8, over8, flaggedCount } = useMemo(() => {
    let u4 = 0, b48 = 0, o8 = 0, fl = 0;
    for (const o of orders) {
      const hrs = (now - new Date(o.created_at).getTime()) / 3_600_000;
      if (hrs < 4)        u4++;
      else if (hrs < 8)   b48++;
      else                o8++;
      if (o.g6_flags.length > 0 || (o.contextual_flags ?? []).length > 0) fl++;
    }
    return { under4: u4, btw4to8: b48, over8: o8, flaggedCount: fl };
  }, [orders, now]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    switch (activeChip) {
      case "flagged":
        return orders.filter(
          (o) => o.g6_flags.length > 0 || (o.contextual_flags ?? []).length > 0
        );
      case "mounjaro":
        return orders.filter((o) => o.product.medication.toLowerCase() === "mounjaro");
      case "wegovy":
        return orders.filter((o) => o.product.medication.toLowerCase() === "wegovy");
      case "dose_increase":
        return orders.filter((o) => o.contextual_flags?.includes("Dose increase"));
      default:
        return orders;
    }
  }, [orders, activeChip]);

  // ── Coaching context (shown in "all" mode for reorder patients with logs) ─
  const coachingCards = useMemo(() => {
    if (activeChip !== "all" || !coachingLogsByPatientId) return [];
    const seen = new Set<string>();
    const rows: { patientId: string; patientName: string; logs: CoachingLog[] }[] = [];
    for (const order of filtered.filter((o) => o.type === "reorder")) {
      const pid = order.patient_id;
      if (seen.has(pid)) continue;
      const logs = coachingLogsByPatientId[pid];
      if (logs?.length) {
        seen.add(pid);
        rows.push({ patientId: pid, patientName: patientNames[pid] ?? pid, logs });
      }
    }
    return rows;
  }, [activeChip, filtered, coachingLogsByPatientId, patientNames]);

  return (
    <div>
      {/* ── KPI tiles ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-bdr bg-surface">
        <div className="flex items-start gap-3">
          {/* Bucket tiles */}
          <div className="grid grid-cols-4 gap-3 flex-1">
            <BucketTile label="Total in queue" value={orders.length} variant="neutral" />
            <BucketTile label="Under 4h"       value={under4}        variant="ok"     />
            <BucketTile label="4 – 8h"          value={btw4to8}       variant="warn"   />
            <BucketTile label="Over 8h"         value={over8}         variant="err"    />
          </div>
          {/* Flagged orders badge */}
          {flaggedCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] self-center shrink-0">
              <Flag className="w-3.5 h-3.5 text-[#dc2626]" />
              <span className="text-[13px] font-bold text-[#dc2626] tabular-nums">{flaggedCount}</span>
              <span className="text-[11px] text-[#b91c1c]">Flagged orders</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Filter chips + sort ────────────────────────────────────────────── */}
      <div className="px-6 py-2.5 border-b border-bdr bg-surface flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {CHIPS.map((chip) => {
            const active = activeChip === chip.value;
            return (
              <button
                key={chip.value}
                onClick={() => setActiveChip(chip.value)}
                className={cn(
                  "px-3 py-1 text-[12px] font-semibold rounded-full border transition-colors",
                  active
                    ? "bg-brand text-white border-brand"
                    : "bg-surface text-t2 border-bdr hover:border-brand hover:text-brand"
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <span className="text-[11px] text-t3 whitespace-nowrap">
          Sort: Waiting (oldest first)
        </span>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 flex flex-col gap-4">
        {coachingCards.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-bold text-t3 uppercase tracking-wider">
              Coaching context for reorder patients
            </p>
            {coachingCards.map(({ patientId, patientName, logs }) => (
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
            description="Try a different filter chip."
          />
        ) : (
          <OrderListTable
            orders={filtered}
            clinicId={clinicId}
            clinic={clinic}
            patientNames={patientNames}
            context="clinical_check"
          />
        )}
      </div>
    </div>
  );
}

// ── Bucket tile ───────────────────────────────────────────────────────────────
function BucketTile({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "neutral" | "ok" | "warn" | "err";
}) {
  const wrapCls =
    variant === "err"     ? "bg-err-bg  border-err-bdr"  :
    variant === "warn"    ? "bg-warn-bg border-warn-bdr" :
    variant === "ok"      ? "bg-ok-bg   border-ok-bdr"   :
    "bg-page-bg border-bdr";
  const numCls =
    variant === "err"  ? "text-err"  :
    variant === "warn" ? "text-warn" :
    variant === "ok"   ? "text-ok"   :
    "text-t1";
  const lblCls =
    variant === "err"  ? "text-err"  :
    variant === "warn" ? "text-warn" :
    variant === "ok"   ? "text-ok"   :
    "text-t3";

  return (
    <div className={cn("rounded-lg border px-4 py-3", wrapCls)}>
      <div className={cn("text-[26px] font-bold tabular-nums leading-none", numCls)}>
        {value}
      </div>
      <div className={cn("text-[11px] mt-0.5 leading-tight", lblCls)}>{label}</div>
    </div>
  );
}
