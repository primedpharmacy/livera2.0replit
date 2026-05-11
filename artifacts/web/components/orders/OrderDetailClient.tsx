"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package, User, ArrowLeft, ChevronRight, CheckCircle, XCircle,
  MessageSquare, Clock, ShieldAlert, ClipboardList, AlertTriangle,
  Stethoscope, Activity, Scale, Pencil, ShieldCheck, FileText, Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatDateTime, formatBMI, formatWeight, formatAge } from "@/lib/format";
import { decideOrder, CURRENT_USER } from "@/lib/api/mock";
import { can } from "@/lib/permissions";
import type { Order, Patient, Clinic, ClinicId } from "@/types";

interface OrderDetailClientProps {
  initialOrder: Order;
  patient: Patient;
  clinic: Clinic;
  clinicId: ClinicId;
}

type Modal = "approve" | "decline" | "query" | null;
type RightTab = "questionnaire" | "clinical_evidence" | "prescription" | "amendments" | "activity";

const RIGHT_TABS: { key: RightTab; label: string }[] = [
  { key: "questionnaire",      label: "Questionnaire"      },
  { key: "clinical_evidence",  label: "Clinical evidence"  },
  { key: "prescription",       label: "Prescription"       },
  { key: "amendments",         label: "Amendments"         },
  { key: "activity",           label: "Activity log"       },
];

const Q_DEFS: Record<string, { question: string; sub?: string; safetyChain?: boolean }> = {
  weight_today: {
    question: "What's your current weight in kg?",
    sub: "We use this to track your progress.",
  },
  side_effects: {
    question: "Have you had any of these side effects?",
    sub: "Tick all that apply. Severe responses trigger an order pause and incident write.",
    safetyChain: true,
  },
  medication_changes: {
    question: "Has anything changed in your medical history since your last order?",
    sub: "New conditions, medications, surgeries, or hospital admissions.",
  },
};

function qFlag(key: string, val: unknown): "ok" | "warn" | "neutral" {
  if (key === "weight_today") return "neutral";
  const s = String(val).toLowerCase().trim();
  if (s === "none" || s === "no" || s === "none of these") return "ok";
  return "warn";
}

interface Toast {
  message: string;
  type: "ok" | "err";
}

