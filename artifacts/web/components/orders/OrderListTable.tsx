"use client";

/**
 * OrderListTable — gap-fix wave.
 *
 * context="orders"         — ORDER | PATIENT | TREATMENT | TYPE | STATUS | LAST UPDATE | ACTION
 * context="clinical_check" — PATIENT | WAITING | MEDICATION | ORDER TYPE | CLINICAL FLAGS | FLAGS | AI SUMMARY | ACTION
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { NOW } from "@/lib/api/constants";
import {
  groupFlaggedAnswersByCategory,
  SAFETY_CATEGORY_META,
  type FlaggedAnswer,
} from "@/lib/questionnaire";
import type { OrderWeightWarningState } from "@/lib/clinical/weightWarnings";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order, Clinic } from "@/types";

// ── Avatar helpers ────────────────────────────────────────────────────────────
const AVATAR_PALETTE = [
  "bg-[#4f46e5]", "bg-[#7c3aed]", "bg-[#0891b2]",
  "bg-[#059669]", "bg-[#d97706]", "bg-[#be185d]",
];
function avatarBg(pid: string) {
  const h = pid.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2
    ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ── Flag badge colours ────────────────────────────────────────────────────────
const FLAG_COLORS: Record<string, string> = {
  "Dose increase":             "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]",
  "Cardiac history":           "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
  "BMI 29.5":                  "bg-[#f9fafb] text-[#374151] border-[#d1d5db]",
  "Safeguarding":              "bg-[#fef2f2] text-[#991b1b] border-[#fca5a5]",
  "Eating disorder disclosed": "bg-[#fdf4ff] text-[#7e22ce] border-[#e9d5ff]",
  "Duplicate address":         "bg-[#f9fafb] text-[#374151] border-[#d1d5db]",
};
const URGENT_FLAGS = new Set(["Safeguarding", "Eating disorder disclosed"]);
const defaultFlagCls = "bg-[#f9fafb] text-[#374151] border-[#d1d5db]";

// ── Medication pill colours ───────────────────────────────────────────────────
const MED_COLORS: Record<string, string> = {
  mounjaro: "bg-[#eef2ff] text-[#4338ca] border-[#c7d2fe]",
  wegovy:   "bg-[#f5f3ff] text-[#6d28d9] border-[#ddd6fe]",
  ozempic:  "bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]",
};
function medPillCls(med: string) {
  return MED_COLORS[med.toLowerCase()] ?? "bg-[#f9fafb] text-[#374151] border-[#d1d5db]";
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface OrderListTableProps {
  orders: Order[];
  clinicId: string;
  clinic: Clinic;
  patientNames?: Record<string, string>;
  context?: "orders" | "clinical_check";
  /** @deprecated use context="clinical_check" */
  showQueueAge?: boolean;
  /** When provided in clinical_check context, clicking a row calls this instead of navigating */
  onRowClick?: (orderId: string) => void;
  /** Highlights the matching row as selected */
  selectedOrderId?: string;
  /**
   * Map of orderId → number of safety-flagged "yes" answers on that order's
   * questionnaire. Used by the Clinical Check queue to surface a "Review needed"
   * badge so prescribers can prioritise real safety concerns.
   */
  reviewNeededByOrderId?: Record<string, number>;
  /**
   * Map of orderId → list of safety-flagged questions + the patient's answers.
   * When supplied, hovering / focusing the "N review needed" badge shows a
   * popover with this list so clinicians can triage low-signal cases without
   * opening the slide-over.
   */
  flaggedAnswersByOrderId?: Record<string, FlaggedAnswer[]>;
  /**
   * Called when a clinician clicks the "N review needed" badge on a row.
   * Lets the parent open the slide-over AND jump straight to the first
   * flagged questionnaire answer.
   */
  onJumpToFlagged?: (orderId: string) => void;
  /**
   * Task-136 — Per-order weight-warning summary keyed by order id. Used to
   * render a subtle "reviewed" indicator when all concerning weight warnings
   * on an order have been acknowledged, and to surface remaining unack'd
   * warnings on the row.
   */
  weightWarningStateByOrderId?: Record<string, OrderWeightWarningState>;
}

