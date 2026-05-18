"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Stethoscope, Flag, CreditCard, Scale, FileText, Info, AlertTriangle, CheckCircle, Undo2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { OrderListTable } from "@/components/orders/OrderListTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { LatestCoachingLogCard } from "@/components/clinical-check/LatestCoachingLogCard";
import { ClinicalCheckSlideOver } from "@/components/clinical-check/ClinicalCheckSlideOver";
import { NOW } from "@/lib/api/constants";
import { reverseDecision } from "@/lib/api/mock";
import { openOrderUndoWindow, clearOrderUndoWindow, ORDER_UNDO_WINDOW_MS } from "@/lib/orderUndo";
import {
  countReviewNeeded,
  listFlaggedAnswers,
  SAFETY_CATEGORIES,
  SAFETY_CATEGORY_META,
  type FlaggedAnswer,
} from "@/lib/questionnaire";
import type { SafetyCategory } from "@/types";
import {
  summariseOrderWeightWarnings,
  type OrderWeightWarningState,
} from "@/lib/clinical/weightWarnings";
import { computeReminderStatus } from "@/lib/clinical/pxUploadReminderStatus";
import { cn } from "@/lib/utils";
import { dispatchQueueCountChange } from "@/lib/queue-counts";
import type { Order, Clinic, CoachingLog, ClinicId } from "@/types";

type Decision = "approved" | "declined" | "queried";

const UNDO_WINDOW_MS = ORDER_UNDO_WINDOW_MS;

interface UndoToast {
  orderId: string;
  decision: Decision;
  snapshot: Order;
  expiresAt: number;
}

const DECISION_LABELS: Record<Decision, string> = {
  approved: "Order approved successfully.",
  declined: "Order declined — patient notified.",
  queried:  "Intervention raised — patient will be contacted.",
};

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

type FilterChip = "all" | "flagged" | "review_needed" | "weight_warning" | "reminder_bounced" | "mounjaro" | "wegovy" | "dose_increase";

const CHIPS: { value: FilterChip; label: string }[] = [
  { value: "all",              label: "All orders"        },
  { value: "flagged",          label: "Flagged only"      },
  { value: "review_needed",    label: "Review needed"     },
  { value: "weight_warning",   label: "Weight warning"    },
  { value: "reminder_bounced", label: "Reminder bounced"  },
  { value: "mounjaro",         label: "Mounjaro"          },
  { value: "wegovy",           label: "Wegovy"            },
  { value: "dose_increase",    label: "Dose increase"     },
];

interface ClinicalCheckClientProps {
  orders: Order[];
  clinic: Clinic;
  clinicId: ClinicId;
  coachingLogsByPatientId?: Record<string, CoachingLog[]>;
  patientNames?: Record<string, string>;
}