export function OrderDetailClient({
  initialOrder,
  patient,
  clinic,
  clinicId,
}: OrderDetailClientProps) {
  const [order, setOrder]           = useState<Order>(initialOrder);
  const [modal, setModal]           = useState<Modal>(null);
  const [rationale, setRationale]   = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast]           = useState<Toast | null>(null);
  const [activeTab, setActiveTab]   = useState<RightTab>("questionnaire");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleDecide(decision: "approved" | "declined" | "queried", r: string) {
    setIsSubmitting(true);
    try {
      const updated = await decideOrder(clinicId, order.id, decision, r);
      setOrder(updated);
      setModal(null);
      setRationale("");
      setToast({
        message:
          decision === "approved"
            ? "Order approved successfully."
            : decision === "declined"
            ? "Order declined and patient notified."
            : "Query raised — patient will be contacted.",
        type: decision === "approved" ? "ok" : "err",
      });
      // Jump to activity log after a decision so the user can see it
      setActiveTab("activity");
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Action failed. Please retry.",
        type: "err",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const canDecide = order.status === "clinical_check" && can(CURRENT_USER, "decide", "orders");

  // Layer 1 — Surface guard (UI prevents approval when conditions fail)
  const hasHighSeverityFlag        = patient.flags.some((f) => f.severity === "high");
  const hasB4Acknowledged          = patient.flags.some((f) => f.code === "B4_acknowledged");
  const isDoseEscalationNoEvidence =
    "dose_escalation" in order.questionnaire_responses &&
    !order.questionnaire_responses["prior_dose_evidence"];

  const approveBlockedReason: string | null =
    hasHighSeverityFlag && !hasB4Acknowledged
      ? "Patient has an unacknowledged high-severity flag — acknowledge before approving"
      : isDoseEscalationNoEvidence
      ? "Dose escalation requires prior dose evidence in the questionnaire"
      : null;

  const approveBlocked = approveBlockedReason !== null;

  const d           = patient.demographic;
  const age         = formatAge(d.dob);
  const hasB4       = patient.flags.some((f) => f.code === "B4");
  const now         = Date.now();
  const warnAt      = new Date(order.sla_warn_at).getTime();
  const breachAt    = new Date(order.sla_breach_at).getTime();
  const slaBreached = now > breachAt;
  const slaWarning  = !slaBreached && now > warnAt;
  const slaHoursLeft  = Math.max(0, Math.floor((breachAt - now) / 3600000));
  const slaTotalHours = clinic.config.sla.approval_breach_hours;

  // Clinical evidence derived values
  const weightLostKg  = +(patient.baseline.baseline_weight_kg - patient.latest.weight_kg).toFixed(1);
  const bmiDelta      = +(patient.baseline.baseline_bmi - patient.latest.bmi).toFixed(1);
  const weightGained  = weightLostKg < 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-bdr bg-surface shrink-0">
        <nav className="flex items-center gap-1.5 text-[12px] text-t3 mb-3">
          <Link href={`/${clinicId}/orders`} className="flex items-center gap-1 hover:text-brand transition-colors">
            <ArrowLeft className="w-3 h-3" />
            Orders
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="font-mono text-t1 font-medium">{order.id}</span>
        </nav>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-brand" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-t1 font-mono">{order.id}</h1>
                <StatusBadge value={order.status} kind="order" />
                {order.g6_flags.length > 0 && (
                  <span className="text-[9px] font-bold bg-ok-bg text-ok border border-ok-bdr px-2 py-px rounded">
                    G6
                  </span>
                )}
              </div>
              <p className="text-[12px] text-t2 mt-0.5">
                {order.product.medication} {order.product.dose} ·{" "}
                <span className="capitalize">{order.type}</span> order · {formatDate(order.created_at)}
              </p>
            </div>
          </div>

          {canDecide && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setModal("query")}
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-info border border-info-bdr bg-info-bg hover:bg-info hover:text-white rounded-md transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Query
              </button>
              <button
                onClick={() => setModal("decline")}
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-err border border-err-bdr bg-err-bg hover:bg-err hover:text-white rounded-md transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Decline
              </button>
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={() => setModal("approve")}
                  disabled={approveBlocked}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-md transition-colors shadow-sm ${
                    approveBlocked
                      ? "bg-ok/40 text-white cursor-not-allowed"
                      : "text-white bg-ok hover:bg-ok/90"
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
                {approveBlocked && approveBlockedReason && (
                  <p className="text-[10px] text-err max-w-[200px] text-right leading-tight">
                    {approveBlockedReason}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Body — two-panel ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-5 grid grid-cols-5 gap-4 items-start">

          {/* Left — patient summary 2/5 (unchanged) */}
          <div className="col-span-2 space-y-4 sticky top-5">
            <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
                <User className="w-3.5 h-3.5 text-brand" />
                <h2 className="text-[11px] font-bold text-t2 uppercase tracking-wider">Patient</h2>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-mid to-brand flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {d.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-semibold text-t1">{d.full_name}</span>
                      {hasB4 && <span className="text-[9px] font-bold bg-warn-bg text-warn border border-warn-bdr px-1.5 py-px rounded">B4</span>}
                      {patient.vip && <span className="text-[9px] font-bold bg-coach-bg text-coach border border-coach-bdr px-1.5 py-px rounded">VIP</span>}
                    </div>
                    <div className="text-[11px] text-t3 font-mono">{patient.id}</div>
                  </div>
                </div>
                <div className="space-y-1.5 text-[12px]">
                  <div className="flex justify-between gap-2">
                    <span className="text-t3">Age / sex</span>
                    <span className="text-t1 font-medium">{age} yrs · {d.sex_at_birth}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-t3">BMI</span>
                    <span className="text-t1 font-medium">{formatBMI(patient.latest.bmi)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-t3">Weight</span>
                    <span className="text-t1 font-medium">{formatWeight(patient.latest.weight_kg)}</span>
                  </div>
                  {patient.gp && (
                    <div className="flex justify-between gap-2">
                      <span className="text-t3">GP</span>
                      <span className="text-t1 font-medium text-right">{patient.gp.name}</span>
                    </div>
                  )}
                </div>
                <Link
                  href={`/${clinicId}/patients/${patient.id}`}
                  className="mt-4 flex items-center justify-center gap-1.5 w-full py-1.5 text-[12px] font-semibold text-brand bg-brand-light hover:bg-brand hover:text-white rounded-md transition-colors"
                >
                  View full profile
                </Link>
              </div>
            </div>
          </div>

          {/* Right — tabbed panel 3/5 */}
          <div className="col-span-3">
            {/* Tab bar */}
            <div className="flex items-center border-b border-bdr overflow-x-auto mb-4">
              {RIGHT_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    activeTab === key
                      ? "border-brand text-brand"
                      : "border-transparent text-t2 hover:text-t1"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── Tab: Questionnaire ──────────────────────────────────────── */}
            {activeTab === "questionnaire" && (
              <DCard icon={ClipboardList} title="Questionnaire Responses">
                {Object.entries(order.questionnaire_responses).length === 0 ? (
                  <p className="text-[12px] text-t3">No responses recorded.</p>
                ) : (
                  <div className="divide-y divide-bdr -mx-4 -mb-3">
                    {Object.entries(order.questionnaire_responses).map(([key, val], idx) => {
                      const def  = Q_DEFS[key];
                      const flag = qFlag(key, val);
                      return (
                        <div key={key} className="grid grid-cols-[28px_1fr] gap-3 px-4 py-3.5 items-start">
                          <div className="text-[10px] font-bold text-t3 bg-page-bg border border-bdr rounded text-center py-1 tabular-nums shrink-0">
                            Q{idx + 1}
                          </div>
                          <div>
                            <div className="flex items-start gap-2 flex-wrap mb-1">
                              <span className="text-[12.5px] text-t1 font-semibold leading-snug">
                                {def?.question ?? key.replace(/_/g, " ")}
                              </span>
                              {def?.safetyChain && (
                                <span className="shrink-0 text-[9px] font-bold px-1.5 py-px rounded bg-err-bg text-err border border-err-bdr tracking-wide">
                                  SAFETY CHAIN
                                </span>
                              )}
                            </div>
                            {def?.sub && (
                              <p className="text-[11px] text-t3 mb-2 leading-snug">{def.sub}</p>
                            )}
                            <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded border text-[12.5px] font-semibold ${
                              flag === "ok"
                                ? "bg-ok-bg border-ok-bdr text-ok"
                                : flag === "warn"
                                ? "bg-warn-bg border-warn-bdr text-warn"
                                : "bg-page-bg border-bdr text-t1"
                            }`}>
                              <span className="flex items-center gap-1.5">
                                {flag === "ok"  && <Check className="w-3.5 h-3.5 text-ok" />}
                                {flag === "warn" && <AlertTriangle className="w-3.5 h-3.5 text-warn" />}
                                {key === "weight_today" ? `${val} kg` : String(val)}
                              </span>
                              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
                                {flag === "ok" ? "No flag" : flag === "warn" ? "Review" : ""}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </DCard>
            )}

            {/* ── Tab: Clinical evidence ──────────────────────────────────── */}
            {activeTab === "clinical_evidence" && (
              <div className="space-y-4">
                {/* Weight journey */}
                <DCard icon={Scale} title="Weight Journey">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <Metric label="Baseline weight" value={formatWeight(patient.baseline.baseline_weight_kg)} sub={`BMI ${formatBMI(patient.baseline.baseline_bmi)}`} />
                    <Metric label="Current weight" value={formatWeight(patient.latest.weight_kg)} sub={`BMI ${formatBMI(patient.latest.bmi)}`} />
                    <Metric
                      label="Total change"
                      value={`${weightGained ? "+" : "−"}${Math.abs(weightLostKg)} kg`}
                      sub={`${weightGained ? "+" : "−"}${Math.abs(bmiDelta)} BMI`}
                      highlight={weightGained ? "warn" : "ok"}
                    />
                  </div>
                  <Row label="Height" value={`${patient.baseline.height_cm} cm`} />
                  <Row label="Latest recorded" value={formatDate(patient.latest.recorded_at)} />
                </DCard>

                {/* Verification */}
                <DCard icon={ShieldCheck} title="Identity Verification">
                  <Row label="Sumsub ID" value={patient.verification.sumsub_id || "—"} mono />
                  <Row
                    label="Identity verified"
                    value={patient.verification.identity_verified_at
                      ? formatDateTime(patient.verification.identity_verified_at)
                      : "Not verified"}
                  />
                  <Row
                    label="BMI verified"
                    value={patient.verification.bmi_verified_at
                      ? formatDateTime(patient.verification.bmi_verified_at)
                      : "Not verified"}
                  />
                </DCard>

                {/* Patient flags */}
                {patient.flags.length > 0 && (
                  <DCard icon={AlertTriangle} title="Clinical Flags">
                    <div className="space-y-2">
                      {patient.flags.map((flag) => (
                        <div key={flag.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-warn-bg border border-warn-bdr">
                          <span className="text-[12px] font-bold text-warn">{flag.code}</span>
                          <span className={`text-[10px] font-semibold px-2 py-px rounded-full ${
                            flag.severity === "high"   ? "bg-err text-white"  :
                            flag.severity === "medium" ? "bg-warn text-white" :
                            "bg-info text-white"
                          }`}>{flag.severity}</span>
                          <span className="text-[11px] text-t2">{formatDate(flag.raised_at)}</span>
                        </div>
                      ))}
                    </div>
                  </DCard>
                )}

                {/* G6 flags */}
                {order.g6_flags.length > 0 && (
                  <DCard icon={ShieldAlert} title="G6 Flags">
                    <div className="flex items-center gap-2 p-3 bg-ok-bg border border-ok-bdr rounded-md">
                      <ShieldAlert className="w-4 h-4 text-ok shrink-0" />
                      <div>
                        <p className="text-[13px] font-semibold text-ok">G6PD Screening Complete</p>
                        <p className="text-[11px] text-t2 mt-0.5">Flags: {order.g6_flags.join(", ")}</p>
                      </div>
                    </div>
                  </DCard>
                )}

                {patient.flags.length === 0 && order.g6_flags.length === 0 && (
                  <EmptyPane message="No clinical flags raised on this patient." />
                )}
              </div>
            )}

            {/* ── Tab: Prescription ───────────────────────────────────────── */}
            {activeTab === "prescription" && (
              <div className="space-y-4">
                <DCard icon={Package} title="Product">
                  <Row label="Medication" value={order.product.medication} />
                  <Row label="Dose" value={order.product.dose} />
                  <Row label="Strength" value={order.product.strength} />
                  <Row label="Plan" value={order.product.plan} />
                  <Row label="Order type" value={order.type} />
                  <Row label="Amendment window" value={order.amendment_window.replace(/_/g, " ")} />
                </DCard>

                <DCard icon={FileText} title="Payment">
                  <Row label="Amount authorised" value={order.amount_authorised != null ? `£${order.amount_authorised.toFixed(2)}` : "—"} />
                  <Row label="Amount charged" value={order.amount_charged != null ? `£${order.amount_charged.toFixed(2)}` : "Pending"} />
                  {order.ryft_authorisation_id && (
                    <Row label="Ryft auth ID" value={order.ryft_authorisation_id} mono />
                  )}
                </DCard>

                {/* SLA — only relevant for clinical_check */}
                {order.status === "clinical_check" && (
                  <DCard icon={Clock} title="SLA Status">
                    <div className={`flex items-start gap-3 p-3 rounded-md border ${
                      slaBreached ? "bg-err-bg border-err-bdr" :
                      slaWarning  ? "bg-warn-bg border-warn-bdr" :
                      "bg-info-bg border-info-bdr"
                    }`}>
                      <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${
                        slaBreached ? "text-err" : slaWarning ? "text-warn" : "text-info"
                      }`} />
                      <div>
                        <p className={`text-[13px] font-semibold ${
                          slaBreached ? "text-err" : slaWarning ? "text-warn" : "text-info"
                        }`}>
                          {slaBreached
                            ? "SLA Breached"
                            : slaWarning
                            ? `SLA Warning — ${slaHoursLeft}h remaining`
                            : `On track — ${slaHoursLeft}h remaining`}
                        </p>
                        <p className="text-[11px] text-t2 mt-0.5">
                          Target: {slaTotalHours}h from submission · Breach at {formatDateTime(order.sla_breach_at)}
                        </p>
                      </div>
                    </div>
                  </DCard>
                )}
              </div>
            )}

            {/* ── Tab: Amendments ─────────────────────────────────────────── */}
            {activeTab === "amendments" && (
              <DCard icon={Pencil} title="Amendments">
                <EmptyPane message="No amendments have been raised on this order." />
              </DCard>
            )}

            {/* ── Tab: Activity log ───────────────────────────────────────── */}
            {activeTab === "activity" && (
              <DCard icon={Activity} title="Activity Log">
                <div className="relative">
                  {/* vertical line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-bdr" />

                  <ol className="space-y-0 -mx-4">
                    {/* Clinical decision — shown first if it exists (most recent) */}
                    {order.clinical_decision && (
                      <TimelineItem
                        dot={
                          order.clinical_decision.decision === "approved" ? "ok" :
                          order.clinical_decision.decision === "declined" ? "err" : "info"
                        }
                        title={`Order ${order.clinical_decision.decision}`}
                        meta={`by ${order.clinical_decision.prescriber_user_id} · ${formatDateTime(order.clinical_decision.decided_at)}`}
                      >
                        {order.clinical_decision.rationale && (
                          <p className="mt-1.5 text-[12px] text-t1 bg-page-bg border border-bdr rounded px-3 py-2 leading-relaxed">
                            {order.clinical_decision.rationale}
                          </p>
                        )}
                      </TimelineItem>
                    )}

                    {/* Status changes shown if order moved from clinical_check */}
                    {order.status !== "clinical_check" && (
                      <TimelineItem
                        dot="neutral"
                        title={`Status changed to ${order.status.replace(/_/g, " ")}`}
                        meta={order.clinical_decision
                          ? formatDateTime(order.clinical_decision.decided_at)
                          : formatDateTime(order.updated_at)}
                      />
                    )}

                    {/* Order submitted — always last (oldest) */}
                    <TimelineItem
                      dot="neutral"
                      title="Order submitted"
                      meta={formatDateTime(order.created_at)}
                      isLast
                    >
                      <p className="mt-1 text-[11px] text-t3">
                        {order.product.medication} {order.product.dose} · <span className="capitalize">{order.type}</span> order
                      </p>
                    </TimelineItem>
                  </ol>
                </div>
              </DCard>
            )}
          </div>
        </div>
      </div>

      {/* ── Approve dialog ────────────────────────────────────────────────── */}
      <Dialog open={modal === "approve"} onOpenChange={(o) => { if (!o) { setModal(null); setRationale(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Confirm Approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-[13px] text-t2">
              You are about to approve order <strong className="font-mono">{order.id}</strong> for{" "}
              <strong>{d.full_name}</strong>. This will trigger prescription generation.
            </p>
            <Textarea
              placeholder="Briefly note your clinical reasoning… (required)"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={4}
              className="text-[13px]"
            />
            <p className="text-[11px] text-t3">
              Your rationale is recorded in the audit trail against your prescriber ID.
            </p>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => { setModal(null); setRationale(""); }} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleDecide("approved", rationale)}
              disabled={isSubmitting || rationale.trim().length < 10}
              className="bg-ok hover:bg-ok/90 text-white"
            >
              {isSubmitting ? "Approving…" : "Confirm Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Decline dialog ────────────────────────────────────────────────── */}
      <Dialog open={modal === "decline"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Decline Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-[13px] text-t2">
              Provide a clinical rationale for declining <strong className="font-mono">{order.id}</strong>. This will be recorded in the patient record.
            </p>
            <Textarea
              placeholder="Enter decline rationale…"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={4}
              className="text-[13px]"
            />
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleDecide("declined", rationale)}
              disabled={isSubmitting || !rationale.trim()}
              variant="destructive"
            >
              {isSubmitting ? "Declining…" : "Confirm Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Query dialog ──────────────────────────────────────────────────── */}
      <Dialog open={modal === "query"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Raise Query</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-[13px] text-t2">
              Describe the query for <strong className="font-mono">{order.id}</strong>. The patient will be contacted to provide clarification.
            </p>
            <Textarea
              placeholder="Enter query details…"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={4}
              className="text-[13px]"
            />
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleDecide("queried", rationale)}
              disabled={isSubmitting || !rationale.trim()}
              className="bg-info hover:bg-info/90 text-white"
            >
              {isSubmitting ? "Raising query…" : "Raise Query"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-[13px] font-medium transition-all ${
          toast.type === "ok"
            ? "bg-ok-bg border-ok-bdr text-ok"
            : "bg-err-bg border-err-bdr text-err"
        }`}>
          {toast.type === "ok"
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Package;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
        <Icon className="w-3.5 h-3.5 text-brand" />
        <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-0.5">
      <span className="text-[12px] text-t3 shrink-0">{label}</span>
      <span className={`text-[12px] text-t1 text-right ${mono ? "font-mono" : "font-medium"}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "ok" | "warn";
}) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-center ${
      highlight === "ok"   ? "bg-ok-bg border-ok-bdr"     :
      highlight === "warn" ? "bg-warn-bg border-warn-bdr" :
      "bg-page-bg border-bdr"
    }`}>
      <div className={`text-[15px] font-bold ${
        highlight === "ok" ? "text-ok" : highlight === "warn" ? "text-warn" : "text-t1"
      }`}>{value}</div>
      {sub && <div className="text-[10px] text-t3 mt-0.5">{sub}</div>}
      <div className="text-[10px] text-t3 mt-1 leading-tight">{label}</div>
    </div>
  );
}

function EmptyPane({ message }: { message: string }) {
  return (
    <p className="text-[12px] text-t3 text-center py-6">{message}</p>
  );
}

function TimelineItem({
  dot,
  title,
  meta,
  children,
  isLast = false,
}: {
  dot: "ok" | "err" | "info" | "neutral";
  title: string;
  meta: string;
  children?: React.ReactNode;
  isLast?: boolean;
}) {
  const dotColor =
    dot === "ok"      ? "bg-ok border-ok-bdr"     :
    dot === "err"     ? "bg-err border-err-bdr"   :
    dot === "info"    ? "bg-info border-info-bdr"  :
    "bg-bdr border-bdr-d";

  return (
    <li className={`relative pl-8 pr-4 py-3.5 ${!isLast ? "border-b border-bdr" : ""}`}>
      <div className={`absolute left-[3px] top-[18px] w-3.5 h-3.5 rounded-full border-2 ${dotColor}`} />
      <div className="text-[12.5px] font-semibold text-t1 capitalize">{title}</div>
      <div className="text-[11px] text-t3 mt-0.5">{meta}</div>
      {children}
    </li>
  );
}