export function OrderListTable({
  orders,
  clinicId,
  clinic,
  patientNames = {},
  context,
  showQueueAge,
  onRowClick,
  selectedOrderId,
  reviewNeededByOrderId,
  flaggedAnswersByOrderId,
  onJumpToFlagged,
  weightWarningStateByOrderId,
}: OrderListTableProps) {
  const router = useRouter();
  const now = new Date(NOW).getTime();

  // back-compat: showQueueAge was the old "clinical check mode" flag
  const isClinicalCheck = context === "clinical_check" || showQueueAge;

  const rows = useMemo(() => orders.map((order, idx) => {
    const name = patientNames[order.patient_id] ?? order.patient_id;
    const ctxFlags = order.contextual_flags ?? [];
    const isUrgent = ctxFlags.some((f) => URGENT_FLAGS.has(f));
    const hasClinicalFlags = order.g6_flags.length > 0 || ctxFlags.length > 0;

    let rowCls = "";
    if (isClinicalCheck) {
      rowCls = isUrgent
        ? "bg-[#fef2f2] hover:bg-[#fde8e8]"
        : hasClinicalFlags
        ? "bg-[#fef9f0] hover:bg-[#fef3e0]"
        : "hover:bg-brand-light";
    } else {
      // SLA tinting for orders context
      if (order.status === "clinical_check") {
        const warnAt   = new Date(order.sla_warn_at).getTime();
        const breachAt = new Date(order.sla_breach_at).getTime();
        if (now > breachAt)    rowCls = "bg-err-bg hover:bg-err-bg";
        else if (now > warnAt) rowCls = "bg-warn-bg hover:bg-warn-bg";
        else                   rowCls = "hover:bg-brand-light";
      } else {
        rowCls = "hover:bg-brand-light";
      }
    }

    // AI summary mock — even index = Ready, odd = Generating (stable per order position)
    const aiReady = idx % 2 === 0;

    // Queue age
    const elapsedMs    = now - new Date(order.created_at).getTime();
    const elapsedHours = elapsedMs / 3_600_000;
    const totalMins    = Math.floor(elapsedMs / 60_000);
    const hrs          = Math.floor(totalMins / 60);
    const mins         = totalMins % 60;
    const ageLabel     = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    const warnH  = clinic.config.default_slas.approval_warn_hours;
    const breachH = clinic.config.default_slas.approval_breach_hours;
    const ageVariant: "ok" | "warn" | "err" =
      elapsedHours >= breachH ? "err"  :
      elapsedHours >= warnH   ? "warn" : "ok";

    return { order, name, ctxFlags, isUrgent, rowCls, aiReady, ageLabel, ageVariant };
  }), [orders, patientNames, isClinicalCheck, now, clinic]);

  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-page-bg hover:bg-page-bg border-bdr">
            {isClinicalCheck ? (
              <>
                <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5 w-[220px]">Patient</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5 w-[90px]">Waiting</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5 w-[130px]">Medication</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5 w-[100px]">Order type</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5 w-[110px]">Clinical flags</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Flags</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5 w-[120px]">AI summary</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5 w-[130px] text-right">Action</TableHead>
              </>
            ) : (
              <>
                <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5 w-[130px]">Order</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5 w-[200px]">Patient</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Treatment</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5 w-[90px]">Type</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5 w-[150px]">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5 w-[100px]">Last update</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5 w-[110px] text-right">Action</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ order, name, ctxFlags, isUrgent, rowCls, aiReady, ageLabel, ageVariant }) => {
            const isSelected = order.id === selectedOrderId;
            const baseRowCls = isSelected ? "bg-brand-light hover:bg-brand-light" : rowCls;
            const handleClick = isClinicalCheck && onRowClick
              ? () => onRowClick(order.id)
              : () => router.push(`/${clinicId}/orders/${order.id}`);
            return (
              <TableRow
                key={order.id}
                className={cn("cursor-pointer border-bdr transition-colors", baseRowCls)}
                onClick={handleClick}
              >
                {isClinicalCheck ? (
                  <ClinicalCheckRow
                    order={order}
                    name={name}
                    ctxFlags={ctxFlags}
                    isUrgent={isUrgent}
                    ageLabel={ageLabel}
                    ageVariant={ageVariant}
                    aiReady={aiReady}
                    clinicId={clinicId}
                    onRowClick={onRowClick}
                    isSelected={isSelected}
                    reviewNeededCount={reviewNeededByOrderId?.[order.id] ?? 0}
                    flaggedAnswers={flaggedAnswersByOrderId?.[order.id]}
                    onJumpToFlagged={onJumpToFlagged}
                    weightWarningState={weightWarningStateByOrderId?.[order.id]}
                  />
                ) : (
                  <OrdersRow order={order} name={name} ctxFlags={ctxFlags} now={new Date(NOW).getTime()} clinicId={clinicId} />
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Orders row ────────────────────────────────────────────────────────────────
function OrdersRow({
  order,
  name,
  now,
  clinicId,
}: {
  order: Order;
  name: string;
  ctxFlags: string[];
  now: number;
  clinicId: string;
}) {
  const router = useRouter();
  const typeLabel = order.type === "reorder" ? "Reorder" : "First order";
  const updatedAt = (order as Record<string, unknown>)["updated_at"] as string | undefined;
  const lastUpdate = formatRelativeTime(updatedAt ?? order.created_at);

  return (
    <>
      {/* ORDER */}
      <TableCell className="py-3">
        <div className="font-mono text-[12px] font-semibold text-t1">{order.id}</div>
        <div className="text-[11px] text-t3 mt-0.5">{typeLabel}</div>
      </TableCell>
      {/* PATIENT */}
      <TableCell className="py-3">
        <div className="flex items-center gap-2.5">
          <Avatar pid={order.patient_id} name={name} size="sm" />
          <div>
            <div className="text-[12.5px] font-medium text-t1 leading-tight">{name}</div>
            <div className="text-[11px] text-t3 font-mono">{order.patient_id}</div>
          </div>
        </div>
      </TableCell>
      {/* TREATMENT */}
      <TableCell className="py-3">
        <div className="text-[12.5px] font-semibold text-t1">{order.product.medication}</div>
        <div className="text-[11px] text-t2">{order.product.dose}</div>
      </TableCell>
      {/* TYPE */}
      <TableCell className="py-3">
        <span className="text-[12px] text-t2">{typeLabel}</span>
      </TableCell>
      {/* STATUS */}
      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          <StatusBadge value={order.status} kind="order" />
          {order.g6_flags.length > 0 && (
            <span className="text-[9px] font-bold text-ok bg-ok-bg border border-ok-bdr px-1.5 py-px rounded">G6</span>
          )}
        </div>
      </TableCell>
      {/* LAST UPDATE */}
      <TableCell className="py-3">
        <LastUpdateCell order={order} now={now} lastUpdate={lastUpdate} />
      </TableCell>
      {/* ACTION */}
      <TableCell className="py-3 text-right">
        <ActionButton
          order={order}
          clinicId={clinicId}
          context="orders"
          isUrgent={false}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            router.push(`/${clinicId}/orders/${order.id}`);
          }}
        />
      </TableCell>
    </>
  );
}

// ── Clinical check row ────────────────────────────────────────────────────────
function ClinicalCheckRow({
  order,
  name,
  ctxFlags,
  isUrgent,
  ageLabel,
  ageVariant,
  aiReady,
  clinicId,
  onRowClick,
  isSelected,
  reviewNeededCount,
  flaggedAnswers,
  onJumpToFlagged,
  weightWarningState,
}: {
  order: Order;
  name: string;
  ctxFlags: string[];
  isUrgent: boolean;
  ageLabel: string;
  ageVariant: "ok" | "warn" | "err";
  aiReady: boolean;
  clinicId: string;
  onRowClick?: (orderId: string) => void;
  isSelected?: boolean;
  reviewNeededCount?: number;
  flaggedAnswers?: FlaggedAnswer[];
  onJumpToFlagged?: (orderId: string) => void;
  weightWarningState?: OrderWeightWarningState;
}) {
  const router = useRouter();
  const ageCls =
    ageVariant === "err"  ? "bg-err-bg  border-err-bdr  text-err"  :
    ageVariant === "warn" ? "bg-warn-bg border-warn-bdr text-warn" :
                            "bg-ok-bg   border-ok-bdr   text-ok";

  const typeLabel = order.type === "reorder" ? "Reorder" : "First order";

  return (
    <>
      {/* PATIENT */}
      <TableCell className="py-3">
        <div className="flex items-center gap-2.5">
          <Avatar pid={order.patient_id} name={name} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[12.5px] font-medium text-t1 leading-tight">{name}</span>
              {reviewNeededCount && reviewNeededCount > 0 ? (
                <ReviewNeededBadge
                  count={reviewNeededCount}
                  flaggedAnswers={flaggedAnswers}
                  onJump={onJumpToFlagged ? () => onJumpToFlagged(order.id) : undefined}
                />
              ) : null}
              {weightWarningState && weightWarningState.hasUnacknowledged ? (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-warn bg-warn-bg border border-warn-bdr rounded-full px-1.5 py-px leading-none"
                  title={`${weightWarningState.unacknowledged} concerning weight warning${weightWarningState.unacknowledged === 1 ? "" : "s"} pending review`}
                >
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {weightWarningState.unacknowledged} weight
                </span>
              ) : weightWarningState && weightWarningState.allAcknowledged ? (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-t3 bg-page-bg border border-bdr rounded-full px-1.5 py-px leading-none"
                  title={`All ${weightWarningState.total} weight warning${weightWarningState.total === 1 ? "" : "s"} acknowledged`}
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Weight reviewed
                </span>
              ) : null}
            </div>
            <div className="text-[11px] text-t3 font-mono">{order.patient_id} · {order.id}</div>
          </div>
        </div>
      </TableCell>
      {/* WAITING */}
      <TableCell className="py-3">
        {order.status === "clinical_check" ? (
          <span className={cn("inline-flex items-center text-[11px] font-semibold border rounded-full px-2 py-0.5", ageCls)}>
            {ageLabel}
          </span>
        ) : (
          <span className="text-[11px] text-t3">—</span>
        )}
      </TableCell>
      {/* MEDICATION */}
      <TableCell className="py-3">
        <span className={cn("inline-flex items-center text-[11px] font-semibold border rounded px-2 py-0.5 mb-0.5", medPillCls(order.product.medication))}>
          {order.product.medication}
        </span>
        <div className="text-[11px] text-t2">{order.product.dose}</div>
      </TableCell>
      {/* ORDER TYPE */}
      <TableCell className="py-3">
        <span className="text-[12px] text-t2">{typeLabel}</span>
      </TableCell>
      {/* CLINICAL FLAGS */}
      <TableCell className="py-3">
        {order.g6_flags.length > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-ok bg-ok-bg border border-ok-bdr px-1.5 py-px rounded">
                G6
              </span>
              <span className="text-[10px] text-t3 font-medium">{order.g6_flags.length}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {order.g6_flags.map((code) => (
                <span key={code} className="text-[10px] font-bold text-t2 bg-page-bg border border-bdr px-1.5 py-px rounded">
                  {code}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-[11px] text-t3">— None —</span>
        )}
      </TableCell>
      {/* FLAGS */}
      <TableCell className="py-3">
        {ctxFlags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {ctxFlags.map((f) => (
              <span key={f} className={cn("text-[10px] font-semibold border rounded-full px-2 py-0.5", FLAG_COLORS[f] ?? defaultFlagCls)}>
                {f}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-t3">No flags</span>
        )}
      </TableCell>
      {/* AI SUMMARY */}
      <TableCell className="py-3">
        {aiReady ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ok bg-ok-bg border border-ok-bdr rounded-full px-2 py-0.5">
            <span className="text-[10px]">+</span> Ready
          </span>
        ) : (
          <span className="text-[11px] text-t3 italic">Generating...</span>
        )}
      </TableCell>
      {/* ACTION */}
      <TableCell className="py-3 text-right">
        {onRowClick ? (
          <button
            onClick={(e) => { e.stopPropagation(); onRowClick(order.id); }}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors",
              isSelected
                ? "bg-brand text-white"
                : isUrgent
                ? "bg-err text-white hover:bg-err/90"
                : "bg-brand text-white hover:bg-brand/90"
            )}
          >
            {isSelected ? "Viewing" : isUrgent ? "Review urgently" : "Review"}
          </button>
        ) : (
          <ActionButton
            order={order}
            clinicId={clinicId}
            context="clinical_check"
            isUrgent={isUrgent}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              router.push(`/${clinicId}/orders/${order.id}`);
            }}
          />
        )}
      </TableCell>
    </>
  );
}

// ── Review-needed badge with hover/focus popover ──────────────────────────────
/**
 * "N review needed" badge. Hovering or keyboard-focusing it opens a small
 * popover listing each safety-flagged question + the patient's answer so
 * clinicians can triage low-signal cases without opening the slide-over.
 * Esc dismisses the popover (and restores focus). Clicking the badge still
 * jumps the parent to the first flagged answer in the slide-over.
 */
function ReviewNeededBadge({
  count,
  flaggedAnswers,
  onJump,
}: {
  count: number;
  flaggedAnswers?: FlaggedAnswer[];
  onJump?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement | HTMLSpanElement | null>(null);
  const hasList = !!flaggedAnswers && flaggedAnswers.length > 0;

  // Esc dismisses; click outside dismisses.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        const t = triggerRef.current;
        if (t && "focus" in t) (t as HTMLElement).focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const fallbackTitle = `${count} safety-flagged "yes" answer${count === 1 ? "" : "s"} on the questionnaire`;
  const badgeCls =
    "inline-flex items-center gap-1 text-[10px] font-bold text-warn bg-warn-bg border border-warn-bdr rounded-full px-1.5 py-px leading-none transition-colors";

  const trigger = onJump ? (
    <button
      ref={(el) => { triggerRef.current = el; }}
      type="button"
      onClick={(e) => { e.stopPropagation(); onJump(); }}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
      aria-label={fallbackTitle}
      aria-expanded={hasList ? open : undefined}
      title={hasList ? undefined : fallbackTitle}
      className={cn(badgeCls, "hover:bg-warn hover:text-white cursor-pointer")}
    >
      <AlertTriangle className="w-2.5 h-2.5" />
      {count} review needed
    </button>
  ) : (
    <span
      ref={(el) => { triggerRef.current = el; }}
      tabIndex={hasList ? 0 : -1}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
      aria-label={fallbackTitle}
      title={hasList ? undefined : fallbackTitle}
      className={badgeCls}
    >
      <AlertTriangle className="w-2.5 h-2.5" />
      {count} review needed
    </span>
  );

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex"
      onMouseEnter={() => hasList && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {trigger}
      {hasList && open && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full mt-1 z-50 w-72 max-w-[18rem] rounded-md border border-bdr bg-surface shadow-lg p-2.5 text-left"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1.5">
            Flagged answers ({flaggedAnswers!.length})
          </div>
          <div className="space-y-2">
            {groupFlaggedAnswersByCategory(flaggedAnswers!).map(({ category, items }) => {
              const meta = SAFETY_CATEGORY_META[category];
              return (
                <div key={category}>
                  <div
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-bold border rounded-full px-1.5 py-px leading-none mb-1",
                      meta.pillCls,
                    )}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full", meta.dotCls)} />
                    {meta.label} · {items.length}
                  </div>
                  <ul className="space-y-1 pl-1">
                    {items.map((f) => (
                      <li key={f.id} className="text-[11px] leading-snug">
                        <div className="text-t1 font-medium">{f.label}</div>
                        <div className="text-warn font-semibold mt-0.5">
                          Answered: {f.answer}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          {onJump && (
            <div className="text-[10px] text-t3 mt-2 pt-1.5 border-t border-bdr">
              Click the badge to jump to the first flagged answer.
            </div>
          )}
        </div>
      )}
    </span>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function Avatar({ pid, name, size }: { pid: string; name: string; size: "sm" | "md" }) {
  const bg = avatarBg(pid);
  const dim = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-[11px]";
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold text-white shrink-0", bg, dim)}>
      {initials(name)}
    </div>
  );
}

function LastUpdateCell({ order, now, lastUpdate }: { order: Order; now: number; lastUpdate: string }) {
  const breachAt = new Date(order.sla_breach_at).getTime();
  const warnAt   = new Date(order.sla_warn_at).getTime();
  const isUrgent  = order.status === "clinical_check" && now > breachAt;
  const isWarning = order.status === "clinical_check" && now > warnAt && now <= breachAt;

  return (
    <span className={cn(
      "text-[12px] tabular-nums",
      isUrgent ? "text-err font-bold" : isWarning ? "text-warn font-semibold" : "text-t2"
    )}>
      {lastUpdate}
    </span>
  );
}

function ActionButton({
  order,
  context,
  isUrgent,
  onClick,
}: {
  order: Order;
  clinicId: string;
  context: "orders" | "clinical_check";
  isUrgent: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  if (context === "clinical_check") {
    if (isUrgent) {
      return (
        <button
          onClick={onClick}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-md bg-err text-white hover:bg-err/90 transition-colors"
        >
          Review urgently
        </button>
      );
    }
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-md bg-brand text-white hover:bg-brand/90 transition-colors"
      >
        Review <span className="opacity-70">&#8594;</span>
      </button>
    );
  }

  // orders context — contextual by status
  const status = order.status;
  if (status === "clinical_check") {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-md bg-brand text-white hover:bg-brand/90 transition-colors"
      >
        Review <span className="opacity-70">&#8594;</span>
      </button>
    );
  }
  if (status === "dispatched" || status === "delivered") {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center px-3 py-1.5 text-[11px] font-semibold rounded-md border border-bdr bg-surface text-t1 hover:border-brand hover:text-brand transition-colors"
      >
        Track
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center px-3 py-1.5 text-[11px] font-semibold rounded-md border border-bdr bg-surface text-t1 hover:border-brand hover:text-brand transition-colors"
    >
      View
    </button>
  );
}
