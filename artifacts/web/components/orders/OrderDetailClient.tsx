"use client";

/**
 * OrderDetailClient — Wave 3 (BLD-4.4) + Wave 4 additions:
 *   BLD-4.6.1 — Intervention 7-working-day SLA timer (on_hold orders)
 *   BLD-5.1/5.2 — Amendment window enforcement + raise amendment panel
 *   BLD-6.3 — DeclineConfirmModal + InterventionConfirmModal (AI-note gates)
 *   BLD-6.2 — ApproveConfirmModal replacing legacy OrderDecisionDialogs approve path
 *   Fix Cycle 1 — BLOCKER 1: handleDecideWithNote enforces 3-layer chain (note → decide → audit)
 *   Fix Cycle 1 — BLOCKER 2: ApproveConfirmModal wired; AI audit trail captured on approve path
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package, User, ArrowLeft, ChevronRight, CheckCircle, XCircle,
  MessageSquare, ShieldAlert, Scale, ShieldCheck, AlertTriangle,
  Stethoscope, Pencil, Activity, Clock, Send, Mail, CreditCard,
  FileText, Camera,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatDateTime, formatBMI, formatWeight, formatAge } from "@/lib/format";
import { decideOrder, listAmendments, createAmendment, createClinicalNote, CURRENT_USER, NOW } from "@/lib/api/mock";
import { type AIDraftResult } from "@/components/clinical-notes/AINoteDraftingModal";
import { can } from "@/lib/permissions";
import type { Order, Patient, Clinic, ClinicId, ClinicalNote, Amendment } from "@/types";
import { DCard, Row, Metric, EmptyPane } from "./orderPrimitives";
import { OrderDecisionDialogs, type Modal, type ToastState } from "./OrderDecisionDialogs";
import { OrderQuestionnaireCard } from "./OrderQuestionnaireCard";
import { OrderSLACard } from "./OrderSLACard";
import { OrderPaymentSummary } from "./OrderPaymentSummary";
import { OrderActivityTimeline } from "./OrderActivityTimeline";
import { SlaTimerWidget } from "@/components/sla/SlaTimerWidget";
import { ClinicalNoteEditor } from "@/components/clinical-notes/ClinicalNoteEditor";
import { RecentNotesCard } from "@/components/timeline/RecentNotesCard";
import { DeclineConfirmModal } from "./DeclineConfirmModal";
import { InterventionConfirmModal } from "./InterventionConfirmModal";
import { ApproveConfirmModal } from "./ApproveConfirmModal";
import { OrderNICEChecklistCard } from "./OrderNICEChecklistCard";
import { OrderDoseEscalationGateCard } from "./OrderDoseEscalationGateCard";
import { OrderWeightTrajectoryCard } from "./OrderWeightTrajectoryCard";
import { PharmacyCommsPanel } from "@/components/pharmacy-comms/PharmacyCommsPanel";
import { addWorkingHours } from "@/lib/utils/workingHours";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface OrderDetailClientProps {
  initialOrder: Order;
  patient: Patient;
  clinic: Clinic;
  clinicId: ClinicId;
  initialClinicalNotes: ClinicalNote[];
}

type RightTab = "questionnaire" | "clinical_evidence" | "prescription" | "amendments" | "activity" | "notes" | "pharmacy_comms";

const RIGHT_TABS: { key: RightTab; label: string }[] = [
  { key: "questionnaire",     label: "Questionnaire"     },
  { key: "clinical_evidence", label: "Clinical evidence" },
  { key: "prescription",      label: "Prescription"      },
  { key: "notes",             label: "Notes"             },
  { key: "amendments",        label: "Amendments"        },
  { key: "pharmacy_comms",    label: "Pharmacy Comms"    },
  { key: "activity",          label: "Activity log"      },
];

// Amendment window: open statuses (BLD-5.1/5.2 — DEC-01)
const AMENDMENT_OPEN_STATUSES: Order["status"][] = [
  "clinical_check", "on_hold", "approved", "in_dispensing",
];

const AMENDMENT_TYPES: { value: Amendment["type"]; label: string }[] = [
  { value: "dose_change",    label: "Dose change"       },
  { value: "dose_escalation",label: "Dose escalation"   },
  { value: "address_change", label: "Address change"    },
  { value: "reschedule",     label: "Reschedule"        },
  { value: "cancellation",   label: "Cancellation"      },
  { value: "refund",         label: "Refund"            },
];

// Consent definitions — three canonical consent types across all Livera clinics.
// Given/declined derived from patient.consents_given at render time.
const CONSENT_DEFS = [
  {
    id:   "consent_treatment",
    label: "Clinical treatment",
    meta:  "Patient consented to GLP-1 prescribing under Livera clinical pathway",
  },
  {
    id:   "consent_gp",
    label: "GP communication",
    meta:  "Patient consented to GP letter on first prescription and material clinical changes",
  },
  {
    id:   "consent_photo",
    label: "Photo evidence",
    meta:  "Patient consented to share weight/scale/injection-site photos for clinical evidence",
  },
] as const;

export function OrderDetailClient({
  initialOrder,
  patient,
  clinic,
  clinicId,
  initialClinicalNotes,
}: OrderDetailClientProps) {
  const [order, setOrder]             = useState<Order>(initialOrder);
  const [modal, setModal]             = useState<Modal>(null);
  const [rationale, setRationale]     = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast]             = useState<ToastState | null>(null);
  const [activeTab, setActiveTab]     = useState<RightTab>("clinical_evidence");
  const [notes, setNotes]             = useState<ClinicalNote[]>(initialClinicalNotes);

  // BLD-6.3 — new modal state (replaces modal='decline' / modal='query')
  // BLD-6.2 / Fix Cycle 1 BLOCKER 2 — approveOpen replaces modal='approve'
  const [declineOpen, setDeclineOpen]           = useState(false);
  const [interventionOpen, setInterventionOpen] = useState(false);
  const [approveOpen, setApproveOpen]           = useState(false);

  // BLD-5.1/5.2 — amendments tab state
  const [amendments, setAmendments]           = useState<Amendment[]>([]);
  const [amendType, setAmendType]             = useState<Amendment["type"]>("dose_change");
  const [amendReason, setAmendReason]         = useState("");
  const [isRaisingAmend, setIsRaisingAmend]   = useState(false);
  const [showAmendForm, setShowAmendForm]     = useState(false);
  const [amendLoaded, setAmendLoaded]         = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Load amendments when tab is opened
  useEffect(() => {
    if (activeTab === "amendments" && !amendLoaded) {
      listAmendments(clinicId, { }).then((all) => {
        setAmendments(all.filter((a) => a.order_id === order.id));
        setAmendLoaded(true);
      }).catch(() => setAmendLoaded(true));
    }
  }, [activeTab, amendLoaded, clinicId, order.id]);

  /**
   * handleDecideWithNote — Fix Cycle 1 BLOCKER 1 + BLOCKER 2.
   *
   * 3-layer safety chain:
   *   Layer 1 (UI): modal enforces min-chars clinical note before calling here
   *   Layer 2 (server): createClinicalNote validates role + minChars; decideOrder
   *                     validates approval_gate note exists (on approve path)
   *   Layer 3 (audit): [AUDIT] on both createClinicalNote and decideOrder
   *
   * AI audit fields (ai_drafted, ai_draft_original, prompt_version_id) are passed
   * through from the modal's aiData and stored on the ClinicalNote record.
   */
  async function handleDecideWithNote(
    decision: "approved" | "declined" | "queried",
    body: string,
    aiData?: Omit<AIDraftResult, "body">,
  ) {
    setIsSubmitting(true);
    try {
      // Step 1 — create clinical note with full AI audit trail
      const newNote = await createClinicalNote(clinicId, {
        patient_id:                  patient.id,
        order_id:                    order.id,
        body,
        approval_gate_for_order_id:  decision === "approved" ? order.id : null,
        ai_drafted:                  aiData?.ai_drafted ?? false,
        ai_draft_original:           aiData?.ai_draft_original ?? null,
        ai_prompt_version_id:        aiData?.prompt_version_id ?? null,
        ai_draft_accepted_at:        aiData?.ai_drafted ? NOW : null,
        ai_draft_edited_by:          aiData?.ai_drafted ? CURRENT_USER.id : null,
      });
      setNotes((prev) => [newNote, ...prev]);

      // Step 2 — execute clinical decision (decideOrder verifies note gate on approve)
      const updated = await decideOrder(clinicId, order.id, decision, body);
      setOrder(updated);
      setModal(null);
      setDeclineOpen(false);
      setInterventionOpen(false);
      setApproveOpen(false);
      setRationale("");
      setToast({
        message:
          decision === "approved"  ? "Order approved successfully."               :
          decision === "declined"  ? "Order declined and patient notified."       :
                                     "Intervention raised — patient will be contacted.",
        type: decision === "approved" ? "ok" : decision === "declined" ? "err" : "ok",
      });
      setActiveTab("activity");
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Action failed. Please retry.", type: "err" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRaiseAmendment() {
    if (!amendReason.trim()) return;
    setIsRaisingAmend(true);
    try {
      const amend = await createAmendment(clinicId, order.id, amendType, amendReason.trim());
      setAmendments((prev) => [amend, ...prev]);
      setAmendReason("");
      setShowAmendForm(false);
      setToast({ message: "Amendment raised successfully.", type: "ok" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to raise amendment.", type: "err" });
    } finally {
      setIsRaisingAmend(false);
    }
  }

  const minChars          = clinic.config.clinical_note_min_chars;
  const canWriteNotes     = can(CURRENT_USER, "write", "clinical_notes");
  const canDecide         = order.status === "clinical_check" && can(CURRENT_USER, "decide", "orders");

  const hasHighSeverityFlag = patient.flags.some((f) => f.severity === "high");
  const hasB4Acknowledged   = patient.flags.some((f) => f.code === "B4_acknowledged");
  const isDoseEscalation    = order.dose_escalation_gate?.is_dose_escalation === true && !(order.dose_escalation_gate?.prior_evidence_uploaded ?? false);

  // BLD-14.2 — Three-gate Clinical Check sequence enforcement
  const niceChecklistIncomplete =
    order.nice_checklist != null &&
    order.nice_checklist.length > 0 &&
    order.nice_checklist.some((item) => !item.checked);

  const weightHistoryMissing =
    order.weight_history != null &&
    order.weight_history.length === 0;

  // BLD-15.2 — ED safeguarding flag detection (questionnaire trigger keys)
  const ED_TRIGGER_KEYS: Record<string, string[]> = {
    eating_pattern:          ["binge_eating", "restrictive", "purging", "restriction"],
    ed_history:              ["yes", "current", "active"],
    purging_behaviour:       ["yes"],
    restriction_behaviour:   ["yes"],
    eating_disorder_current: ["yes"],
  };
  const edSafeguardingTrigger =
    Object.entries(order.questionnaire_responses).find(([key, value]) => {
      const triggers = ED_TRIGGER_KEYS[key];
      return Boolean(triggers && triggers.includes(String(value).toLowerCase()));
    }) ?? null;

  // Fix Cycle 1 BLOCKER 2: hasApprovalNote gate removed — the approval note is now
  // created inside ApproveConfirmModal via handleDecideWithNote (3-layer chain).
  // BLD-14.2: all three gates must be clear before approve is enabled.
  const approveBlockedReason =
    hasHighSeverityFlag && !hasB4Acknowledged
      ? "Patient has an unacknowledged high-severity flag — acknowledge before approving"
      : niceChecklistIncomplete
      ? "Complete all NICE CG189 checklist items on the Clinical evidence tab before approving"
      : isDoseEscalation
      ? "Dose escalation requires prior dose evidence in the questionnaire"
      : weightHistoryMissing
      ? "No weight history on record — patient must log a check-in weight before approval"
      : null;
  const approveBlocked = approveBlockedReason !== null;

  const d             = patient.demographic;
  const age           = formatAge(d.dob);
  const hasB4         = patient.flags.some((f) => f.code === "B4");
  const now           = new Date(NOW).getTime();
  const warnAt        = new Date(order.sla_warn_at).getTime();
  const breachAt      = new Date(order.sla_breach_at).getTime();
  const slaBreached   = now > breachAt;
  const slaWarning    = !slaBreached && now > warnAt;
  const slaHoursLeft  = Math.max(0, Math.floor((breachAt - now) / 3600000));
  const slaTotalHours = clinic.config.default_slas.approval_breach_hours;
  const weightLostKg  = +(patient.baseline.baseline_weight_kg - patient.latest.weight_kg).toFixed(1);
  const bmiDelta      = +(patient.baseline.baseline_bmi - patient.latest.bmi).toFixed(1);
  const weightGained  = weightLostKg < 0;

  // BLD-4.6.1 — Intervention SLA: 7 working days = intervention_resolution_wd * 8 working hours
  const interventionResolutionHours = clinic.config.default_slas.intervention_resolution_wd * 8;
  const interventionSlaDeadline =
    order.status === "on_hold" && order.intervention_raised_at
      ? addWorkingHours(
          order.intervention_raised_at,
          interventionResolutionHours,
          clinic.config.holiday_calendar,
        )
      : null;

  // BLD-5.1/5.2 — Amendment window status
  const amendmentWindowOpen = AMENDMENT_OPEN_STATUSES.includes(order.status);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-bdr bg-surface shrink-0">
        <nav className="flex items-center gap-1.5 text-[12px] text-t3 mb-3">
          <Link href={`/${clinicId}/orders`} className="flex items-center gap-1 hover:text-brand transition-colors">
            <ArrowLeft className="w-3 h-3" /> Orders
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
                  <span className="text-[9px] font-bold bg-ok-bg text-ok border border-ok-bdr px-2 py-px rounded">G6</span>
                )}
              </div>
              <p className="text-[12px] text-t2 mt-0.5">
                {order.product.medication} {order.product.dose} · <span className="capitalize">{order.type}</span> order · {formatDate(order.created_at)}
              </p>
            </div>
          </div>

          {canDecide && (
            <div className="flex items-center gap-2">
              {/* BLD-6.3 — opens InterventionConfirmModal instead of modal='query' */}
              <button
                onClick={() => setInterventionOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-info border border-info-bdr bg-info-bg hover:bg-info hover:text-white rounded-md transition-colors"
              >
                <MessageSquare className="w-4 h-4" /> Query
              </button>
              {/* BLD-6.3 — opens DeclineConfirmModal instead of modal='decline' */}
              <button
                onClick={() => setDeclineOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-err border border-err-bdr bg-err-bg hover:bg-err hover:text-white rounded-md transition-colors"
              >
                <XCircle className="w-4 h-4" /> Decline
              </button>
              <div className="flex flex-col items-end gap-1">
                {/* Fix Cycle 1 BLOCKER 2: opens ApproveConfirmModal (clinical note + AI audit captured inside) */}
                <button
                  onClick={() => { if (!approveBlocked) setApproveOpen(true); }}
                  disabled={approveBlocked}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-md transition-colors shadow-sm ${
                    approveBlocked
                      ? "bg-ok/40 text-white cursor-not-allowed"
                      : "text-white bg-ok hover:bg-ok/90"
                  }`}
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                {approveBlocked && approveBlockedReason && (
                  <span className="text-[10px] text-err max-w-[220px] text-right leading-tight">
                    {approveBlockedReason}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">

        {/* BLD-15.2 — ED safeguarding banner */}
        {edSafeguardingTrigger && (
          <div className="mx-6 mt-4 bg-err-bg border border-err-bdr rounded-lg px-4 py-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-4 h-4 text-err shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-err">Eating Disorder Safeguarding Flag</p>
                <p className="text-[12px] text-err mt-1 leading-relaxed">
                  This patient's questionnaire contains an eating disorder indicator
                  {" ("}
                  <span className="font-mono font-semibold">
                    {edSafeguardingTrigger[0]}: {String(edSafeguardingTrigger[1])}
                  </span>
                  {"). Follow the ED referral pathway before prescribing. Do not approve without clinical escalation."}
                </p>
              </div>
              <a
                href="https://www.beateatingdisorders.org.uk/get-information-and-support/get-help-for-myself/i-need-support-now/helplines/"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[11px] font-semibold text-err border border-err-bdr rounded-md px-2.5 py-1.5 hover:bg-err hover:text-white transition-colors whitespace-nowrap"
              >
                ED pathway
              </a>
            </div>
          </div>
        )}

        <div className="px-6 py-5 grid grid-cols-5 gap-4 items-start">

          {/* Left — order sidebar 2/5 */}
          <div className="col-span-2 space-y-3 sticky top-5">

            {/* ── Patient strip ── */}
            <div className="bg-surface border border-bdr rounded-lg px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-mid to-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {d.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] font-semibold text-t1 truncate">{d.full_name}</span>
                    {hasB4 && <span className="text-[9px] font-bold bg-warn-bg text-warn border border-warn-bdr px-1.5 py-px rounded shrink-0">B4</span>}
                    {patient.vip && <span className="text-[9px] font-bold bg-coach-bg text-coach border border-coach-bdr px-1.5 py-px rounded shrink-0">VIP</span>}
                  </div>
                  <div className="text-[10.5px] text-t3 font-mono">{patient.id} · {age} yrs · {d.sex_at_birth}</div>
                </div>
              </div>
              <Link
                href={`/${clinicId}/patients/${patient.id}`}
                className="mt-2.5 flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline"
              >
                View patient profile →
              </Link>
            </div>

            {/* ── Order summary ── */}
            <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-bdr bg-page-bg">
                <FileText className="w-3.5 h-3.5 text-brand" />
                <h2 className="text-[11px] font-bold text-t2 uppercase tracking-wider">Order summary</h2>
              </div>
              <div className="px-4 py-3 space-y-2 text-[12px]">
                <div className="flex justify-between gap-2">
                  <span className="text-t3">Product</span>
                  <span className="text-t1 font-medium text-right">{order.product.medication} {order.product.dose}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-t3">Quantity</span>
                  <span className="text-t1 font-medium">{order.product.plan} · {order.product.strength}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-t3">Total</span>
                  <span className="text-t1 font-medium">
                    {order.amount_authorised != null ? `£${order.amount_authorised.toFixed(2)}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-t3">Payment</span>
                  <span className={`font-medium ${order.amount_charged != null ? "text-ok" : "text-warn"}`}>
                    {order.amount_charged != null
                      ? `Captured · ${order.ryft_authorisation_id ?? "—"}`
                      : order.ryft_authorisation_id
                        ? `Authorised · ${order.ryft_authorisation_id}`
                        : "Pending"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-t3">Submitted</span>
                  <span className="text-t1 font-medium">{formatDate(order.created_at)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-t3">Source</span>
                  <span className="text-t1 font-medium capitalize">{order.type === "reorder" ? "Reorder questionnaire" : "New patient questionnaire"}</span>
                </div>
              </div>
            </div>

            {/* ── Patient consent ── */}
            <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-bdr bg-page-bg">
                <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                <h2 className="text-[11px] font-bold text-t2 uppercase tracking-wider">Patient consent</h2>
              </div>
              <div className="divide-y divide-bdr">
                {CONSENT_DEFS.map((cd) => {
                  const record = patient.consents_given.find((c) => c.consent_id === cd.id);
                  const given  = !!record;
                  return (
                    <div key={cd.id} className={`flex items-start gap-3 px-4 py-2.5 ${given ? "" : "bg-err-bg/30"}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${given ? "bg-ok text-white" : "bg-err text-white"}`}>
                        {given ? "✓" : "✕"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[12px] font-semibold text-t1">{cd.label}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-px rounded ${given ? "bg-ok-bg text-ok" : "bg-err-bg text-err"}`}>
                            {given ? "Given" : "Declined"}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-t3 mt-0.5 leading-snug">{cd.meta}</p>
                        {record && (
                          <p className="text-[10px] text-t3 mt-0.5">
                            {formatDate(record.given_at)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── GP letter quick action ── */}
            {clinic.config.features.gp_letter_enabled && (
              <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-bdr bg-page-bg">
                  <Mail className="w-3.5 h-3.5 text-brand" />
                  <h2 className="text-[11px] font-bold text-t2 uppercase tracking-wider">GP letter</h2>
                </div>
                <div className="px-4 py-3">
                  {patient.consents_given.some((c) => c.consent_id === "consent_gp") ? (
                    <div className="flex items-start gap-2.5">
                      <CheckCircle className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-ok">GP letter can be sent</p>
                        {patient.gp && (
                          <p className="text-[10.5px] text-t3 mt-0.5">
                            Patient has given GP communication consent · {patient.gp.name}
                          </p>
                        )}
                        <Link
                          href={`/${clinicId}/gp-letters`}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold text-white bg-brand hover:bg-brand/90 rounded-md transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" /> Send GP letter
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5">
                      <XCircle className="w-4 h-4 text-err shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[12px] font-semibold text-err">GP letter blocked</p>
                        <p className="text-[10.5px] text-t3 mt-0.5">
                          Patient has not consented to GP communication. UK GDPR Article 9.
                        </p>
                      </div>
                    </div>
                  )}
                  {order.dose_escalation_gate?.is_dose_escalation && (
                    <p className="text-[10px] text-t3 mt-2 leading-snug border-t border-bdr pt-2">
                      Auto-trigger rule: dose escalations to 10mg+ automatically queue a GP notification (consent permitting).
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* BLD-4.6.1 — Intervention SLA widget (on_hold only) */}
            {order.status === "on_hold" && interventionSlaDeadline && (
              <SlaTimerWidget
                sla_deadline={interventionSlaDeadline}
                label={`Intervention SLA (${clinic.config.default_slas.intervention_resolution_wd} working days)`}
                total_hours={interventionResolutionHours}
                variant="full"
              />
            )}
          </div>

          {/* Right — tabbed panel 3/5 */}
          <div className="col-span-3">
            <div className="flex items-center border-b border-bdr overflow-x-auto mb-4">
              {RIGHT_TABS.map(({ key, label }) => (
                <button key={key} onClick={() => setActiveTab(key)} className={`px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${activeTab === key ? "border-brand text-brand" : "border-transparent text-t2 hover:text-t1"}`}>
                  {label}
                  {key === "notes" && notes.length > 0 && (
                    <span className="ml-1 text-[10px] opacity-60">{notes.length}</span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === "questionnaire" && (
              <OrderQuestionnaireCard questionnaire_responses={order.questionnaire_responses as Record<string, unknown>} />
            )}

            {activeTab === "clinical_evidence" && (
              <div className="space-y-4">

                {/* BLD-14.3 — NICE CG189 checklist */}
                {order.nice_checklist && order.nice_checklist.length > 0 && (
                  <OrderNICEChecklistCard
                    orderStatus={order.status}
                    initialChecklist={order.nice_checklist}
                  />
                )}

                {/* BLD-14.4 — Dose escalation gate */}
                {order.dose_escalation_gate?.is_dose_escalation && (
                  <OrderDoseEscalationGateCard gate={order.dose_escalation_gate} />
                )}

                {/* BLD-14.5 — Weight trajectory */}
                {order.weight_history && order.weight_history.length > 0 && (
                  <OrderWeightTrajectoryCard history={order.weight_history} />
                )}

                <DCard icon={Scale} title="Weight Journey">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <Metric label="Baseline weight" value={formatWeight(patient.baseline.baseline_weight_kg)} sub={`BMI ${formatBMI(patient.baseline.baseline_bmi)}`} />
                    <Metric label="Current weight"  value={formatWeight(patient.latest.weight_kg)}           sub={`BMI ${formatBMI(patient.latest.bmi)}`} />
                    <Metric label="Total change" value={`${weightGained ? "+" : "−"}${Math.abs(weightLostKg)} kg`} sub={`${weightGained ? "+" : "−"}${Math.abs(bmiDelta)} BMI`} highlight={weightGained ? "warn" : "ok"} />
                  </div>
                  <Row label="Height"          value={`${patient.baseline.height_cm} cm`} />
                  <Row label="Latest recorded" value={formatDate(patient.latest.recorded_at)} />
                </DCard>

                <DCard icon={ShieldCheck} title="Identity Verification">
                  <Row label="Sumsub ID"         value={patient.verification.sumsub_id || "—"} mono />
                  <Row label="Identity verified"  value={patient.verification.identity_verified_at ? formatDateTime(patient.verification.identity_verified_at) : "Not verified"} />
                  <Row label="BMI verified"       value={patient.verification.bmi_verified_at ? formatDateTime(patient.verification.bmi_verified_at) : "Not verified"} />
                </DCard>

                {patient.flags.length > 0 && (
                  <DCard icon={AlertTriangle} title="Clinical Flags">
                    <div className="space-y-2">
                      {patient.flags.map((flag) => (
                        <div key={flag.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-warn-bg border border-warn-bdr">
                          <span className="text-[12px] font-bold text-warn">{flag.code}</span>
                          <span className={`text-[10px] font-semibold px-2 py-px rounded-full ${flag.severity === "high" ? "bg-err text-white" : flag.severity === "medium" ? "bg-warn text-white" : "bg-info text-white"}`}>{flag.severity}</span>
                          <span className="text-[11px] text-t2">{formatDate(flag.raised_at)}</span>
                        </div>
                      ))}
                    </div>
                  </DCard>
                )}

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

            {activeTab === "prescription" && (
              <div className="space-y-4">
                <DCard icon={Stethoscope} title="Product">
                  <Row label="Medication"       value={order.product.medication} />
                  <Row label="Dose"             value={order.product.dose} />
                  <Row label="Strength"         value={order.product.strength} />
                  <Row label="Plan"             value={order.product.plan} />
                  <Row label="Order type"       value={order.type} />
                  <Row label="Amendment window" value={order.amendment_window.replace(/_/g, " ")} />
                </DCard>

                <OrderPaymentSummary
                  amount_authorised={order.amount_authorised}
                  amount_charged={order.amount_charged}
                  ryft_authorisation_id={order.ryft_authorisation_id}
                />

                <DCard icon={Activity} title="Patient-facing SLA messaging">
                  <Row label="Clinical review" value={clinic.config.patient_sla_copy.clinical_review_message} />
                  <Row label="Delivery"        value={clinic.config.patient_sla_copy.delivery_message} />
                </DCard>

                {order.status === "clinical_check" && (
                  <>
                    <SlaTimerWidget
                      sla_deadline={order.sla_breach_at}
                      sla_warn_at={order.sla_warn_at}
                      label="Approval SLA"
                      total_hours={slaTotalHours}
                      variant="full"
                    />
                    <OrderSLACard
                      slaBreached={slaBreached}
                      slaWarning={slaWarning}
                      slaHoursLeft={slaHoursLeft}
                      slaTotalHours={slaTotalHours}
                      sla_breach_at={order.sla_breach_at}
                    />
                  </>
                )}

                {/* BLD-4.6.1 — Intervention SLA in prescription tab */}
                {order.status === "on_hold" && interventionSlaDeadline && (
                  <SlaTimerWidget
                    sla_deadline={interventionSlaDeadline}
                    label={`Intervention SLA (${clinic.config.default_slas.intervention_resolution_wd} working days)`}
                    total_hours={interventionResolutionHours}
                    variant="full"
                  />
                )}

                {order.status === "expired" && order.expired_at && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-err-bg border border-err-bdr">
                    <Clock className="w-4 h-4 text-err shrink-0" />
                    <div>
                      <p className="text-[13px] font-semibold text-err">Order expired</p>
                      <p className="text-[11px] text-t2 mt-0.5">
                        Expired {formatDateTime(order.expired_at)} — order released, no charge taken.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "notes" && (
              <div className="space-y-4">
                {order.status === "clinical_check" && (
                  <SlaTimerWidget
                    sla_deadline={order.sla_breach_at}
                    sla_warn_at={order.sla_warn_at}
                    label="Approval SLA"
                    total_hours={slaTotalHours}
                    variant="chip"
                  />
                )}

                <ClinicalNoteEditor
                  clinicId={clinicId}
                  patientId={patient.id}
                  orderId={order.id}
                  minChars={minChars}
                  canWrite={canWriteNotes}
                  isApprovalNote={order.status === "clinical_check"}
                  onNoteCreated={(note) => setNotes((prev) => [note, ...prev])}
                />

                <RecentNotesCard
                  notes={notes}
                  clinicId={clinicId}
                  patientId={patient.id}
                  maxItems={5}
                />
              </div>
            )}

            {/* BLD-5.1/5.2 — Amendments tab */}
            {activeTab === "amendments" && (
              <div className="space-y-4">
                {/* Window status banner */}
                <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                  amendmentWindowOpen
                    ? "bg-ok-bg border-ok-bdr"
                    : "bg-err-bg border-err-bdr"
                }`}>
                  {amendmentWindowOpen
                    ? <CheckCircle className="w-4 h-4 text-ok shrink-0" />
                    : <XCircle className="w-4 h-4 text-err shrink-0" />}
                  <div>
                    <p className={`text-[13px] font-semibold ${amendmentWindowOpen ? "text-ok" : "text-err"}`}>
                      Amendment window {amendmentWindowOpen ? "open" : "closed"}
                    </p>
                    <p className="text-[11px] text-t2 mt-0.5">
                      {amendmentWindowOpen
                        ? `Amendments can be raised — order is ${order.status.replace(/_/g, " ")}.`
                        : `Amendments are not permitted after dispatch (order is ${order.status.replace(/_/g, " ")}).`}
                      {order.primed_clinical_check_completed && amendmentWindowOpen && (
                        <span className="ml-1 text-warn font-medium">
                          Order is post-Primed clinical check — amendments will trigger a pharmacy comms thread (DEC-28).
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Raise amendment form (BLD-5.2) */}
                {amendmentWindowOpen && can(CURRENT_USER, "write", "amendments") && (
                  <DCard icon={Pencil} title="Raise Amendment">
                    {!showAmendForm ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => setShowAmendForm(true)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Raise new amendment
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-t3 uppercase tracking-wider mb-1 block">
                              Amendment type
                            </label>
                            <Select
                              value={amendType}
                              onValueChange={(v) => setAmendType(v as Amendment["type"])}
                            >
                              <SelectTrigger className="text-[13px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {AMENDMENT_TYPES.map((t) => (
                                  <SelectItem key={t.value} value={t.value} className="text-[13px]">
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-t3 uppercase tracking-wider mb-1 block">
                            Reason
                          </label>
                          <Textarea
                            value={amendReason}
                            onChange={(e) => setAmendReason(e.target.value)}
                            placeholder="Describe the reason for this amendment…"
                            rows={3}
                            className="text-[13px]"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={handleRaiseAmendment}
                            disabled={!amendReason.trim() || isRaisingAmend}
                            className="gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {isRaisingAmend ? "Raising…" : "Submit amendment"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setShowAmendForm(false); setAmendReason(""); }}
                            disabled={isRaisingAmend}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </DCard>
                )}

                {/* Amendments list */}
                <DCard icon={Pencil} title={`Amendments on this order (${amendments.length})`}>
                  {amendments.length === 0 ? (
                    <EmptyPane message="No amendments have been raised on this order." />
                  ) : (
                    <div className="space-y-2">
                      {amendments.map((a) => (
                        <div key={a.id} className="rounded-lg border border-bdr bg-page-bg p-3 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] text-t3">{a.id}</span>
                            <span className={`text-[10px] font-bold px-2 py-px rounded-full ${
                              a.status === "approved" ? "bg-ok text-white" :
                              a.status === "rejected" ? "bg-err text-white" :
                              a.status === "reviewing" ? "bg-info text-white" :
                              "bg-warn text-white"
                            }`}>
                              {a.status}
                            </span>
                          </div>
                          <p className="text-[12px] font-semibold text-t1 capitalize">{a.type.replace(/_/g, " ")}</p>
                          {a.details.reason != null && (
                            <p className="text-[11px] text-t2">{`${a.details.reason}`}</p>
                          )}
                          <p className="text-[10px] text-t3">{formatDateTime(a.requested_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </DCard>
              </div>
            )}

            {/* BLD-16.1 / BLD-16.10 — Pharmacy Comms tab */}
            {activeTab === "pharmacy_comms" && (
              <PharmacyCommsPanel
                clinicId={clinicId}
                anchorType="order"
                anchorId={order.id}
              />
            )}

            {activeTab === "activity" && (
              <OrderActivityTimeline order={order} />
            )}
          </div>
        </div>
      </div>

      {/* OrderDecisionDialogs retained for toast rendering only — approve path now uses ApproveConfirmModal */}
      <OrderDecisionDialogs
        orderId={order.id}
        patientName={d.full_name}
        modal={modal}
        setModal={setModal}
        rationale={rationale}
        setRationale={setRationale}
        isSubmitting={isSubmitting}
        handleDecide={(decision, r) => handleDecideWithNote(decision, r)}
        toast={toast}
      />

      {/* BLD-6.3 — Decline + Intervention modals (replace inline dialogs) */}
      <DeclineConfirmModal
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        orderId={order.id}
        patientName={d.full_name}
        clinic={clinic}
        clinicId={clinicId}
        isSubmitting={isSubmitting}
        onDecline={(body, aiData) => handleDecideWithNote("declined", body, aiData)}
      />
      <InterventionConfirmModal
        open={interventionOpen}
        onClose={() => setInterventionOpen(false)}
        orderId={order.id}
        patientName={d.full_name}
        clinic={clinic}
        clinicId={clinicId}
        isSubmitting={isSubmitting}
        onIntervene={(body, aiData) => handleDecideWithNote("queried", body, aiData)}
      />
      {/* Fix Cycle 1 BLOCKER 2 — ApproveConfirmModal (replaces legacy modal='approve') */}
      <ApproveConfirmModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        orderId={order.id}
        patientName={d.full_name}
        clinic={clinic}
        clinicId={clinicId}
        isSubmitting={isSubmitting}
        onApprove={(body, aiData) => handleDecideWithNote("approved", body, aiData)}
      />
    </div>
  );
}
