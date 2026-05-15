"use client";

import { useState, useMemo } from "react";
import { Stethoscope, Flag, CreditCard, Scale, FileText, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { OrderListTable } from "@/components/orders/OrderListTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { LatestCoachingLogCard } from "@/components/clinical-check/LatestCoachingLogCard";
import { NOW } from "@/lib/api/constants";
import { cn } from "@/lib/utils";
import type { Order, Clinic, CoachingLog, ClinicId } from "@/types";

// ── Sub-queue tabs ─────────────────────────────────────────────────────────────

type SubQueue = "all" | "awaiting_id" | "awaiting_bmi" | "awaiting_rx";

const SUB_QUEUES: {
  value: SubQueue;
  label: string;
  flag: string | null;
  icon: LucideIcon;
  banner: { text: string; action: string };
}[] = [
  {
    value: "all",
    label: "All",
    flag: null,
    icon: Stethoscope,
    banner: { text: "", action: "" },
  },
  {
    value: "awaiting_id",
    label: "Awaiting ID",
    flag: "Awaiting ID",
    icon: CreditCard,
    banner: {
      text: "These orders are blocked pending patient identity verification.",
      action: "Review SumSub result on the patient profile and mark ID as verified before approving.",
    },
  },
  {
    value: "awaiting_bmi",
    label: "Awaiting BMI",
    flag: "Awaiting BMI",
    icon: Scale,
    banner: {
      text: "These orders are blocked pending a verified BMI submission.",
      action: "Review the patient's photo evidence and confirm BMI before proceeding to clinical decision.",
    },
  },
  {
    value: "awaiting_rx",
    label: "Awaiting Rx evidence",
    flag: "Awaiting Rx evidence",
    icon: FileText,
    banner: {
      text: "These orders are blocked pending prescription or prior authorisation evidence.",
      action: "Request the supporting document from the patient or GP before approving.",
    },
  },
];

// ── Medication filter chips (secondary, within the selected sub-queue) ─────────

type FilterChip = "all" | "flagged" | "mounjaro" | "wegovy" | "dose_increase";

const CHIPS: { value: FilterChip; label: string }[] = [
  { value: "all",          label: "All orders"    },
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
  const [subQueue,   setSubQueue]   = useState<SubQueue>("all");
  const [activeChip, setActiveChip] = useState<FilterChip>("all");
  const now = new Date(NOW).getTime();

  // ── KPI tiles (always over the full queue) ────────────────────────────────
  const { under4, btw4to8, over8, flaggedCount } = useMemo(() => {
    let u4 = 0, b48 = 0, o8 = 0, fl = 0;
    for (const o of orders) {
      const hrs = (now - new Date(o.created_at).getTime()) / 3_600_000;
      if (hrs < 4)      u4++;
      else if (hrs < 8) b48++;
      else              o8++;
      if (o.g6_flags.length > 0 || (o.contextual_flags ?? []).length > 0) fl++;
    }
    return { under4: u4, btw4to8: b48, over8: o8, flaggedCount: fl };
  }, [orders, now]);

  // ── Sub-queue counts ─────────────────────────────────────────────────────
  const subQueueCounts = useMemo<Record<SubQueue, number>>(() => {
    const counts: Record<SubQueue, number> = {
      all: orders.length, awaiting_id: 0, awaiting_bmi: 0, awaiting_rx: 0,
    };
    for (const o of orders) {
      const flags = o.contextual_flags ?? [];
      if (flags.includes("Awaiting ID"))          counts.awaiting_id++;
      if (flags.includes("Awaiting BMI"))         counts.awaiting_bmi++;
      if (flags.includes("Awaiting Rx evidence")) counts.awaiting_rx++;
    }
    return counts;
  }, [orders]);

  // ── Step 1: sub-queue filter ──────────────────────────────────────────────
  const subFiltered = useMemo(() => {
    const sq = SUB_QUEUES.find((s) => s.value === subQueue)!;
    if (!sq.flag) return orders;
    return orders.filter((o) => (o.contextual_flags ?? []).includes(sq.flag!));
  }, [orders, subQueue]);

  // ── Step 2: chip filter (within sub-queue) ────────────────────────────────
  const filtered = useMemo(() => {
    switch (activeChip) {
      case "flagged":
        return subFiltered.filter(
          (o) => o.g6_flags.length > 0 || (o.contextual_flags ?? []).length > 0
        );
      case "mounjaro":
        return subFiltered.filter((o) => o.product.medication.toLowerCase() === "mounjaro");
      case "wegovy":
        return subFiltered.filter((o) => o.product.medication.toLowerCase() === "wegovy");
      case "dose_increase":
        return subFiltered.filter((o) => o.contextual_flags?.includes("Dose increase"));
      default:
        return subFiltered;
    }
  }, [subFiltered, activeChip]);

  // ── Coaching cards (only in "all" sub-queue) ──────────────────────────────
  const coachingCards = useMemo(() => {
    if (subQueue !== "all" || activeChip !== "all" || !coachingLogsByPatientId) return [];
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
  }, [subQueue, activeChip, filtered, coachingLogsByPatientId, patientNames]);

  const activeSQ = SUB_QUEUES.find((s) => s.value === subQueue)!;

  function handleSubQueueChange(sq: SubQueue) {
    setSubQueue(sq);
    setActiveChip("all");
  }

  return (
    <div>
      {/* ── KPI tiles ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-bdr bg-surface">
        <div className="flex items-start gap-3">
          <div className="grid grid-cols-4 gap-3 flex-1">
            <BucketTile label="Total in queue" value={orders.length} variant="neutral" />
            <BucketTile label="Under 4h"        value={under4}        variant="ok"      />
            <BucketTile label="4 – 8h"           value={btw4to8}       variant="warn"    />
            <BucketTile label="Over 8h"          value={over8}         variant="err"     />
          </div>
          {flaggedCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] self-center shrink-0">
              <Flag className="w-3.5 h-3.5 text-[#dc2626]" />
              <span className="text-[13px] font-bold text-[#dc2626] tabular-nums">{flaggedCount}</span>
              <span className="text-[11px] text-[#b91c1c]">Flagged orders</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Sub-queue tab bar ──────────────────────────────────────────────── */}
      <div className="px-6 border-b border-bdr bg-surface">
        <div className="flex items-end gap-0 -mb-px">
          {SUB_QUEUES.map((sq) => {
            const isActive = subQueue === sq.value;
            const count    = subQueueCounts[sq.value];
            const Icon     = sq.icon;
            const hasItems = sq.value === "all" ? true : count > 0;
            return (
              <button
                key={sq.value}
                onClick={() => handleSubQueueChange(sq.value)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-brand text-brand"
                    : "border-transparent text-t2 hover:text-t1 hover:border-bdr"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", isActive ? "text-brand" : "text-t3")} />
                {sq.label}
                {sq.value !== "all" && (
                  <span className={cn(
                    "text-[11px] font-bold px-1.5 py-0.5 rounded-full tabular-nums min-w-[20px] text-center",
                    isActive
                      ? "bg-brand text-white"
                      : count > 0
                        ? "bg-warn-bg text-warn border border-warn-bdr"
                        : "bg-page-bg text-t3 border border-bdr"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Sub-queue info banner (when not on "all") ─────────────────────── */}
      {subQueue !== "all" && activeSQ.banner.text && (
        <div className="mx-6 mt-4 flex items-start gap-3 bg-info-bg border border-info-bdr rounded-lg px-4 py-3">
          <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] text-info font-medium">{activeSQ.banner.text}</p>
            <p className="text-[12px] text-info/80 mt-0.5">{activeSQ.banner.action}</p>
          </div>
        </div>
      )}

      {/* ── Filter chips ───────────────────────────────────────────────────── */}
      <div className="px-6 py-2.5 border-b border-bdr bg-surface flex items-center justify-between gap-3 flex-wrap mt-4">
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
          {filtered.length} order{filtered.length !== 1 ? "s" : ""} · Sort: Waiting (oldest first)
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
            icon={activeSQ.icon}
            title={
              subQueue === "all"
                ? "No orders in this filter"
                : `No orders ${activeSQ.label.toLowerCase()}`
            }
            description={
              subQueue === "all"
                ? "Try a different filter chip."
                : "All orders in this sub-queue have been resolved."
            }
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
    variant === "err"  ? "bg-err-bg  border-err-bdr"  :
    variant === "warn" ? "bg-warn-bg border-warn-bdr"  :
    variant === "ok"   ? "bg-ok-bg   border-ok-bdr"    :
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