export function ClinicalCheckClient({
  orders: initialOrders,
  clinic,
  clinicId,
  coachingLogsByPatientId,
  patientNames = {},
}: ClinicalCheckClientProps) {
  const [subQueue,         setSubQueue]         = useState<SubQueue>("all");
  const [activeChip,       setActiveChip]       = useState<FilterChip>("all");
  // Task-256 — Multi-select category filter. Empty set means "no filter
  // applied" (all categories included). When non-empty, only orders with at
  // least one flagged answer in one of the selected categories survive.
  const [selectedCategories, setSelectedCategories] = useState<Set<SafetyCategory>>(
    () => new Set(),
  );
  const [selectedOrderId,  setSelectedOrderId]  = useState<string | null>(null);
  const [orders,           setOrders]           = useState<Order[]>(initialOrders);
  // Task-136 — Toggle to hide orders where every concerning weight warning has
  // already been acknowledged, so reviewers can focus on truly fresh cases.
  const [hideAckedWeightWarnings, setHideAckedWeightWarnings] = useState(false);
  const [undoToast,        setUndoToast]        = useState<UndoToast | null>(null);
  const [undoRemainingMs,  setUndoRemainingMs]  = useState(0);
  const [isUndoing,        setIsUndoing]        = useState(false);
  const [errorToast,       setErrorToast]       = useState<string | null>(null);
  // Bumped each time the clinician clicks a row's "N review needed" badge.
  // The slide-over watches this nonce to switch to the Questionnaire tab and
  // scroll/highlight the first safety-flagged answer.
  const [jumpFlaggedNonce, setJumpFlaggedNonce] = useState(0);
  const now = new Date(NOW).getTime();

  const handleRowClick = useCallback((orderId: string) => {
    setSelectedOrderId((prev) => (prev === orderId ? null : orderId));
  }, []);

  const handleJumpToFlagged = useCallback((orderId: string) => {
    setSelectedOrderId(orderId);
    setJumpFlaggedNonce((n) => n + 1);
  }, []);

  // Close slide-over on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedOrderId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredIdsRef = useRef<string[]>([]);

  const navigateOrder = useCallback((direction: 1 | -1) => {
    setSelectedOrderId((current) => {
      const ids = filteredIdsRef.current;
      if (ids.length === 0) return current;
      if (!current) return ids[0];
      const idx = ids.indexOf(current);
      if (idx === -1) return ids[0];
      const next = idx + direction;
      if (next < 0 || next >= ids.length) return current;
      return ids[next];
    });
  }, []);

  const handleDecisionMade = useCallback(
    (orderId: string, decision: Decision, snapshot: Order) => {
      setOrders((prev) => {
        const next = prev.filter((o) => o.id !== orderId);
        if (next.length !== prev.length) {
          dispatchQueueCountChange({ queue: "clinical_check", delta: -1, count: next.length });
        }
        return next;
      });
      setSelectedOrderId(null);
      const deadline = openOrderUndoWindow(orderId);
      setUndoToast({
        orderId,
        decision,
        snapshot,
        expiresAt: deadline,
      });
      setUndoRemainingMs(UNDO_WINDOW_MS);
    },
    []
  );

  // Countdown + auto-dismiss for the Undo toast.
  useEffect(() => {
    if (!undoToast) return;
    const tick = () => {
      const left = undoToast.expiresAt - Date.now();
      if (left <= 0) {
        clearOrderUndoWindow(undoToast.orderId);
        setUndoToast(null);
        setUndoRemainingMs(0);
      } else {
        setUndoRemainingMs(left);
      }
    };
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [undoToast]);

  // Auto-dismiss the error toast after 4s.
  useEffect(() => {
    if (!errorToast) return;
    const t = setTimeout(() => setErrorToast(null), 4000);
    return () => clearTimeout(t);
  }, [errorToast]);

  const handleUndo = useCallback(async () => {
    if (!undoToast || isUndoing) return;
    setIsUndoing(true);
    const { snapshot } = undoToast;
    try {
      await reverseDecision(clinicId, snapshot.id);  // quick-undo path (no reason)
      setOrders((prev) => {
        if (prev.some((o) => o.id === snapshot.id)) return prev;
        const restored: Order = {
          ...snapshot,
          status: "clinical_check",
          clinical_decision: null,
          intervention_raised_at: null,
        };
        const next = [...prev, restored];
        dispatchQueueCountChange({ queue: "clinical_check", delta: 1, count: next.length });
        return next;
      });
      clearOrderUndoWindow(snapshot.id);
      setUndoToast(null);
      setUndoRemainingMs(0);
    } catch (err) {
      setErrorToast(err instanceof Error ? err.message : "Undo failed. Please retry.");
    } finally {
      setIsUndoing(false);
    }
  }, [undoToast, isUndoing, clinicId]);

  // ── Review-needed counts + flagged answers per order ──────────────────────
  // The count drives the badge; the answer list drives the hover/focus popover
  // so clinicians can see *which* questions were flagged without opening the
  // slide-over.
  const { reviewNeededByOrderId, flaggedAnswersByOrderId } = useMemo<{
    reviewNeededByOrderId: Record<string, number>;
    flaggedAnswersByOrderId: Record<string, FlaggedAnswer[]>;
  }>(() => {
    const counts: Record<string, number> = {};
    const lists: Record<string, FlaggedAnswer[]> = {};
    for (const o of orders) {
      const config = o.type === "new"
        ? clinic.config.questionnaire_order
        : clinic.config.questionnaire_reorder;
      const flagged = listFlaggedAnswers(config, o.questionnaire_responses);
      if (flagged.length > 0) {
        counts[o.id] = flagged.length;
        lists[o.id] = flagged;
      }
    }
    return { reviewNeededByOrderId: counts, flaggedAnswersByOrderId: lists };
  }, [orders, clinic]);

  // Task-136 — Per-order weight-warning state. Used by the queue to:
  //   • show a subtle "weight reviewed" indicator on rows where every concerning
  //     warning has already been acknowledged,
  //   • optionally hide those orders entirely via the queue toggle,
  //   • boost urgency for orders that still have an unacknowledged warning.
  const weightWarningStateByOrderId = useMemo<Record<string, OrderWeightWarningState>>(() => {
    const out: Record<string, OrderWeightWarningState> = {};
    for (const o of orders) {
      const state = summariseOrderWeightWarnings(o, clinic.config.weight_warning_thresholds);
      if (state.total > 0) out[o.id] = state;
    }
    return out;
  }, [orders, clinic]);

  // ── KPI tiles (always over the full queue) ────────────────────────────────
  const { under4, btw4to8, over8, flaggedCount, reviewNeededTotal } = useMemo(() => {
    let u4 = 0, b48 = 0, o8 = 0, fl = 0, rn = 0;
    for (const o of orders) {
      const hrs = (now - new Date(o.created_at).getTime()) / 3_600_000;
      if (hrs < 4)      u4++;
      else if (hrs < 8) b48++;
      else              o8++;
      if (o.g6_flags.length > 0 || (o.contextual_flags ?? []).length > 0) fl++;
      if ((reviewNeededByOrderId[o.id] ?? 0) > 0) rn++;
    }
    return { under4: u4, btw4to8: b48, over8: o8, flaggedCount: fl, reviewNeededTotal: rn };
  }, [orders, now, reviewNeededByOrderId]);

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
    const base = sq.flag
      ? orders.filter((o) => (o.contextual_flags ?? []).includes(sq.flag!))
      : orders;
    // Task-136 — optional toggle to hide orders whose weight warnings have all
    // been acknowledged. Orders with no weight warnings at all are unaffected.
    if (!hideAckedWeightWarnings) return base;
    return base.filter((o) => {
      const state = weightWarningStateByOrderId[o.id];
      return !state || !state.allAcknowledged;
    });
  }, [orders, subQueue, hideAckedWeightWarnings, weightWarningStateByOrderId]);

  // Task-136 — Count of orders the "hide acknowledged" toggle would remove,
  // surfaced next to the toggle so reviewers know it's worth flipping on.
  const ackedWeightWarningCount = useMemo(() => {
    let n = 0;
    for (const o of orders) {
      if (weightWarningStateByOrderId[o.id]?.allAcknowledged) n++;
    }
    return n;
  }, [orders, weightWarningStateByOrderId]);

  // ── Step 1b: safety-category filter ───────────────────────────────────────
  // Task-256 — Prescribers triaging a busy queue can narrow to e.g. only
  // cardiac or safeguarding flags. We compute per-category counts from the
  // current sub-queue (post weight-warning toggle) so the chip numbers always
  // match what clicking the chip will actually surface.
  const categoryCountsInSub = useMemo<Record<SafetyCategory, number>>(() => {
    const counts = SAFETY_CATEGORIES.reduce(
      (acc, c) => ({ ...acc, [c]: 0 }),
      {} as Record<SafetyCategory, number>,
    );
    for (const o of subFiltered) {
      const flagged = flaggedAnswersByOrderId[o.id];
      if (!flagged?.length) continue;
      const seen = new Set<SafetyCategory>();
      for (const f of flagged) {
        if (seen.has(f.category)) continue;
        seen.add(f.category);
        counts[f.category]++;
      }
    }
    return counts;
  }, [subFiltered, flaggedAnswersByOrderId]);

  const categoryFiltered = useMemo(() => {
    if (selectedCategories.size === 0) return subFiltered;
    return subFiltered.filter((o) => {
      const flagged = flaggedAnswersByOrderId[o.id];
      if (!flagged?.length) return false;
      return flagged.some((f) => selectedCategories.has(f.category));
    });
  }, [subFiltered, selectedCategories, flaggedAnswersByOrderId]);

  const toggleCategory = useCallback((c: SafetyCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }, []);

  // ── Step 2: chip filter (within sub-queue) ────────────────────────────────
  // Orders with safety-flagged "yes" answers are surfaced to the top of the
  // queue so prescribers triage real safety concerns first, then we fall back
  // to oldest-first by created_at.
  const filtered = useMemo(() => {
    let list: Order[];
    switch (activeChip) {
      case "flagged":
        list = categoryFiltered.filter(
          (o) => o.g6_flags.length > 0 || (o.contextual_flags ?? []).length > 0
        );
        break;
      case "review_needed":
        list = categoryFiltered.filter((o) => (reviewNeededByOrderId[o.id] ?? 0) > 0);
        break;
      case "weight_warning":
        list = categoryFiltered.filter(
          (o) => (weightWarningStateByOrderId[o.id]?.unacknowledged ?? 0) > 0,
        );
        break;
      case "reminder_bounced":
        list = categoryFiltered.filter((o) => computeReminderStatus(o)?.state === "bounced");
        break;
      case "mounjaro":
        list = categoryFiltered.filter((o) => o.product.medication.toLowerCase() === "mounjaro");
        break;
      case "wegovy":
        list = categoryFiltered.filter((o) => o.product.medication.toLowerCase() === "wegovy");
        break;
      case "dose_increase":
        list = categoryFiltered.filter((o) => o.contextual_flags?.includes("Dose increase"));
        break;
      default:
        list = categoryFiltered;
    }
    return [...list].sort((a, b) => {
      // Task-136 — Urgency: orders with still-unacknowledged weight warnings
      // bubble above orders whose warnings have all been reviewed. Then by
      // questionnaire review-needed count, then oldest first.
      const wa = weightWarningStateByOrderId[a.id]?.unacknowledged ?? 0;
      const wb = weightWarningStateByOrderId[b.id]?.unacknowledged ?? 0;
      if (wa !== wb) return wb - wa;
      const ra = reviewNeededByOrderId[a.id] ?? 0;
      const rb = reviewNeededByOrderId[b.id] ?? 0;
      if (ra !== rb) return rb - ra;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [categoryFiltered, activeChip, reviewNeededByOrderId, weightWarningStateByOrderId]);

  // Keep ref in sync with filtered order ids for keyboard navigation
  useEffect(() => {
    filteredIdsRef.current = filtered.map((o) => o.id);
  }, [filtered]);

  // ── Coaching cards (only in "all" sub-queue) ──────────────────────────────
  const coachingCards = useMemo(() => {
    if (subQueue !== "all" || activeChip !== "all" || selectedCategories.size > 0 || !coachingLogsByPatientId) return [];
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
  }, [subQueue, activeChip, selectedCategories, filtered, coachingLogsByPatientId, patientNames]);

  const activeSQ = SUB_QUEUES.find((s) => s.value === subQueue)!;

  function handleSubQueueChange(sq: SubQueue) {
    setSubQueue(sq);
    setActiveChip("all");
  }

  const selectedOrder = selectedOrderId
    ? orders.find((o) => o.id === selectedOrderId) ?? null
    : null;

  return (
    <div className="flex flex-col min-h-0">
      {/* ── KPI tiles ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-bdr bg-surface shrink-0">
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
          {reviewNeededTotal > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-warn-bdr bg-warn-bg self-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-warn" />
              <span className="text-[13px] font-bold text-warn tabular-nums">{reviewNeededTotal}</span>
              <span className="text-[11px] text-warn">Need review</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Sub-queue tab bar ──────────────────────────────────────────────── */}
      <div className="px-6 border-b border-bdr bg-surface shrink-0">
        <div className="flex items-end gap-0 -mb-px">
          {SUB_QUEUES.map((sq) => {
            const isActive = subQueue === sq.value;
            const count    = subQueueCounts[sq.value];
            const Icon     = sq.icon;
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
        <div className="mx-6 mt-4 flex items-start gap-3 bg-info-bg border border-info-bdr rounded-lg px-4 py-3 shrink-0">
          <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] text-info font-medium">{activeSQ.banner.text}</p>
            <p className="text-[12px] text-info/80 mt-0.5">{activeSQ.banner.action}</p>
          </div>
        </div>
      )}

      {/* ── Safety category filter (Task-256) ─────────────────────────────── */}
      {/* Multi-select chips let prescribers slice the queue down to e.g. only
          cardiac or safeguarding flags. Categories with zero matching orders
          in the current sub-queue are disabled so the row stays scannable. */}
      {(() => {
        const availableCategories = SAFETY_CATEGORIES.filter(
          (c) => categoryCountsInSub[c] > 0 || selectedCategories.has(c),
        );
        if (availableCategories.length === 0) return null;
        return (
          <div className="px-6 pt-3 pb-2 border-b border-bdr bg-surface flex items-center gap-2 flex-wrap shrink-0">
            <span className="text-[11px] font-bold text-t3 uppercase tracking-wider mr-1">
              Safety category
            </span>
            {availableCategories.map((c) => {
              const meta = SAFETY_CATEGORY_META[c];
              const count = categoryCountsInSub[c];
              const active = selectedCategories.has(c);
              const disabled = count === 0 && !active;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => !disabled && toggleCategory(c)}
                  disabled={disabled}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-semibold rounded-full border transition-colors",
                    active
                      ? "bg-brand text-white border-brand"
                      : disabled
                      ? "bg-surface text-t3 border-bdr opacity-50 cursor-not-allowed"
                      : `${meta.pillCls} hover:opacity-80`,
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      active ? "bg-white" : meta.dotCls,
                    )}
                  />
                  {meta.label}
                  {count > 0 && (
                    <span
                      className={cn(
                        "text-[10px] font-bold tabular-nums px-1.5 py-px rounded-full",
                        active ? "bg-white/20 text-white" : "bg-white/60 text-current",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
            {selectedCategories.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCategories(new Set())}
                className="ml-1 text-[11px] font-semibold text-t2 hover:text-brand underline-offset-2 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        );
      })()}

      {/* ── Filter chips ───────────────────────────────────────────────────── */}
      <div className="px-6 py-2.5 border-b border-bdr bg-surface flex items-center justify-between gap-3 flex-wrap mt-4 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {CHIPS.map((chip) => {
            const active = activeChip === chip.value;
            // Scope review-needed chip count to the current sub-queue so the
            // number always matches what the user will see if they click it.
            const subReviewCount =
              chip.value === "review_needed"
                ? categoryFiltered.reduce(
                    (acc, o) => acc + ((reviewNeededByOrderId[o.id] ?? 0) > 0 ? 1 : 0),
                    0,
                  )
                : 0;
            const subBouncedCount =
              chip.value === "reminder_bounced"
                ? categoryFiltered.reduce(
                    (acc, o) => acc + (computeReminderStatus(o)?.state === "bounced" ? 1 : 0),
                    0,
                  )
                : 0;
            // Task-191 — Scope weight-warning chip count to the current sub-queue
            // so the number matches what the user will see if they click it.
            // Task-256 — Further scoped to the category filter when active.
            const subWeightWarningCount =
              chip.value === "weight_warning"
                ? categoryFiltered.reduce(
                    (acc, o) =>
                      acc +
                      ((weightWarningStateByOrderId[o.id]?.unacknowledged ?? 0) > 0 ? 1 : 0),
                    0,
                  )
                : 0;
            const count =
              chip.value === "review_needed"    ? subReviewCount        :
              chip.value === "reminder_bounced" ? subBouncedCount       :
              chip.value === "weight_warning"   ? subWeightWarningCount :
              undefined;
            const disabled =
              (chip.value === "review_needed"    && subReviewCount === 0) ||
              (chip.value === "reminder_bounced" && subBouncedCount === 0) ||
              (chip.value === "weight_warning"   && subWeightWarningCount === 0);
            return (
              <button
                key={chip.value}
                onClick={() => !disabled && setActiveChip(chip.value)}
                disabled={disabled}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-semibold rounded-full border transition-colors",
                  active
                    ? "bg-brand text-white border-brand"
                    : disabled
                    ? "bg-surface text-t3 border-bdr opacity-50 cursor-not-allowed"
                    : "bg-surface text-t2 border-bdr hover:border-brand hover:text-brand"
                )}
              >
                {chip.label}
                {count !== undefined && count > 0 && (
                  <span className={cn(
                    "text-[10px] font-bold tabular-nums px-1.5 py-px rounded-full",
                    active ? "bg-white/20 text-white" : "bg-warn-bg text-warn border border-warn-bdr"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {(ackedWeightWarningCount > 0 || hideAckedWeightWarnings) && (
            <label
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-medium cursor-pointer select-none",
                hideAckedWeightWarnings ? "text-brand" : "text-t2 hover:text-t1",
              )}
              title="Hide orders where every concerning weight warning has been acknowledged"
            >
              <input
                type="checkbox"
                checked={hideAckedWeightWarnings}
                onChange={(e) => setHideAckedWeightWarnings(e.target.checked)}
                className="w-3 h-3 accent-brand"
              />
              Hide weight-warning reviewed
              {ackedWeightWarningCount > 0 && (
                <span className="text-[10px] text-t3 tabular-nums">
                  ({ackedWeightWarningCount})
                </span>
              )}
            </label>
          )}
          <span className="text-[11px] text-t3 whitespace-nowrap">
            {filtered.length} order{filtered.length !== 1 ? "s" : ""} · Sort: Unack&apos;d warnings, review needed, oldest first
          </span>
        </div>
      </div>

      {/* ── Queue + slide-over flex row ────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Queue table (scrollable, shrinks when panel is open) */}
        <div className="flex-1 overflow-y-auto min-w-0 px-6 py-4">
          <div className="flex flex-col gap-4">
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
                onRowClick={handleRowClick}
                selectedOrderId={selectedOrderId ?? undefined}
                reviewNeededByOrderId={reviewNeededByOrderId}
                flaggedAnswersByOrderId={flaggedAnswersByOrderId}
                onJumpToFlagged={handleJumpToFlagged}
                weightWarningStateByOrderId={weightWarningStateByOrderId}
              />
            )}
          </div>
        </div>

        {/* Slide-over panel (420px, animated in/out) */}
        <div
          className={cn(
            "shrink-0 border-l border-bdr overflow-hidden transition-all duration-300",
            selectedOrder ? "w-[420px] opacity-100" : "w-0 opacity-0"
          )}
        >
          {selectedOrder && (
            <ClinicalCheckSlideOver
              order={selectedOrder}
              patientName={patientNames[selectedOrder.patient_id] ?? selectedOrder.patient_id}
              clinic={clinic}
              clinicId={clinicId}
              onClose={() => setSelectedOrderId(null)}
              onDecisionMade={handleDecisionMade}
              onNavigate={navigateOrder}
              jumpToFlaggedNonce={jumpFlaggedNonce}
            />
          )}
        </div>
      </div>

      {/* ── Undo toast (persists across slide-over close) ─────────────────── */}
      {undoToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border bg-ok-bg border-ok-bdr text-ok text-[13px] font-medium"
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{DECISION_LABELS[undoToast.decision]}</span>
          <button
            type="button"
            onClick={handleUndo}
            disabled={isUndoing}
            className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-ok-bdr bg-surface text-ok hover:bg-ok hover:text-white transition-colors text-[12px] font-semibold disabled:opacity-50"
          >
            <Undo2 className="w-3.5 h-3.5" />
            {isUndoing ? "Undoing…" : `Undo (${Math.max(1, Math.ceil(undoRemainingMs / 1000))}s)`}
          </button>
        </div>
      )}

      {/* ── Error toast ──────────────────────────────────────────────────── */}
      {errorToast && (
        <div
          role="alert"
          className="fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border bg-err-bg border-err-bdr text-err text-[13px] font-medium"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {errorToast}
        </div>
      )}
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
