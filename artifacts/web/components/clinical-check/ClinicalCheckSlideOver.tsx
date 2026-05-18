"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  X, CheckCircle, XCircle, MessageSquare, Zap, ShieldCheck,
  FileText, AlertTriangle, TrendingDown, TrendingUp, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { decideOrder, NOW } from "@/lib/api/mock";
import { useCurrentUser } from "@/lib/context";
import { createClinicalNoteAction } from "@/lib/actions/clinicalNoteActions";
import { can } from "@/lib/permissions";
import { formatRelativeTime } from "@/lib/format";
import {
  analyseWeightHistory,
  formatWeightWarningThresholdsSummary,
} from "@/lib/clinical/weightWarnings";
import { WeightWarningChips } from "@/components/clinical/WeightWarningChips";
import { OrderQuestionnaireCard } from "@/components/orders/OrderQuestionnaireCard";
import { OrderNICEChecklistCard } from "@/components/orders/OrderNICEChecklistCard";
import { ApproveConfirmModal } from "@/components/orders/ApproveConfirmModal";
import { DeclineConfirmModal } from "@/components/orders/DeclineConfirmModal";
import { InterventionConfirmModal } from "@/components/orders/InterventionConfirmModal";
import type { AIDraftResult } from "@/components/clinical-notes/AINoteDraftingModal";
import type { Order, Clinic, ClinicId } from "@/types";

type Decision = "approved" | "declined" | "queried";
type SlideOverTab = "summary" | "questionnaire" | "nice" | "notes";

const TABS: { key: SlideOverTab; label: string }[] = [
  { key: "summary",       label: "Summary"        },
  { key: "questionnaire", label: "Questionnaire"  },
  { key: "nice",          label: "NICE checklist" },
  { key: "notes",         label: "Notes"          },
];

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
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

const FLAG_COLORS: Record<string, string> = {
  "Dose increase":             "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]",
  "Cardiac history":           "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
  "Safeguarding":              "bg-[#fef2f2] text-[#991b1b] border-[#fca5a5]",
  "Eating disorder disclosed": "bg-[#fdf4ff] text-[#7e22ce] border-[#e9d5ff]",
  "Duplicate address":         "bg-[#f9fafb] text-[#374151] border-[#d1d5db]",
  "Awaiting ID":               "bg-[#fffbeb] text-[#b45309] border-[#fde68a]",
  "Awaiting BMI":              "bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]",
  "Awaiting Rx evidence":      "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]",
  // Task-163 — self-reported BMI sanity-check flag raised at intake.
  "Self-reported BMI out of range": "bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]",
};
const defaultFlagCls = "bg-[#f9fafb] text-[#374151] border-[#d1d5db]";

interface ClinicalCheckSlideOverProps {
  order: Order;
  patientName: string;
  clinic: Clinic;
  clinicId: ClinicId;
  onClose: () => void;
  onDecisionMade: (orderId: string, decision: Decision, snapshot: Order) => void;
  onNavigate?: (direction: 1 | -1) => void;
  /**
   * Increments each time the clinician clicks a row's "N review needed" badge.
   * When it changes, the slide-over switches to the Questionnaire tab and the
   * questionnaire card scrolls/highlights the first safety-flagged answer.
   */
  jumpToFlaggedNonce?: number;
}

