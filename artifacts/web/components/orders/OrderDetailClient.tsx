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
  FileText, Camera, Ban, Paperclip, FileCheck2, Upload,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatDateTime, formatBMI, formatWeight, formatAge } from "@/lib/format";
import { decideOrder, listAmendments, createAmendment, createClinicalNote, listCourierEvents, cancelOrder, getAmendment, getOrder, CURRENT_USER, NOW } from "@/lib/api/mock";
import {
  Dialog as ConfirmDialog, DialogContent as ConfirmDialogContent,
  DialogHeader as ConfirmDialogHeader, DialogTitle as ConfirmDialogTitle,
  DialogFooter as ConfirmDialogFooter,
} from "@/components/ui/dialog";
import { type AIDraftResult } from "@/components/clinical-notes/AINoteDraftingModal";
import { can } from "@/lib/permissions";
import type { Order, Patient, Clinic, ClinicId, ClinicalNote, Amendment, CourierEvent } from "@/types";
import { CourierTrackingCard } from "@/components/orders/CourierTrackingCard";
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
import { LogIncidentModal } from "@/components/incidents/LogIncidentModal";
import { OrderNICEChecklistCard } from "./OrderNICEChecklistCard";
import { OrderDoseEscalationGateCard } from "./OrderDoseEscalationGateCard";
import { OrderWeightTrajectoryCard } from "./OrderWeightTrajectoryCard";
import { OrderBMIValidationCard } from "./OrderBMIValidationCard";
import { PharmacyCommsPanel } from "@/components/pharmacy-comms/PharmacyCommsPanel";
import { DispatchDateCard } from "./DispatchDateCard";
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

type RightTab = "questionnaire" | "clinical_evidence" | "prescription" | "amendments" | "activity" | "notes" | "pharmacy_comms" | "intercom";

const RIGHT_TABS: { key: RightTab; label: string }[] = [
  { key: "questionnaire",     label: "Questionnaire"     },
  { key: "clinical_evidence", label: "Clinical evidence" },
  { key: "prescription",      label: "Prescription"      },
  { key: "notes",             label: "Notes"             },
  { key: "amendments",        label: "Amendments"        },
  { key: "pharmacy_comms",    label: "Pharmacy Comms"    },
  { key: "intercom",          label: "Intercom"          },
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
  const [incidentOpen, setIncidentOpen]         = useState(false);
  // Intercom tab compose state — persisted to sessionStorage per order so it
  // survives tab switches within the same order detail session.
  const intercomStorageKey = `orderDetail:intercom:${initialOrder.id}`;
  const [requestInfoMsg, setRequestInfoMsg]     = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = window.sessionStorage.getItem(intercomStorageKey);
      if (!raw) return "";
      return (JSON.parse(raw) as { msg?: string }).msg ?? "";
    } catch { return ""; }
  });
  const [requestInfoSent, setRequestInfoSent]   = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.sessionStorage.getItem(intercomStorageKey);
      if (!raw) return false;
      return Boolean((JSON.parse(raw) as { sent?: boolean }).sent);
    } catch { return false; }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        intercomStorageKey,
        JSON.stringify({ msg: requestInfoMsg, sent: requestInfoSent }),
      );
    } catch { /* ignore quota / disabled storage */ }
  }, [intercomStorageKey, requestInfoMsg, requestInfoSent]);

  // BLD-11.2 — Royal Mail courier events
  const [courierEvents, setCourierEvents]     = useState<CourierEvent[]>([]);

  // BLD-5.1/5.2 — amendments tab state
  const [amendments, setAmendments]           = useState<Amendment[]>([]);
  const [amendType, setAmendType]             = useState<Amendment["type"]>("dose_change");
  const [amendReason, setAmendReason]         = useState("");
  const [isRaisingAmend, setIsRaisingAmend]   = useState(false);
  const [showAmendForm, setShowAmendForm]     = useState(false);
  const [amendLoaded, setAmendLoaded]         = useState(false);

  // Task-85 — Staff-side GLP-1 prescription upload (uploads on patient's behalf
  // when they email/post a copy instead of using the intake success screen).
  const [isUploadingPx, setIsUploadingPx]     = useState(false);
  const [pxUploadError, setPxUploadError]     = useState<string | null>(null);

  // Task-38 — Cancel Order flow
  const [cancelOpen, setCancelOpen]           = useState(false);
  const [cancelReason, setCancelReason]       = useState("");
  const [isCancelling, setIsCancelling]       = useState(false);
  const [refundAmendment, setRefundAmendment] = useState<Amendment | null>(null);

  // Load linked refund amendment so OrderPaymentSummary can surface refunded amount.
  useEffect(() => {
    if (!order.refund_amendment_id) {
      setRefundAmendment(null);
      return;
    }
    getAmendment(clinicId, order.refund_amendment_id)
      .then((a) => setRefundAmendment(a))
      .catch(() => setRefundAmendment(null));
  }, [clinicId, order.refund_amendment_id, amendments]);

  // Task-85 — Staff uploads the GLP-1 prescription on the patient's behalf.
  // Follows the same presigned-URL flow as the patient intake page (Task-82):
  //   Step 1: ask the server for a presigned PUT URL (intake request-url route).
  //   Step 2: PUT the file bytes directly to object storage.
  //   Step 3: finalize via the staff route, which tags the audit log with
  //           source='staff_upload' and CURRENT_USER.id as the uploader.
  // The fixture's attachPxUpload re-validates GLP-1 path, type, and size, and
  // emits [AUDIT] entries (Layer 3).
  async function handleStaffPxUpload(file: File) {
    setPxUploadError(null);
    if (file.size > 10 * 1024 * 1024) {
      setPxUploadError("File is larger than 10 MB.");
      return;
    }
    setIsUploadingPx(true);
    try {
      // Step 1 — request presigned URL (reuses the patient intake route).
      const urlRes = await fetch(
        `/api/intake/${clinicId}/orders/${order.id}/px-upload/request-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            size: file.size,
            content_type: file.type,
          }),
        },
      );
      if (!urlRes.ok) {
        const b = await urlRes.json().catch(() => ({}));
        throw new Error(b?.message || `Could not start upload (${urlRes.status}).`);
      }
      const { uploadURL, object_path } = (await urlRes.json()) as {
        uploadURL: string;
        object_path: string;
      };

      // Step 2 — PUT bytes directly to object storage.
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error(`File transfer failed (${putRes.status}).`);

      // Step 3 — finalize via the staff route (tags audit with staff actor).
      const finalRes = await fetch(
        `/api/orders/${clinicId}/${order.id}/px-upload`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ object_path, filename: file.name }),
        },
      );
      if (!finalRes.ok) {
        const b = await finalRes.json().catch(() => ({}));
        throw new Error(b?.message || `Upload failed (${finalRes.status}).`);
      }
      // Re-read the order so the UI reflects the new px_upload + cleared flag.
      const updated = await getOrder(clinicId, order.id);
      setOrder(updated);
      setToast({
        message: `Prescription uploaded on patient's behalf — ${file.name}.`,
        type: "ok",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Prescription upload failed.";
      setPxUploadError(msg);
      setToast({ message: msg, type: "err" });
    } finally {
      setIsUploadingPx(false);
    }
  }

  async function handleCancelOrder() {
    if (cancelReason.trim().length < 20) return;
    setIsCancelling(true);
    try {
      const result = await cancelOrder(clinicId, order.id, cancelReason.trim());
      setOrder(result.order);
      setCancelOpen(false);
      setCancelReason("");
      if (result.refund_amendment) {
        setAmendments((prev) => [result.refund_amendment!, ...prev]);
        setRefundAmendment(result.refund_amendment);
        setToast({
          message: `Order cancelled — refund amendment ${result.refund_amendment.id} created for review.`,
          type: "ok",
        });
      } else if (result.release_auth_failed) {
        // Ryft release call failed — order is still flipped to cancelled, but
        // finance needs to manually reconcile / retry the auth release.
        setToast({
          message: `Order cancelled, but Ryft auth release failed: ${result.release_auth_failed.message}. Finance must reconcile manually.`,
          type: "err",
        });
      } else {
        setToast({
          message: "Order cancelled — payment authorisation released (no charge taken).",
          type: "ok",
        });
      }
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Cancellation failed. Please retry.",
        type: "err",
      });
    } finally {
      setIsCancelling(false);
    }
  }

  const canCancelOrder =
    (order.status === "approved" || order.status === "in_dispensing") &&
    !order.dispatched_at;
  const cancelBranch: "release_auth" | "refund_amendment" =
    order.amount_charged == null ? "release_auth" : "refund_amendment";
  const refundDetails = refundAmendment?.status === "applied" ? refundAmendment.details : null;
  const refundedAmount =
    refundDetails && typeof refundDetails.refunded_amount_gbp === "number"
      ? (refundDetails.refunded_amount_gbp as number)
      : null;
  const ryftRefundRef =
    refundDetails && typeof refundDetails.ryft_refund_ref === "string"
      ? (refundDetails.ryft_refund_ref as string)
      : null;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // BLD-11.2 — Load Royal Mail courier events for dispatched/delivered orders
  useEffect(() => {
    if (order.status === "dispatched" || order.status === "delivered") {
      listCourierEvents(clinicId, { order_id: order.id }).then(setCourierEvents).catch(() => {});
    }
  }, [order.id, order.status, clinicId]);

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
  const canWriteIncident  = can(CURRENT_USER, "write", "incidents");

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
  // Task-81 — GLP-1 higher-dose patients must upload their current prescription
  // before a prescriber can approve. Block matches the decideOrder safety gate.
  const pxUploadPending =
    order.contextual_flags?.includes("Px upload pending") ?? false;
  const pxUploadMissing = pxUploadPending && order.px_upload == null;

  const approveBlockedReason =
    hasHighSeverityFlag && !hasB4Acknowledged
      ? "Patient has an unacknowledged high-severity flag — acknowledge before approving"
      : niceChecklistIncomplete
      ? "Complete all NICE CG189 checklist items on the Clinical evidence tab before approving"
      : isDoseEscalation
      ? "Dose escalation requires prior dose evidence in the questionnaire"
      : weightHistoryMissing
      ? "No weight history on record — patient must log a check-in weight before approval"
      : pxUploadMissing
      ? "GLP-1 prescription upload required from patient before approval"
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

          <div className="flex items-center gap-2">
            {/* Intercom — Request info: switches to Intercom tab */}
            <button
              onClick={() => { setActiveTab("intercom"); setRequestInfoSent(false); setRequestInfoMsg(""); }}
              className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold text-t2 border border-bdr bg-surface hover:border-brand hover:text-brand rounded-md transition-colors"
            >
              <Mail className="w-4 h-4" /> Request info
            </button>
            {canWriteIncident && (
              <button
                onClick={() => setIncidentOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold text-err border border-err-bdr bg-err-bg hover:bg-err hover:text-white rounded-md transition-colors"
              >
                <AlertTriangle className="w-4 h-4" /> Log incident
              </button>
            )}
            {/* Task-38 — Cancel Order (approved/in_dispensing, not dispatched) */}
            {canCancelOrder && (
              <button
                onClick={() => setCancelOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold text-err border border-err-bdr bg-err-bg hover:bg-err hover:text-white rounded-md transition-colors"
              >
                <Ban className="w-4 h-4" /> Cancel Order
              </button>
            )}
            {canDecide && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">

        {/* Task-38 — Cancelled banner */}
        {order.status === "cancelled" && order.cancelled_at && (
          <div className="mx-6 mt-4 bg-err-bg border border-err-bdr rounded-lg px-4 py-3">
            <div className="flex items-start gap-3">
              <Ban className="w-4 h-4 text-err shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-err">
                  Order cancelled — {formatDateTime(order.cancelled_at)}
                </p>
                {order.cancellation_reason && (
                  <p className="text-[12px] text-err mt-1 leading-relaxed">
                    {order.cancellation_reason}
                  </p>
                )}
                {order.refund_amendment_id && (
                  <p className="text-[11px] text-t2 mt-1.5">
                    Refund amendment:{" "}
                    <Link
                      href={`/${clinicId}/amendments/${order.refund_amendment_id}`}
                      className="font-mono font-semibold text-brand hover:underline"
                    >
                      {order.refund_amendment_id}
                    </Link>
                    {refundAmendment && (
                      <span className="ml-2 capitalize">· {refundAmendment.status}</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

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
              <div className="mt-2.5 flex items-center gap-4">
                <Link
                  href={`/${clinicId}/patients/${patient.id}`}
                  className="flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline"
                >
                  View patient profile →
                </Link>
                <Link
                  href={`/${clinicId}/patients/${patient.id}?tab=notifications&order_id=${order.id}`}
                  className="flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline"
                >
                  Notification log →
                </Link>
              </div>
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

            {/* BLD-4.6.3 — Four-scenario dispatch date calculator */}
            <DispatchDateCard
              approvedAt={order.clinical_decision?.decided_at ?? order.created_at}
              holidays={clinic.config.holiday_calendar}
              orderStatus={order.status}
            />

            {/* BLD-11.2 — Royal Mail tracking (dispatched / delivered orders) */}
            {(order.status === "dispatched" || order.status === "delivered") && order.royal_mail_tracking_id && (
              <CourierTrackingCard
                trackingId={order.royal_mail_tracking_id ?? null}
                events={courierEvents}
                compact
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
              <OrderQuestionnaireCard
                questionnaire_responses={order.questionnaire_responses as Record<string, unknown>}
                questionConfig={
                  order.type === "new"
                    ? clinic.config.questionnaire_order
                    : clinic.config.questionnaire_reorder
                }
              />
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

                {/* BLD-16.2 — BMI AI Validation (FeelTru only while flag is off for VSC) */}
                {clinic.config.features.bmi_ai_validation_enabled && (
                  <OrderBMIValidationCard patient={patient} order={order} />
                )}

                {/* BLD-14.4 — Dose escalation gate */}
                {order.dose_escalation_gate?.is_dose_escalation && (
                  <OrderDoseEscalationGateCard gate={order.dose_escalation_gate} />
                )}

                {/* Task 61 — Patient-uploaded GLP-1 prescription (intake higher-dose path) */}
                {(order.px_upload || order.contextual_flags?.includes("Px upload pending")) && (
                  <DCard icon={FileCheck2} title="Patient-uploaded prescription">
                    {order.px_upload ? (
                      (() => {
                        const streamUrl = `/api/storage${order.px_upload.object_path}`;
                        const isImage = order.px_upload.content_type.startsWith("image/");
                        return (
                          <div className="space-y-3">
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-ok-bg border border-ok-bdr">
                              <Paperclip className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-t1 truncate">
                                  {order.px_upload.filename}
                                </p>
                                <p className="text-[11px] text-t2 mt-0.5">
                                  {order.px_upload.content_type} ·{" "}
                                  {order.px_upload.size < 1024 * 1024
                                    ? `${(order.px_upload.size / 1024).toFixed(1)} KB`
                                    : `${(order.px_upload.size / 1024 / 1024).toFixed(1)} MB`}{" "}
                                  · uploaded {formatDateTime(order.px_upload.uploaded_at)}
                                </p>
                              </div>
                              <a
                                href={streamUrl}
                                target="_blank"
                                rel="noreferrer"
                                download={order.px_upload.filename}
                                className="text-[11px] font-semibold text-ok hover:underline shrink-0"
                              >
                                Open
                              </a>
                            </div>
                            {isImage && (
                              <img
                                src={streamUrl}
                                alt={`Prescription upload from patient (${order.px_upload.filename})`}
                                className="max-h-72 w-auto rounded-md border border-bdr"
                              />
                            )}
                            {!isImage && (
                              <p className="text-[11px] text-t2">
                                PDF — use “Open” to view the full document in a new tab.
                              </p>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-warn-bg border border-warn-bdr">
                          <AlertTriangle className="w-4 h-4 text-warn shrink-0" />
                          <p className="text-[12px] text-warn">
                            Patient requested a higher GLP-1 starting dose — awaiting prescription
                            upload from the intake success screen.
                          </p>
                        </div>
                        {/* Task-85 — Staff-side upload on patient's behalf.
                            Visible only while px_upload is null and the order still
                            carries the "Px upload pending" contextual flag, and only
                            for users with write access to orders. */}
                        {can(CURRENT_USER, "write", "orders") && (
                          <div className="p-3 rounded-lg border border-bdr bg-surface">
                            <p className="text-[12px] font-semibold text-t1">
                              Upload on patient&apos;s behalf
                            </p>
                            <p className="text-[11px] text-t2 mt-0.5">
                              If the patient emailed or posted a copy, attach it here.
                              JPG, PNG, WebP, HEIC or PDF, up to 10&nbsp;MB.
                            </p>
                            <label
                              className={`mt-3 inline-flex items-center gap-2 px-3 py-2 text-[12px] font-semibold rounded-md border cursor-pointer transition-colors ${
                                isUploadingPx
                                  ? "border-bdr text-t3 bg-surface cursor-not-allowed"
                                  : "border-brand text-brand bg-surface hover:bg-brand hover:text-white"
                              }`}
                            >
                              <Upload className="w-4 h-4" />
                              {isUploadingPx ? "Uploading…" : "Choose file"}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                                className="hidden"
                                disabled={isUploadingPx}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  e.target.value = ""; // allow re-selecting same file
                                  if (f) void handleStaffPxUpload(f);
                                }}
                              />
                            </label>
                            {pxUploadError && (
                              <p className="mt-2 text-[11px] text-err">{pxUploadError}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </DCard>
                )}

                {/* BLD-14.5 — Weight trajectory */}
                {order.weight_history && order.weight_history.length > 0 && (
                  <OrderWeightTrajectoryCard history={order.weight_history} orderType={order.type} />
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
                  refunded_amount_gbp={refundedAmount}
                  ryft_refund_ref={ryftRefundRef}
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

            {/* Intercom tab — conversation thread + compose */}
            {activeTab === "intercom" && (
              <div className="flex flex-col" style={{ minHeight: "520px" }}>
                {/* Context strip */}
                <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-page-bg border border-bdr rounded-lg">
                  <Mail className="w-4 h-4 text-brand shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-t1">
                      {patient.demographic.full_name}
                    </p>
                    <p className="text-[11px] text-t3">
                      Intercom conversation · order {order.id} · {clinic.config.intercom_workspace_id ? `workspace ${clinic.config.intercom_workspace_id}` : "no workspace configured"}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-ok-bg text-ok border border-ok-bdr rounded">
                    Active
                  </span>
                </div>

                {/* Thread */}
                <div className="flex-1 space-y-4 mb-4 overflow-y-auto">
                  {/* System message */}
                  <div className="text-center">
                    <span className="text-[10px] font-semibold text-t3 bg-page-bg border border-bdr px-3 py-1 rounded-full">
                      Conversation started · {formatDate(order.created_at)}
                    </span>
                  </div>
                  {/* Incoming (patient) */}
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-brand">
                        {patient.demographic.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </span>
                    </div>
                    <div className="bg-page-bg border border-bdr rounded-xl rounded-tl-none px-3 py-2 max-w-[320px]">
                      <p className="text-[12px] text-t1 leading-relaxed">
                        Hi, I wanted to check — should I continue with the same dose or wait for my next appointment?
                      </p>
                      <p className="text-[10px] text-t3 mt-1">{formatDateTime(order.created_at)}</p>
                    </div>
                  </div>
                  {/* Outgoing (clinic) */}
                  <div className="flex gap-2 justify-end">
                    <div className="bg-brand text-white rounded-xl rounded-tr-none px-3 py-2 max-w-[320px]">
                      <p className="text-[12px] leading-relaxed">
                        Hi {patient.demographic.full_name.split(" ")[0]}, thanks for reaching out. We&apos;re reviewing your order now — we may need a few more details.
                      </p>
                      <p className="text-[10px] text-white/70 mt-1">Livera Care Team · {formatDate(order.created_at)}</p>
                    </div>
                  </div>
                  {/* Sent confirmation */}
                  {requestInfoSent && (
                    <div className="flex gap-2 justify-end">
                      <div className="bg-brand text-white rounded-xl rounded-tr-none px-3 py-2 max-w-[320px]">
                        <p className="text-[12px] leading-relaxed">{requestInfoMsg}</p>
                        <p className="text-[10px] text-white/70 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Sent just now
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Compose */}
                {!requestInfoSent ? (
                  <div className="border border-bdr rounded-lg px-4 py-3 space-y-2 bg-surface">
                    <p className="text-[11px] font-semibold text-t3 uppercase tracking-wider">Send via Intercom</p>
                    <textarea
                      rows={3}
                      placeholder={`Ask ${patient.demographic.full_name.split(" ")[0]} for more information…`}
                      value={requestInfoMsg}
                      onChange={(e) => setRequestInfoMsg(e.target.value)}
                      className="w-full text-[13px] border border-bdr rounded-lg px-3 py-2 bg-page-bg text-t1 placeholder:text-t3 resize-none focus:outline-none focus:border-brand"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-t3">Patient will be notified by email</p>
                      <button
                        disabled={!requestInfoMsg.trim()}
                        onClick={() => { if (requestInfoMsg.trim()) setRequestInfoSent(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-white bg-brand hover:bg-brand/90 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Send className="w-3.5 h-3.5" /> Send
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-ok-bdr rounded-lg px-4 py-3 bg-ok-bg">
                    <p className="text-[12px] font-semibold text-ok text-center flex items-center justify-center gap-1.5">
                      <CheckCircle className="w-4 h-4" /> Message sent to {patient.demographic.full_name.split(" ")[0]}
                    </p>
                  </div>
                )}
              </div>
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
        blockedReason={approveBlockedReason}
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        orderId={order.id}
        patientName={d.full_name}
        clinic={clinic}
        clinicId={clinicId}
        isSubmitting={isSubmitting}
        onApprove={(body, aiData) => handleDecideWithNote("approved", body, aiData)}
      />
      {/* Task-38 — Cancel Order confirmation dialog */}
      <ConfirmDialog open={cancelOpen} onOpenChange={(o) => !o && !isCancelling && setCancelOpen(false)}>
        <ConfirmDialogContent className="max-w-md">
          <ConfirmDialogHeader>
            <ConfirmDialogTitle className="text-base flex items-center gap-2">
              <Ban className="w-4 h-4 text-err" />
              Cancel order {order.id}
            </ConfirmDialogTitle>
          </ConfirmDialogHeader>
          <div className="space-y-3">
            {/* Context summary — patient, product, amount */}
            <div className="rounded-md border border-bdr bg-page-bg px-3 py-2 space-y-1 text-[12px]">
              <div className="flex justify-between gap-3">
                <span className="text-t3">Patient</span>
                <span className="text-t1 font-semibold text-right">{d.full_name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-t3">Medication</span>
                <span className="text-t1 font-medium text-right">
                  {order.product.medication} {order.product.dose} · {order.product.plan}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-t3">Amount authorised</span>
                <span className="text-t1 font-medium text-right tabular-nums">
                  £{(order.amount_authorised ?? 0).toFixed(2)}
                </span>
              </div>
              {order.amount_charged != null && (
                <div className="flex justify-between gap-3">
                  <span className="text-t3">Amount captured</span>
                  <span className="text-t1 font-medium text-right tabular-nums">
                    £{order.amount_charged.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Branch-specific explanation */}
            <div className={`text-[12px] rounded-md px-3 py-2 border ${
              cancelBranch === "release_auth"
                ? "bg-info-bg border-info-bdr text-info"
                : "bg-warn-bg border-warn-bdr text-warn"
            }`}>
              {cancelBranch === "release_auth" ? (
                <>
                  <strong>Auth release:</strong> payment has been authorised but not captured.
                  Ryft will release the £{(order.amount_authorised ?? 0).toFixed(2)} hold on {d.full_name}&apos;s card immediately. No money has left the patient&apos;s account.
                </>
              ) : (
                <>
                  <strong>Refund required:</strong> £{(order.amount_charged ?? 0).toFixed(2)} has already been captured from {d.full_name}.
                  A refund amendment will be created and routed to a clinician with refund authority for review before the money is returned.
                </>
              )}
            </div>

            {/* Irreversible warning */}
            <div className="flex items-start gap-2 text-[12px] rounded-md px-3 py-2 border border-err-bdr bg-err-bg text-err">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>This action cannot be undone.</strong> Cancelling will stop dispensing for this order and notify {d.full_name.split(" ")[0]} by email. A new order would have to be raised to resume treatment.
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-t3 uppercase tracking-wider mb-1 block">
                Cancellation reason <span className="text-err normal-case">(min 20 characters)</span>
              </label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why is this order being cancelled? Captured on the audit log and patient notification."
                rows={4}
                className="text-[13px]"
              />
              <p className={`text-[11px] mt-1 ${cancelReason.trim().length >= 20 ? "text-ok" : "text-t3"}`}>
                {cancelReason.trim().length} / 20 characters
              </p>
            </div>
          </div>
          <ConfirmDialogFooter className="gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setCancelOpen(false)} disabled={isCancelling}>
              Keep order
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleCancelOrder}
              disabled={isCancelling || cancelReason.trim().length < 20}
            >
              <Ban className="w-3.5 h-3.5 mr-1" />
              {isCancelling
                ? "Cancelling…"
                : cancelBranch === "release_auth"
                  ? "Confirm — Release auth"
                  : "Confirm — Create refund"}
            </Button>
          </ConfirmDialogFooter>
        </ConfirmDialogContent>
      </ConfirmDialog>

      {incidentOpen && (
        <LogIncidentModal
          clinicId={clinicId}
          patients={[]}
          orders={[order]}
          prefilledPatient={patient}
          prefilledOrder={order}
          onClose={() => setIncidentOpen(false)}
          onSave={() => setIncidentOpen(false)}
        />
      )}

    </div>
  );
}