export function ClinicalCheckSlideOver({
  order: orderProp,
  patientName,
  clinic,
  clinicId,
  onClose,
  onDecisionMade,
  onNavigate,
  jumpToFlaggedNonce,
}: ClinicalCheckSlideOverProps) {
  const CURRENT_USER = useCurrentUser();
  // Task-99 — mirror the order locally so optimistic updates (e.g. weight
  // warning acknowledgements) survive until the parent refetches the queue.
  const [order, setOrder] = useState<Order>(orderProp);
  useEffect(() => {
    setOrder(orderProp);
  }, [orderProp]);

  const [activeTab, setActiveTab] = useState<SlideOverTab>("summary");
  const [approveOpen, setApproveOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [interventionOpen, setInterventionOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  useEffect(() => {
    if (!errorToast) return;
    const t = setTimeout(() => setErrorToast(null), 4000);
    return () => clearTimeout(t);
  }, [errorToast]);

  // When the clinician clicks the "N review needed" badge in the queue, jump
  // straight to the Questionnaire tab so the card can scroll to and highlight
  // the first flagged answer. Guard on >0 so we don't jump on initial mount.
  useEffect(() => {
    if (jumpToFlaggedNonce && jumpToFlaggedNonce > 0) {
      setActiveTab("questionnaire");
    }
  }, [jumpToFlaggedNonce]);

  const canDecide = order.status === "clinical_check" && can(CURRENT_USER, "decide", "orders");

  // Keyboard shortcuts: ↑/↓ navigate queue, A approve, D decline, I intervene
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignore when typing in inputs/textareas/contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      // Ignore when a decision modal is already open
      if (approveOpen || declineOpen || interventionOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        onNavigate?.(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onNavigate?.(-1);
        return;
      }
      if (!canDecide || isSubmitting) return;
      const k = e.key.toLowerCase();
      if (k === "a") {
        e.preventDefault();
        setApproveOpen(true);
      } else if (k === "d") {
        e.preventDefault();
        setDeclineOpen(true);
      } else if (k === "i") {
        e.preventDefault();
        setInterventionOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onNavigate, canDecide, isSubmitting, approveOpen, declineOpen, interventionOpen]);
  const ctxFlags = order.contextual_flags ?? [];

  // Weight trajectory + BMI (BLD-14.5) — surface compactly in Summary tab
  const weightHistory = order.weight_history ?? [];
  const weightSorted = [...weightHistory].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const wFirst = weightSorted[0];
  const wLast  = weightSorted[weightSorted.length - 1];
  const wLostKg  = wFirst && wLast ? +(wFirst.weight_kg - wLast.weight_kg).toFixed(1) : 0;
  const wLostPct = wFirst && wLast && wFirst.weight_kg > 0
    ? +((wLostKg / wFirst.weight_kg) * 100).toFixed(1)
    : 0;
  const wGained = wLostKg < 0;
  const weights = weightSorted.map((r) => r.weight_kg);
  const wMin = weights.length ? Math.min(...weights) : 0;
  const wMax = weights.length ? Math.max(...weights) : 0;
  const wRange = Math.max(wMax - wMin, 1);
  const sparkPts = weightSorted.map((r, i) => {
    const x = weightSorted.length === 1 ? 50 : (i / (weightSorted.length - 1)) * 100;
    const y = 10 + ((wMax - r.weight_kg) / wRange) * 80;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const weightWarnings = analyseWeightHistory(weightHistory, {
    isContinuation: order.type === "reorder",
    thresholds: clinic.config.weight_warning_thresholds,
  });
  const weightThresholdsSummary = formatWeightWarningThresholdsSummary(
    clinic.config.weight_warning_thresholds,
  );
  const currentBmi = wLast?.bmi;
  const bmiBandLabel =
    currentBmi == null   ? null :
    currentBmi < 18.5    ? "Underweight" :
    currentBmi < 25      ? "Healthy" :
    currentBmi < 30      ? "Overweight" :
    currentBmi < 35      ? "Obese I" :
    currentBmi < 40      ? "Obese II" :
                           "Obese III";
  const bmiBandCls =
    currentBmi == null              ? "" :
    currentBmi >= 18.5 && currentBmi < 25 ? "bg-ok-bg text-ok border-ok-bdr" :
    currentBmi >= 35                ? "bg-err-bg text-err border-err-bdr" :
                                      "bg-warn-bg text-warn border-warn-bdr";

  const now = new Date(NOW).getTime();
  const elapsedMs = now - new Date(order.created_at).getTime();
  const waitingLabel = formatRelativeTime(order.created_at);
  const elapsedHours = elapsedMs / 3_600_000;
  const warnH = clinic.config.default_slas.approval_warn_hours;
  const breachH = clinic.config.default_slas.approval_breach_hours;
  const slaVariant: "ok" | "warn" | "err" =
    elapsedHours >= breachH ? "err" : elapsedHours >= warnH ? "warn" : "ok";
  const slaCls =
    slaVariant === "err"  ? "bg-err-bg  border-err-bdr  text-err"  :
    slaVariant === "warn" ? "bg-warn-bg border-warn-bdr text-warn" :
                            "bg-ok-bg   border-ok-bdr   text-ok";

  const questionConfig =
    order.type === "new"
      ? clinic.config.questionnaire_order
      : clinic.config.questionnaire_reorder;

  async function handleDecideWithNote(
    decision: Decision,
    body: string,
    aiData?: Omit<AIDraftResult, "body">,
  ) {
    setIsSubmitting(true);
    // Snapshot the order *before* mutating it so Undo can restore the queue
    // entry without an extra fetch round-trip.
    const snapshot: Order = { ...order };
    try {
      await createClinicalNoteAction(clinicId, {
        patient_id:                  order.patient_id,
        order_id:                    order.id,
        body,
        approval_gate_for_order_id:  decision === "approved" ? order.id : null,
        ai_drafted:                  aiData?.ai_drafted ?? false,
        ai_draft_original:           aiData?.ai_draft_original ?? null,
        ai_prompt_version_id:        aiData?.prompt_version_id ?? null,
        ai_draft_accepted_at:        aiData?.ai_drafted ? NOW : null,
        ai_draft_edited_by:          aiData?.ai_drafted ? CURRENT_USER.id : null,
      });
      await decideOrder(clinicId, order.id, decision, body);
      setApproveOpen(false);
      setDeclineOpen(false);
      setInterventionOpen(false);
      // Hand the toast (with Undo) to the parent so it persists after this
      // slide-over unmounts and the queue refreshes.
      onDecisionMade(order.id, decision, snapshot);
    } catch (err) {
      setErrorToast(err instanceof Error ? err.message : "Action failed. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-bdr shrink-0">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0",
          avatarBg(order.patient_id)
        )}>
          {initials(patientName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-semibold text-t1 leading-tight">{patientName}</p>
            <span className="font-mono text-[10px] text-t3 bg-page-bg border border-bdr rounded px-1.5 py-px">{order.id}</span>
          </div>
          <p className="text-[11px] text-t3 mt-0.5">
            {order.product.medication} {order.product.dose} · {order.type === "reorder" ? "Reorder" : "First order"}
          </p>
        </div>
        <Link
          href={`/${clinicId}/orders/${order.id}`}
          className="shrink-0 text-[11px] font-semibold text-brand border border-brand/30 bg-brand-light hover:bg-brand hover:text-white rounded-md px-2.5 py-1 transition-colors whitespace-nowrap"
        >
          Full detail ↗
        </Link>
        <button
          onClick={onClose}
          className="rounded-md p-1 hover:bg-page-bg transition-colors text-t3"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-end border-b border-bdr px-3 bg-surface shrink-0 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "px-3 py-2.5 text-[12px] font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap",
              activeTab === key
                ? "border-brand text-brand"
                : "border-transparent text-t2 hover:text-t1"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Scrollable body ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Summary tab ── */}
        {activeTab === "summary" && (
          <div className="px-4 py-4 space-y-4">

            {/* Order details */}
            <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-bdr bg-page-bg">
                <FileText className="w-3.5 h-3.5 text-brand" />
                <span className="text-[11px] font-bold text-t2 uppercase tracking-wider">Order details</span>
              </div>
              <div className="px-3 py-3 space-y-2 text-[12px]">
                <div className="flex justify-between gap-2">
                  <span className="text-t3">Medication</span>
                  <span className="text-t1 font-semibold">{order.product.medication} {order.product.dose}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-t3">Type</span>
                  <span className="text-t1 font-medium">{order.type === "reorder" ? "Reorder" : "First order"}</span>
                </div>
                <div className="flex justify-between gap-2 items-center">
                  <span className="text-t3">Waiting</span>
                  <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border", slaCls)}>
                    {waitingLabel}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-t3">Strength</span>
                  <span className="text-t1 font-medium">{order.product.strength}</span>
                </div>
              </div>
            </div>

            {/* Weight trajectory + BMI (BLD-14.5) */}
            {weightSorted.length > 0 && wFirst && wLast && (
              <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-bdr bg-page-bg">
                  {wGained
                    ? <TrendingUp className="w-3.5 h-3.5 text-err" />
                    : <TrendingDown className="w-3.5 h-3.5 text-brand" />}
                  <span className="text-[11px] font-bold text-t2 uppercase tracking-wider">
                    Weight journey · {weightSorted.length} readings
                  </span>
                  <span className="ml-auto text-[10px] text-t3">
                    {wFirst.weight_kg}kg → {wLast.weight_kg}kg
                  </span>
                </div>

                <div className="px-3 py-3 space-y-3">
                  {/* Stats row: start → sparkline → now/change */}
                  <div className="flex items-center gap-2.5">
                    <div className="shrink-0 text-right w-[58px]">
                      <p className="text-[9px] text-t3 uppercase tracking-wide">Start</p>
                      <p className="text-[13px] font-bold text-t1 leading-tight">{wFirst.weight_kg}kg</p>
                    </div>

                    <div className="flex-1 min-w-0 h-[40px]">
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                        <polyline
                          points={sparkPts}
                          fill="none"
                          stroke={wGained ? "#dc2626" : "#4f46e5"}
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                        />
                        {weightSorted.map((r, i) => {
                          const x = weightSorted.length === 1 ? 50 : (i / (weightSorted.length - 1)) * 100;
                          const y = 10 + ((wMax - r.weight_kg) / wRange) * 80;
                          return (
                            <circle
                              key={r.recorded_at}
                              cx={x}
                              cy={y}
                              r="2"
                              fill={wGained ? "#dc2626" : "#4f46e5"}
                              vectorEffect="non-scaling-stroke"
                            />
                          );
                        })}
                      </svg>
                    </div>

                    <div className="shrink-0 w-[72px]">
                      <p className="text-[9px] text-t3 uppercase tracking-wide">Now</p>
                      <p className="text-[13px] font-bold text-t1 leading-tight">{wLast.weight_kg}kg</p>
                      <p className={cn(
                        "text-[10px] font-semibold leading-tight mt-0.5",
                        wGained ? "text-err" : "text-ok"
                      )}>
                        {wGained ? "+" : "−"}{Math.abs(wLostKg)}kg · {wGained ? "+" : "−"}{Math.abs(wLostPct)}%
                      </p>
                    </div>
                  </div>

                  {/* Concerning trend warnings (Task-69) + acknowledgements (Task-99)
                      + active threshold hint (Task-143) */}
                  {weightWarnings.length > 0 && (
                    <div className="space-y-1.5">
                      <WeightWarningChips
                        order={order}
                        clinicId={clinicId}
                        warnings={weightWarnings}
                        size="sm"
                        canAcknowledge={canDecide}
                        thresholds={clinic.config.weight_warning_thresholds}
                        onAcknowledged={setOrder}
                      />
                      {weightThresholdsSummary && (
                        <p className="text-[10px] text-t3 leading-tight">
                          <span className="font-semibold text-t3">Thresholds in use · </span>
                          {weightThresholdsSummary}
                        </p>
                      )}
                    </div>
                  )}

                  {/* BMI tile */}
                  {currentBmi != null && (
                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-bdr bg-page-bg">
                      <Activity className="w-3.5 h-3.5 text-t3 shrink-0" />
                      <span className="text-[11px] text-t3">Current BMI</span>
                      <span className="text-[13px] font-bold text-t1 ml-1">{currentBmi.toFixed(1)}</span>
                      {bmiBandLabel && (
                        <span className={cn(
                          "ml-auto text-[10px] font-bold border rounded-full px-2 py-0.5",
                          bmiBandCls
                        )}>
                          {bmiBandLabel}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI summary chip */}
            <div className="rounded-lg border border-info-bdr bg-info-bg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap className="w-3.5 h-3.5 text-info shrink-0" />
                <span className="text-[10px] font-bold text-info uppercase tracking-wide">AI Clinical Summary</span>
                <span className="ml-auto text-[10px] font-bold text-ok bg-ok-bg border border-ok-bdr rounded-full px-2 py-px">
                  Ready
                </span>
              </div>
              <p className="text-[12px] text-t1 leading-relaxed">
                Patient is on {order.product.medication} {order.product.dose}
                {order.type === "reorder" ? " (reorder)" : " (first prescription)"}.
                {order.g6_flags.length > 0 && ` G6 flags present: ${order.g6_flags.join(", ")}.`}
                {ctxFlags.length > 0 && ` Contextual flags: ${ctxFlags.join(", ")}.`}
                {" Review questionnaire responses and NICE checklist before making a clinical decision."}
              </p>
              <p className="text-[10px] text-info/70 italic mt-1.5">
                AI-generated — verify against the clinical evidence.
              </p>
            </div>

            {/* Context flags */}
            {ctxFlags.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-2">Context flags</p>
                <div className="flex flex-wrap gap-1.5">
                  {ctxFlags.map((f) => (
                    <span
                      key={f}
                      className={cn("text-[11px] font-semibold border rounded-full px-2 py-0.5", FLAG_COLORS[f] ?? defaultFlagCls)}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* G6 flags */}
            {order.g6_flags.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-ok-bg border border-ok-bdr">
                <ShieldCheck className="w-4 h-4 text-ok shrink-0" />
                <div>
                  <p className="text-[12px] font-semibold text-ok">G6 Screening Complete</p>
                  <p className="text-[11px] text-t2 mt-0.5">Flags: {order.g6_flags.join(", ")}</p>
                </div>
              </div>
            )}

            {/* No flags */}
            {ctxFlags.length === 0 && order.g6_flags.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-ok-bg border border-ok-bdr">
                <CheckCircle className="w-4 h-4 text-ok shrink-0" />
                <p className="text-[12px] font-semibold text-ok">No clinical flags raised</p>
              </div>
            )}
          </div>
        )}

        {/* ── Questionnaire tab ── */}
        {activeTab === "questionnaire" && (
          <div className="px-4 py-4">
            <OrderQuestionnaireCard
              questionnaire_responses={order.questionnaire_responses as Record<string, unknown>}
              questionConfig={questionConfig}
              scrollToFlaggedNonce={jumpToFlaggedNonce}
            />
          </div>
        )}

        {/* ── NICE checklist tab ── */}
        {activeTab === "nice" && (
          <div className="px-4 py-4">
            {order.nice_checklist && order.nice_checklist.length > 0 ? (
              <OrderNICEChecklistCard
                orderStatus={order.status}
                initialChecklist={order.nice_checklist}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-t3">
                <ShieldCheck className="w-6 h-6 opacity-40" />
                <p className="text-[12px]">No NICE checklist configured for this order.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Notes tab ── */}
        {activeTab === "notes" && (
          <div className="px-4 py-4 space-y-3">
            <div className="rounded-lg border border-info-bdr bg-info-bg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap className="w-3.5 h-3.5 text-info shrink-0" />
                <span className="text-[10px] font-bold text-info uppercase tracking-wide">AI Summary</span>
                <span className="ml-auto text-[10px] font-bold text-ok bg-ok-bg border border-ok-bdr rounded-full px-2 py-px">
                  Ready
                </span>
              </div>
              <p className="text-[12px] text-t1 leading-relaxed">
                Patient is on {order.product.medication} {order.product.dose}.
                {order.g6_flags.length > 0 && ` G6PD flags: ${order.g6_flags.join(", ")}.`}
                {ctxFlags.length > 0 && ` Contextual: ${ctxFlags.join(", ")}.`}
                {" Full AI-generated clinical summary available on the Order Detail page."}
              </p>
              <p className="text-[10.5px] italic mt-1.5 text-info/70">
                Full summary + note authoring available in Order Detail.
              </p>
            </div>

            <div className="flex items-start gap-2.5 px-3 py-3 rounded-lg bg-page-bg border border-bdr">
              <AlertTriangle className="w-3.5 h-3.5 text-t3 shrink-0 mt-0.5" />
              <p className="text-[12px] text-t2 leading-relaxed">
                Clinical notes must be authored on the full Order Detail page where the 3-layer
                approval chain and AI note drafting tools are available.
              </p>
            </div>

            <Link
              href={`/${clinicId}/orders/${order.id}`}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-[12px] font-semibold text-brand border border-brand/30 bg-brand-light hover:bg-brand hover:text-white rounded-lg transition-colors"
            >
              Open full detail to author a note ↗
            </Link>
          </div>
        )}
      </div>

      {/* ── Decision bar ─────────────────────────────────────────────────── */}
      {canDecide && (
        <div className="shrink-0 border-t border-bdr px-4 py-3 bg-surface">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInterventionOpen(true)}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-info border border-info-bdr bg-info-bg hover:bg-info hover:text-white rounded-md transition-colors disabled:opacity-50"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Intervene
            </button>
            <button
              onClick={() => setDeclineOpen(true)}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-err border border-err-bdr bg-err-bg hover:bg-err hover:text-white rounded-md transition-colors disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" /> Decline
            </button>
            <button
              onClick={() => setApproveOpen(true)}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-white bg-ok hover:bg-ok/90 rounded-md transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
          </div>
          <div className="mt-2 flex items-center flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-t3">
            <span className="font-semibold uppercase tracking-wider text-t3/80">Shortcuts</span>
            <ShortcutHint keyLabel="↑" /> <ShortcutHint keyLabel="↓" />
            <span>Navigate</span>
            <span className="text-t3/40">·</span>
            <ShortcutHint keyLabel="A" /><span>Approve</span>
            <ShortcutHint keyLabel="D" /><span>Decline</span>
            <ShortcutHint keyLabel="I" /><span>Intervene</span>
            <span className="text-t3/40">·</span>
            <ShortcutHint keyLabel="Esc" /><span>Close</span>
          </div>
        </div>
      )}

      {/* ── Error toast (success toast + Undo handled by parent) ─────────── */}
      {errorToast && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-[13px] font-medium bg-err-bg border-err-bdr text-err">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {errorToast}
        </div>
      )}

      {/* ── Decision modals ──────────────────────────────────────────────── */}
      <ApproveConfirmModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        orderId={order.id}
        patientName={patientName}
        clinic={clinic}
        clinicId={clinicId}
        isSubmitting={isSubmitting}
        blockedReason={
          (order.contextual_flags?.includes("Px upload pending") ?? false) &&
          order.px_upload == null
            ? "GLP-1 prescription upload required from patient before approval"
            : null
        }
        onApprove={(note, aiData) => handleDecideWithNote("approved", note, aiData)}
      />
      <DeclineConfirmModal
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        orderId={order.id}
        patientName={patientName}
        clinic={clinic}
        clinicId={clinicId}
        isSubmitting={isSubmitting}
        onDecline={(note, aiData) => handleDecideWithNote("declined", note, aiData)}
      />
      <InterventionConfirmModal
        open={interventionOpen}
        onClose={() => setInterventionOpen(false)}
        orderId={order.id}
        patientName={patientName}
        clinic={clinic}
        clinicId={clinicId}
        isSubmitting={isSubmitting}
        onIntervene={(note, aiData) => handleDecideWithNote("queried", note, aiData)}
      />
    </div>
  );
}

function ShortcutHint({ keyLabel }: { keyLabel: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded border border-bdr bg-page-bg text-[10px] font-mono font-semibold text-t2 leading-none">
      {keyLabel}
    </kbd>
  );
}

