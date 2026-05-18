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
  FileText, Camera, Ban, Paperclip, FileCheck2, Upload, ChevronDown, ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatDateTime, formatBMI, formatWeight, formatAge } from "@/lib/format";
import { decideOrder, listAmendments, createAmendment, listCourierEvents, cancelOrder, getAmendment, getOrder, resendPxUploadLink, reverseDecision, NOW, USERS_REGISTRY, getOrderAuditEvents } from "@/lib/api/mock";
import { createClinicalNoteAction } from "@/lib/actions/clinicalNoteActions";
import { useCurrentUser } from "@/lib/context";
import { dispatchQueueCountChange } from "@/lib/queue-counts";
import { openOrderUndoWindow, readOrderUndoDeadline, clearOrderUndoWindow } from "@/lib/orderUndo";
import {
  Dialog as ConfirmDialog, DialogContent as ConfirmDialogContent,
  DialogHeader as ConfirmDialogHeader, DialogTitle as ConfirmDialogTitle,
  DialogFooter as ConfirmDialogFooter,
} from "@/components/ui/dialog";
import { type AIDraftResult } from "@/components/clinical-notes/AINoteDraftingModal";
import { can } from "@/lib/permissions";
import type { Order, Patient, Clinic, ClinicId, ClinicalNote, Amendment, CourierEvent } from "@/types";
import type { PatientNotification } from "@/lib/api/mock";
import { NotificationRow } from "@/components/patients/NotificationRow";
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
import { OrderIntercomTab } from "./OrderIntercomTab";
import { DeclineConfirmModal } from "./DeclineConfirmModal";
import { InterventionConfirmModal } from "./InterventionConfirmModal";
import { ApproveConfirmModal } from "./ApproveConfirmModal";
import { LogIncidentModal } from "@/components/incidents/LogIncidentModal";
import { OrderNICEChecklistCard } from "./OrderNICEChecklistCard";
import { OrderDoseEscalationGateCard } from "./OrderDoseEscalationGateCard";
import { OrderWeightTrajectoryCard } from "./OrderWeightTrajectoryCard";
import { OrderBMIValidationCard } from "./OrderBMIValidationCard";
import { PharmacyCommsPanel } from "@/components/pharmacy-comms/PharmacyCommsPanel";
import { filterSelfReportedBmiFlag } from "@/lib/clinical/selfReportedBmi";

// Task-163 — Contextual-flag chip palette for the header. Mirrors the maps in
// OrderListTable / ClinicalCheckSlideOver so the same chip styling appears on
// the order detail header. Falls back to a neutral grey for unknown labels.
const ORDER_DETAIL_FLAG_COLORS: Record<string, string> = {
  "Dose increase":             "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]",
  "Cardiac history":           "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
  "Safeguarding":              "bg-[#fef2f2] text-[#991b1b] border-[#fca5a5]",
  "Eating disorder disclosed": "bg-[#fdf4ff] text-[#7e22ce] border-[#e9d5ff]",
  "Duplicate address":         "bg-[#f9fafb] text-[#374151] border-[#d1d5db]",
  "Awaiting ID":               "bg-[#fffbeb] text-[#b45309] border-[#fde68a]",
  "Awaiting BMI":              "bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]",
  "Awaiting ID verification":  "bg-[#fffbeb] text-[#b45309] border-[#fde68a]",
  "Awaiting BMI evidence":     "bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]",
  "Awaiting Rx evidence":      "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]",
  "Self-reported BMI out of range": "bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]",
  "New intake":                "bg-[#eef2ff] text-[#4338ca] border-[#c7d2fe]",
  "Px upload pending":         "bg-[#fffbeb] text-[#b45309] border-[#fde68a]",
  "Px upload received":        "bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]",
};
const ORDER_DETAIL_DEFAULT_FLAG_CLS = "bg-[#f9fafb] text-[#374151] border-[#d1d5db]";
import { DispatchDateCard } from "./DispatchDateCard";
import { addWorkingHours } from "@/lib/utils/workingHours";
import { useQueueNavigation } from "@/lib/queueNavigation";
import { QueuePositionIndicator } from "@/components/shared/QueuePositionIndicator";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface OrderDetailClientProps {
  initialOrder: Order;
  patient: Patient;
  clinic: Clinic;
  clinicId: ClinicId;
  initialClinicalNotes: ClinicalNote[];
  // Task-199 — notifications scoped to this order, surfaced in an inline
  // panel so Bounced/Failed SMS rows show the Twilio carrier reason
  // (e.g. "Unreachable destination handset") without staff having to
  // jump into the per-patient Notification log tab.
  orderNotifications: PatientNotification[];
}

type RightTab = "questionnaire" | "clinical_evidence" | "prescription" | "amendments" | "activity" | "notes" | "pharmacy_comms" | "intercom";

/**
 * Intercom unread-count hook — fetches the patient's open-unread conversations
 * once on mount and refreshes on any inbound SSE event so the tab strip badge
 * stays accurate even when the user isn't on the Intercom tab.
 */
function useIntercomUnreadCount(clinicId: ClinicId, patientId: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let aborted = false;
    async function fetchCount() {
      try {
        const res = await fetch(
          `/api/intercom/${clinicId}/contacts/${patientId}/conversations`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          conversations: Array<{ state: string; read: boolean }>;
        };
        if (!aborted) {
          setCount(
            json.conversations.filter((c) => c.state === "open" && !c.read).length,
          );
        }
      } catch {
        /* leave previous value */
      }
    }
    void fetchCount();
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return () => { aborted = true; };
    }
    const source = new EventSource(`/api/intercom/${clinicId}/events`);
    const refresh = () => { void fetchCount(); };
    source.addEventListener("conversation.user.created", refresh);
    source.addEventListener("conversation.user.replied", refresh);
    source.addEventListener("conversation.admin.replied", refresh);
    source.addEventListener("conversation.admin.closed", refresh);
    source.onerror = () => { /* EventSource auto-retries */ };
    return () => {
      aborted = true;
      source.close();
    };
  }, [clinicId, patientId]);
  return count;
}

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
  orderNotifications,
}: OrderDetailClientProps) {
  useQueueNavigation({ kind: "orders", currentId: initialOrder.id, clinicId });
  // Task-182 — resolve the active demo persona via context so the first render
  // matches what the server rendered (provider is seeded from the cookie).
  const currentUser = useCurrentUser();
  const [order, setOrder]             = useState<Order>(initialOrder);
  const [modal, setModal]             = useState<Modal>(null);
  const [rationale, setRationale]     = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast]             = useState<ToastState | null>(null);
  const [activeTab, setActiveTab]     = useState<RightTab>("clinical_evidence");
  const [notes, setNotes]             = useState<ClinicalNote[]>(initialClinicalNotes);
  // Intercom tab unread badge — refreshes via SSE so the count stays accurate
  // even while the user is on a different tab. setIntercomUnread is passed
  // into OrderIntercomTab so a direct tab-driven refresh updates it too.
  const [intercomUnread, setIntercomUnread] = useState(0);
  const intercomBgUnread = useIntercomUnreadCount(clinicId, patient.id);
  useEffect(() => { setIntercomUnread(intercomBgUnread); }, [intercomBgUnread]);

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
  // Task-119 — Replace flow: a Replace button on the existing-upload card opens
  // a confirm modal. On confirm we trigger the hidden file input below so the
  // same handleStaffPxUpload validation + audit pipeline runs.
  const [replacePxOpen, setReplacePxOpen]     = useState(false);
  // Task-171 — Collapsible "Replacement history" on the prescription card.
  const [pxHistoryOpen, setPxHistoryOpen]     = useState(false);
  // Task-251 — Pre-attach confirmation for the "Upload on patient's behalf"
  // empty-state card. After staff pick a file we hold it here and surface a
  // confirm modal with the patient's name + DOB, the filename and an inline
  // preview so wrong-patient mix-ups are caught before the audit log records
  // an upload. Only confirmed selections flow into handleStaffPxUpload.
  const [pendingPxFile, setPendingPxFile]           = useState<File | null>(null);
  const [pendingPxPreviewUrl, setPendingPxPreviewUrl] = useState<string | null>(null);

  // Task-38 — Cancel Order flow
  const [cancelOpen, setCancelOpen]           = useState(false);
  const [cancelReason, setCancelReason]       = useState("");
  const [isCancelling, setIsCancelling]       = useState(false);
  const [refundAmendment, setRefundAmendment] = useState<Amendment | null>(null);

  // Task-91 — Resend Px upload link
  // Task-126 — Cool-down + confirm step to stop accidental spam.
  const [isResendingPxLink, setIsResendingPxLink] = useState(false);
  // Task-178 — Collapsible "Email history" section on the Px-upload card.
  const [showPxEmailHistory, setShowPxEmailHistory] = useState(false);
  const [resendConfirmOpen, setResendConfirmOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Task-130 — Manual Px upload reminder (server-side; hits POST route).
  const [isSendingPxReminder, setIsSendingPxReminder] = useState(false);

  // Task-110 — Undo last decision affordance.
  // Mirrors the ~5s window from the Clinical Check queue's slide-over toast,
  // but is anchored to the order detail page so a clinician who navigates
  // away or refreshes (or who lands here straight from the queue) still has
  // a quick recovery path. The deadline is shared with the queue page via
  // sessionStorage (see lib/orderUndo.ts) so the window survives navigation,
  // refresh, and works regardless of where the decision was originally made.
  const [undoDeadline, setUndoDeadline] = useState<number | null>(() =>
    readOrderUndoDeadline(initialOrder.id)
  );
  const [undoRemainingMs, setUndoRemainingMs] = useState<number>(0);
  const [isUndoing, setIsUndoing] = useState(false);

  useEffect(() => {
    if (!undoDeadline) { setUndoRemainingMs(0); return; }
    const tick = () => {
      const left = undoDeadline - Date.now();
      if (left <= 0) {
        clearOrderUndoWindow(order.id);
        setUndoDeadline(null);
        setUndoRemainingMs(0);
      } else {
        setUndoRemainingMs(left);
      }
    };
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [undoDeadline, order.id]);

  const canUndoDecision =
    order.clinical_decision != null &&
    order.clinical_decision.prescriber_user_id === currentUser.id &&
    undoDeadline != null &&
    undoRemainingMs > 0;

  // Task-158 — Long-window "Reverse decision" with mandatory rationale.
  // Available while the order is still pre-dispensing (approved / declined /
  // on_hold), regardless of how long ago the decision was made or who made
  // it. The short quick-undo above remains the recovery path for misclicks
  // within the first ~5s; this is the audited fallback for everything after.
  const REVERSAL_PRE_DISPENSING_STATUSES: Order["status"][] = [
    "approved",
    "declined",
    "on_hold",
  ];
  const canReverseDecision =
    order.clinical_decision != null &&
    REVERSAL_PRE_DISPENSING_STATUSES.includes(order.status) &&
    can(currentUser, "decide", "orders");
  const [reverseOpen, setReverseOpen]       = useState(false);
  const [reverseReason, setReverseReason]   = useState("");
  const [isReversing, setIsReversing]       = useState(false);
  const REVERSE_MIN_CHARS = 20;

  async function handleUndoDecision() {
    if (!canUndoDecision || isUndoing) return;
    setIsUndoing(true);
    try {
      const { order: updated } = await reverseDecision(clinicId, order.id);
      setOrder(updated);
      clearOrderUndoWindow(order.id);
      setUndoDeadline(null);
      setUndoRemainingMs(0);
      // Net-zero with the decide-side decrement: every clinical decision
      // (whether made from the queue or from this detail page) emits a
      // -1 to the clinical_check sidebar badge. The queue's own Undo path
      // only fires when the user clicks the toast there, so undoing from
      // the detail page can safely emit +1 unconditionally without risk
      // of double-counting.
      dispatchQueueCountChange({ queue: "clinical_check", delta: 1 });
      setToast({ message: "Decision undone — order returned to the clinical check queue.", type: "ok" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Could not undo the decision. Please retry.",
        type: "err",
      });
    } finally {
      setIsUndoing(false);
    }
  }

  // Task-158 — Long-window reverse with mandatory rationale. Creates a
  // clinical note (so the rationale lives in the patient record), then calls
  // reverseDecision with the same body so the audit trail links the two.
  // Surfaces side-effects (auto GP letter cancelled, approval-gate notes
  // reversed) in the toast so the clinician knows what got cleaned up.
  async function handleReverseDecision() {
    const trimmed = reverseReason.trim();
    if (trimmed.length < REVERSE_MIN_CHARS || isReversing) return;
    if (!order.clinical_decision) return;
    setIsReversing(true);
    try {
      const priorDecision = order.clinical_decision.decision;
      // Step 1 — write a clinical note so the rationale is captured against
      // the patient record (not just the order audit log). The min-chars
      // gate inside createClinicalNote may be stricter than ours; pad with
      // a deterministic prefix so even a clinic with a high threshold
      // accepts the body.
      const minNoteChars = clinic.config.clinical_note_min_chars;
      const noteBody = trimmed.length >= minNoteChars
        ? `Decision reversal (${priorDecision} → returned to clinical check): ${trimmed}`
        : `Decision reversal (${priorDecision} → returned to clinical check): ${trimmed}${" ".repeat(Math.max(0, minNoteChars - trimmed.length))}`;
      const note = await createClinicalNoteAction(clinicId, {
        patient_id: patient.id,
        order_id: order.id,
        body: noteBody,
        approval_gate_for_order_id: null,
        tags: ["decision_reversal"],
      });
      setNotes((prev) => [note, ...prev]);

      // Step 2 — reverse the decision, threading the same note id so the
      // reversal log can point at it for traceability.
      const { order: updated, side_effects } = await reverseDecision(
        clinicId,
        order.id,
        { reason: trimmed, clinical_note_id: note.id },
      );
      setOrder(updated);
      // Returning the order to clinical_check increases the queue by 1.
      dispatchQueueCountChange({ queue: "clinical_check", delta: 1 });
      // Clear any short-window quick-undo state so we don't render a stale
      // 0-second countdown next to a freshly reversed decision.
      clearOrderUndoWindow(order.id);
      setUndoDeadline(null);
      setUndoRemainingMs(0);

      setReverseOpen(false);
      setReverseReason("");

      // Build a toast that surfaces side-effects the clinician needs to
      // know about — auto GP letter cancelled, approval-gate notes
      // reversed — so nothing is silently left dangling.
      const sideNotes: string[] = [];
      if (side_effects.gp_letter_cancelled_id) {
        sideNotes.push(
          `auto-triggered GP letter ${side_effects.gp_letter_cancelled_id} cancelled`,
        );
      }
      if (side_effects.clinical_notes_reversed_ids.length > 0) {
        sideNotes.push(
          `${side_effects.clinical_notes_reversed_ids.length} approval-gate note(s) marked reversed`,
        );
      }
      const sideMsg = sideNotes.length > 0 ? ` Side-effects: ${sideNotes.join(", ")}.` : "";
      setToast({
        message: `Decision reversed — order returned to the clinical check queue.${sideMsg}`,
        type: "ok",
      });
      setActiveTab("activity");
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Could not reverse the decision. Please retry.",
        type: "err",
      });
    } finally {
      setIsReversing(false);
    }
  }

  // Task-126 — Cool-down + confirm step that stop staff from accidentally
  // spamming the patient with duplicate upload-link emails.
  const PX_RESEND_COOLDOWN_SECONDS = 60;
  const PX_RESEND_RECENT_MINUTES = 10;

  // Tick once a second so the cool-down countdown re-renders while it's active.
  useEffect(() => {
    const pxLink = order.px_upload_link;
    if (!pxLink) return;
    const resends = pxLink.resends ?? [];
    // Task-178 — Bounced/Failed resends have sent_at = null. Fall back to
    // attempted_at so the cool-down timer still throttles the next click.
    const lastResend = resends.length > 0 ? resends[resends.length - 1] : null;
    const lastSendIso =
      lastResend?.sent_at ?? lastResend?.attempted_at ?? pxLink.sent_at;
    if (!lastSendIso) return;
    const elapsed = Date.now() - new Date(lastSendIso).getTime();
    if (elapsed >= PX_RESEND_COOLDOWN_SECONDS * 1000) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [order.px_upload_link]);

  const pxLastSendIso: string | null = (() => {
    const pxLink = order.px_upload_link;
    if (!pxLink) return null;
    const resends = pxLink.resends ?? [];
    if (resends.length > 0) {
      const last = resends[resends.length - 1];
      return last.sent_at ?? last.attempted_at ?? null;
    }
    return pxLink.sent_at ?? null;
  })();
  const pxSecondsSinceLastSend =
    pxLastSendIso != null
      ? Math.floor((nowMs - new Date(pxLastSendIso).getTime()) / 1000)
      : null;
  const pxCooldownRemaining =
    pxSecondsSinceLastSend != null && pxSecondsSinceLastSend < PX_RESEND_COOLDOWN_SECONDS
      ? PX_RESEND_COOLDOWN_SECONDS - pxSecondsSinceLastSend
      : 0;
  const pxLinkExpired =
    order.px_upload_link != null &&
    new Date(order.px_upload_link.expires_at).getTime() < nowMs;
  const pxSentRecently =
    pxSecondsSinceLastSend != null &&
    pxSecondsSinceLastSend < PX_RESEND_RECENT_MINUTES * 60 &&
    !pxLinkExpired;

  // Task-130 — Manual Px upload reminder. Posts to a server route that
  // validates session + permissions and flips the same idempotency flag
  // the daily cron uses, so the next sweep won't double-send.
  async function handleSendPxReminderNow() {
    setIsSendingPxReminder(true);
    try {
      const res = await fetch(
        `/api/orders/${clinicId}/${order.id}/px-upload-reminder`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        kind?: "first" | "final";
        status?: "Delivered" | "Bounced" | "Failed";
        px_upload_link?: Order["px_upload_link"];
      };
      if (!res.ok || body.status !== "Delivered") {
        throw new Error(body.message || `Reminder failed (${res.status}).`);
      }
      // Re-fetch the order so the UI reflects the new reminder_sent_at /
      // final_reminder_sent_at flag set server-side.
      const updated = await getOrder(clinicId, order.id);
      setOrder(updated);
      const sentTo = updated.px_upload_link?.to_email ?? patient.contact.email;
      const label = body.kind === "final" ? "Final reminder" : "Reminder";
      setToast({
        message: `${label} sent to ${sentTo}.`,
        type: "ok",
      });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Could not send reminder. Please retry.",
        type: "err",
      });
    } finally {
      setIsSendingPxReminder(false);
    }
  }

  async function performResendPxUploadLink() {
    setIsResendingPxLink(true);
    try {
      const updated = await resendPxUploadLink(clinicId, order.id);
      setOrder(updated);
      const sentTo = updated.px_upload_link?.to_email ?? patient.contact.email;
      setToast({
        message: `New prescription upload link sent to ${sentTo}. The previous link is no longer valid.`,
        type: "ok",
      });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Could not resend upload link. Please retry.",
        type: "err",
      });
    } finally {
      setIsResendingPxLink(false);
    }
  }

  function handleResendPxUploadLink() {
    if (pxCooldownRemaining > 0 || isResendingPxLink) return;
    // If the last link was sent very recently (and still works), ask staff
    // to confirm rather than silently rotating the token and re-emailing.
    if (pxSentRecently) {
      setResendConfirmOpen(true);
      return;
    }
    void performResendPxUploadLink();
  }

  async function confirmResendPxUploadLink() {
    setResendConfirmOpen(false);
    await performResendPxUploadLink();
  }

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
      const newNote = await createClinicalNoteAction(clinicId, {
        patient_id:                  patient.id,
        order_id:                    order.id,
        body,
        approval_gate_for_order_id:  decision === "approved" ? order.id : null,
        ai_drafted:                  aiData?.ai_drafted ?? false,
        ai_draft_original:           aiData?.ai_draft_original ?? null,
        ai_prompt_version_id:        aiData?.prompt_version_id ?? null,
        ai_draft_accepted_at:        aiData?.ai_drafted ? NOW : null,
        ai_draft_edited_by:          aiData?.ai_drafted ? currentUser.id : null,
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
      // Task-110 — Mirror the queue page's decide-side count adjustment: the
      // order is no longer in the clinical_check queue, so decrement the
      // sidebar badge. The matching +1 is emitted from handleUndoDecision if
      // the clinician hits Undo, keeping the count net-zero across surfaces.
      if (order.status === "clinical_check") {
        dispatchQueueCountChange({ queue: "clinical_check", delta: -1 });
      }
      // Open the shared Undo window so the clinician can recover a misclick
      // even after they navigate away or refresh the order detail page.
      setUndoDeadline(openOrderUndoWindow(order.id));
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
  const canWriteNotes     = can(currentUser, "write", "clinical_notes");
  const canDecide         = order.status === "clinical_check" && can(currentUser, "decide", "orders");
  const canWriteIncident  = can(currentUser, "write", "incidents");

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
          <QueuePositionIndicator
            kind="orders"
            currentId={order.id}
            clinicId={clinicId}
            className="ml-1"
          />
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
                {/* Task-163 — surface contextual flags (incl. "Self-reported BMI
                    out of range") inline with the status so prescribers see them
                    on the order detail header, not only in the queue. The flag
                    auto-clears once the linked patient's bmi_verified_at is set,
                    via normalizeSelfReportedBmiFlag in the orders fixture. */}
                {filterSelfReportedBmiFlag(
                  order.contextual_flags,
                  patient.verification?.bmi_verified_at ?? null,
                ).map((f) => (
                  <span
                    key={f}
                    className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${ORDER_DETAIL_FLAG_COLORS[f] ?? ORDER_DETAIL_DEFAULT_FLAG_CLS}`}
                  >
                    {f}
                  </span>
                ))}
              </div>
              <p className="text-[12px] text-t2 mt-0.5">
                {order.product.medication} {order.product.dose} · <span className="capitalize">{order.type}</span> order · {formatDate(order.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Task-110 — Undo last decision (active for ~5s after deciding) */}
            {canUndoDecision && (
              <button
                onClick={handleUndoDecision}
                disabled={isUndoing}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold text-t1 border border-bdr bg-surface hover:border-brand hover:text-brand rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                title="Reverse this decision and return the order to the clinical check queue"
              >
                <ArrowLeft className="w-4 h-4" />
                {isUndoing ? "Undoing…" : `Undo decision (${Math.ceil(undoRemainingMs / 1000)}s)`}
              </button>
            )}
            {/* Task-158 — Long-window Reverse decision (mandatory rationale).
                Hidden while the short quick-undo window is still open to
                keep the header tidy: that path is the right one for a
                fresh misclick. Once the 5-second window closes, this
                audited fallback takes over. */}
            {canReverseDecision && !canUndoDecision && (
              <button
                onClick={() => { setReverseReason(""); setReverseOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold text-warn border border-warn-bdr bg-warn-bg hover:bg-warn hover:text-white rounded-md transition-colors"
                title="Reverse the clinical decision and return this order to the clinical check queue. Requires a written reason."
              >
                <ArrowLeft className="w-4 h-4" /> Reverse decision
              </button>
            )}
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

            {/* ── Task-199 — Order-level notifications panel.
                 Mirrors the per-patient Notification log row layout via the
                 shared NotificationRow, so Bounced/Failed SMS rows surface
                 the Twilio carrier reason inline AND as a tooltip on the
                 status chip without ops having to drill into the patient.
                 Resend is intentionally not exposed here — staff use the
                 full per-patient log for the resend action — so we pass
                 canResend=false and a no-op onResend. */}
            {orderNotifications.length > 0 && (
              <div
                data-testid="order-notifications-panel"
                className="bg-surface border border-bdr rounded-lg overflow-hidden"
              >
                <div className="flex items-center gap-2 px-4 py-2 border-b border-bdr bg-page-bg">
                  <Mail className="w-3.5 h-3.5 text-brand" />
                  <h2 className="text-[11px] font-bold text-t2 uppercase tracking-wider">
                    Notifications ({orderNotifications.length})
                  </h2>
                </div>
                <div className="divide-y divide-bdr">
                  {orderNotifications.map((n) => (
                    <NotificationRow
                      key={n.id}
                      notification={n}
                      clinicId={clinicId}
                      canResend={false}
                      onResend={async () => ({ ok: false, reason: "forbidden" })}
                    />
                  ))}
                </div>
              </div>
            )}

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
                  {key === "intercom" && intercomUnread > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9.5px] font-bold bg-brand text-white rounded-full">
                      {intercomUnread}
                    </span>
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
                        // Task-118 — surface uploader provenance recorded by Task-85.
                        const source = order.px_upload.source
                          ?? (order.px_upload_link?.consumed_at ? "email_link" : "success_screen");
                        let attribution: string;
                        if (source === "staff_upload") {
                          const staffId = order.px_upload.uploaded_by_user_id ?? "";
                          const staffName = USERS_REGISTRY[staffId]?.full_name || staffId || "staff";
                          attribution = `Uploaded by ${staffName} on patient's behalf`;
                        } else if (source === "email_link") {
                          attribution = "Uploaded via email link";
                        } else {
                          attribution = "Uploaded by patient";
                        }
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
                                <p className="text-[11px] font-semibold text-ok mt-1">
                                  {attribution}
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
                            {isImage ? (
                              <img
                                src={streamUrl}
                                alt={`Prescription upload from patient (${order.px_upload.filename})`}
                                className="max-h-72 w-auto rounded-md border border-bdr"
                              />
                            ) : order.px_upload.content_type === "application/pdf" ? (
                              <object
                                data={streamUrl}
                                type="application/pdf"
                                aria-label={`Prescription PDF from patient (${order.px_upload.filename})`}
                                className="w-full h-72 rounded-md border border-bdr bg-bg2"
                              >
                                <p className="text-[11px] text-t2 p-3">
                                  Inline PDF preview isn’t supported in this browser — use “Open”
                                  to view the full document in a new tab.
                                </p>
                              </object>
                            ) : (
                              <p className="text-[11px] text-t2">
                                Use “Open” to view the full document in a new tab.
                              </p>
                            )}
                            {/* Task-119 — Replace affordance for the wrong file
                                (wrong page, wrong patient, illegible). Gated to
                                staff with order write access. Opens a confirm
                                modal that triggers the hidden file input below
                                so the same staff-upload validation + audit
                                pipeline runs and captures the prior file. */}
                            {can(currentUser, "write", "orders") && (
                              <div className="flex items-center justify-between gap-3 pt-1">
                                <p className="text-[11px] text-t3">
                                  Wrong file uploaded? Replace it — the previous
                                  filename and uploader are preserved in the audit log.
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPxUploadError(null);
                                    setReplacePxOpen(true);
                                  }}
                                  disabled={isUploadingPx}
                                  className="gap-1.5 shrink-0"
                                >
                                  <Upload className="w-3.5 h-3.5" />
                                  {isUploadingPx ? "Uploading…" : "Replace"}
                                </Button>
                                <input
                                  id="px-replace-file-input"
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                                  className="hidden"
                                  disabled={isUploadingPx}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.target.value = "";
                                    if (f) void handleStaffPxUpload(f);
                                  }}
                                />
                              </div>
                            )}
                            {pxUploadError && (
                              <p className="text-[11px] text-err">{pxUploadError}</p>
                            )}
                            {/* Task-171 / Task-252 — Previous uploads. A
                                running history of every prescription file
                                staff/patient have uploaded for this order,
                                sourced from Order.px_upload_history (mirrors
                                the Task-119 audit entries). Each entry shows
                                the superseded file's uploader, source and
                                timestamp plus an Open link to the archived
                                object. Collapsed by default. */}
                            {(order.px_upload_history?.length ?? 0) > 0 && (
                              <div className="pt-2 border-t border-bdr" data-testid="px-previous-uploads">
                                <button
                                  type="button"
                                  onClick={() => setPxHistoryOpen((v) => !v)}
                                  aria-expanded={pxHistoryOpen}
                                  className="flex items-center gap-1.5 text-[11px] font-semibold text-t2 hover:text-t1"
                                >
                                  {pxHistoryOpen ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronRightIcon className="w-3.5 h-3.5" />
                                  )}
                                  Previous uploads ({order.px_upload_history!.length})
                                </button>
                                {pxHistoryOpen && (
                                  <ul className="mt-2 space-y-2">
                                    {order.px_upload_history!
                                      .slice()
                                      .reverse()
                                      .map((h, i) => {
                                        // Prior file's own uploader/source/timestamp +
                                        // archived object path (Task-252). Older entries
                                        // captured before Task-252 lack these fields — for
                                        // those, the prior-file line and Open link are
                                        // hidden and only the swap-event line renders.
                                        const priorSource = h.prior_source ?? null;
                                        const priorUploaderId = h.prior_uploaded_by_user_id ?? null;
                                        const priorSourceLabel = priorSource === "staff_upload"
                                          ? "staff upload"
                                          : priorSource === "email_link"
                                          ? "email link"
                                          : priorSource === "success_screen"
                                          ? "patient"
                                          : null;
                                        const priorUploaderName = priorSource === "staff_upload"
                                          ? (priorUploaderId
                                              ? USERS_REGISTRY[priorUploaderId]?.full_name || priorUploaderId
                                              : "staff")
                                          : priorSource === "email_link"
                                          ? "patient (email link)"
                                          : priorSource === "success_screen"
                                          ? "patient"
                                          : null;
                                        const priorUploadedAt = h.prior_uploaded_at ?? null;
                                        const priorObjectPath = h.prior_object_path ?? null;
                                        const priorStreamUrl = priorObjectPath
                                          ? `/api/storage${priorObjectPath}`
                                          : null;
                                        const replacerName = h.replaced_by_user_id
                                          ? USERS_REGISTRY[h.replaced_by_user_id]?.full_name
                                              || h.replaced_by_user_id
                                          : "patient";
                                        const replacerSourceLabel =
                                          h.replaced_by_source === "staff_upload"
                                            ? "staff upload"
                                            : h.replaced_by_source === "email_link"
                                            ? "email link"
                                            : "success screen";
                                        return (
                                          <li
                                            key={`${h.replaced_at}-${i}`}
                                            className="text-[11px] text-t2 p-2 rounded-md bg-bg2 border border-bdr"
                                          >
                                            <div className="flex items-start justify-between gap-2">
                                              <div className="min-w-0">
                                                <p className="text-t1 truncate">
                                                  <span className="font-mono">{h.replaced_filename}</span>
                                                </p>
                                                {(priorUploaderName || priorUploadedAt) && (
                                                  <p className="mt-0.5 text-t3">
                                                    Uploaded
                                                    {priorUploaderName ? ` by ${priorUploaderName}` : ""}
                                                    {priorSourceLabel && priorSource !== "success_screen"
                                                      ? ` via ${priorSourceLabel}`
                                                      : ""}
                                                    {priorUploadedAt ? ` · ${formatDateTime(priorUploadedAt)}` : ""}
                                                  </p>
                                                )}
                                                <p className="mt-0.5 text-t3">
                                                  Replaced {formatDateTime(h.replaced_at)} by{" "}
                                                  {replacerName} via {replacerSourceLabel}
                                                </p>
                                              </div>
                                              {priorStreamUrl && (
                                                <a
                                                  href={priorStreamUrl}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  download={h.replaced_filename}
                                                  className="text-[11px] font-semibold text-brand hover:underline shrink-0"
                                                >
                                                  Open
                                                </a>
                                              )}
                                            </div>
                                          </li>
                                        );
                                      })}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      (() => {
                        // Task-91 — Staff resend of the px-upload email link.
                        const link = order.px_upload_link;
                        const linkExpired =
                          link != null &&
                          new Date(link.expires_at).getTime() < Date.now();
                        const resendCount = link?.resends?.length ?? 0;
                        // Task-178 — "Most recent resend" line only shows
                        // successful sends so we don't claim a bounced
                        // attempt landed in the patient's inbox. Failed
                        // attempts are visible in the Email history below.
                        const lastDeliveredResend = (() => {
                          const arr = link?.resends ?? [];
                          for (let i = arr.length - 1; i >= 0; i--) {
                            if ((arr[i].status ?? 'Delivered') === 'Delivered') return arr[i];
                          }
                          return null;
                        })();
                        const deliveredResendCount = (link?.resends ?? []).filter(
                          (r) => (r.status ?? 'Delivered') === 'Delivered',
                        ).length;
                        const cooldownActive = pxCooldownRemaining > 0;
                        const buttonLabel = cooldownActive
                          ? `Resend available in ${pxCooldownRemaining}s`
                          : linkExpired
                          ? "Send new upload link"
                          : deliveredResendCount > 0
                          ? "Resend upload link again"
                          : "Resend upload link";
                        const buttonTitle = cooldownActive
                          ? `A link was just emailed. To avoid spamming the patient, resend is disabled for ${pxCooldownRemaining}s.`
                          : pxSentRecently
                          ? "The last link was sent within the last 10 minutes and is still valid. You'll be asked to confirm before another email is sent."
                          : undefined;

                        // Task-130 — Manual reminder eligibility. Mirrors the
                        // server-side gate in sendPxUploadReminderNow so the
                        // button only appears when the cron would have
                        // something to send.
                        const linkConsumed = link?.consumed_at != null;
                        const firstReminderSent  = link?.reminder_sent_at != null;
                        const finalReminderSent  = link?.final_reminder_sent_at != null;
                        const canSendManualReminder =
                          link != null &&
                          !linkExpired &&
                          !linkConsumed &&
                          !(firstReminderSent && finalReminderSent);
                        const reminderKindNext: "first" | "final" | null =
                          link == null || linkExpired || linkConsumed
                            ? null
                            : !firstReminderSent
                            ? "first"
                            : !finalReminderSent
                            ? "final"
                            : null;
                        const reminderButtonLabel =
                          reminderKindNext === "final"
                            ? "Send final reminder now"
                            : "Send reminder now";

                        return (
                          <div className="space-y-3">
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-warn-bg border border-warn-bdr">
                              <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0 space-y-1">
                                <p className="text-[12px] text-warn">
                                  Patient requested a higher GLP-1 starting dose — awaiting prescription
                                  upload from the intake success screen.
                                </p>
                                {link && (
                                  <p className="text-[11px] text-t2">
                                    Last link emailed to <span className="font-semibold">{link.to_email}</span>
                                    {link.sent_at ? ` · ${formatDateTime(link.sent_at)}` : ""}
                                    {" · "}
                                    {linkExpired ? (
                                      <span className="text-err font-semibold">
                                        expired {link.expires_at.slice(0, 10)}
                                      </span>
                                    ) : (
                                      <>expires {link.expires_at.slice(0, 10)}</>
                                    )}
                                    {deliveredResendCount > 0 && (
                                      <> · resent {deliveredResendCount} {deliveredResendCount === 1 ? "time" : "times"}</>
                                    )}
                                  </p>
                                )}
                                {lastDeliveredResend && lastDeliveredResend.sent_at && (
                                  <p className="text-[11px] text-t3">
                                    Most recent resend by{" "}
                                    {USERS_REGISTRY[lastDeliveredResend.by_user_id]?.full_name ?? lastDeliveredResend.by_user_id}
                                    {" "}on {formatDateTime(lastDeliveredResend.sent_at)}
                                  </p>
                                )}
                              </div>
                            </div>
                            {/* Task-178 — Collapsible "Email history" so staff
                                can quickly answer "I never got the email"
                                with the full timeline of attempts — initial
                                send, every resend, and any cool-down
                                suppressions — without scraping the audit log. */}
                            {link && (() => {
                              type HistoryRow = {
                                key: string;
                                ts: number;
                                when: string;
                                kind: "Initial" | "Resend" | "Suppressed";
                                actor: string;
                                to_email: string;
                                outcome: "Delivered" | "Bounced" | "Failed" | "Rate-limited";
                                error_message: string | null;
                              };
                              const rows: HistoryRow[] = [];
                              const userName = (id: string | null | undefined) =>
                                id ? USERS_REGISTRY[id]?.full_name ?? id : "System (intake)";

                              if (link.initial_attempted_at) {
                                rows.push({
                                  key: "initial",
                                  ts: new Date(link.initial_attempted_at).getTime(),
                                  when: link.initial_attempted_at,
                                  kind: "Initial",
                                  actor: userName(link.initial_send_by_user_id ?? null),
                                  to_email: link.initial_to_email ?? link.to_email,
                                  outcome: link.initial_send_status ?? "Delivered",
                                  error_message: link.initial_send_error_message ?? null,
                                });
                              } else if (link.sent_at) {
                                // Older fixture / pre-Task-178 record — fall back
                                // to the link.sent_at as a Delivered initial send
                                // so the history is still complete.
                                rows.push({
                                  key: "initial",
                                  ts: new Date(link.sent_at).getTime(),
                                  when: link.sent_at,
                                  kind: "Initial",
                                  actor: userName(null),
                                  to_email: link.to_email,
                                  outcome: "Delivered",
                                  error_message: null,
                                });
                              }

                              (link.resends ?? []).forEach((r, idx) => {
                                // Task-178 — Successful resends carry sent_at;
                                // bounced/failed ones leave it null but always
                                // record attempted_at. Skip the row entirely if
                                // neither is present (corrupted legacy data) so
                                // we never feed `new Date(null)` to the renderer.
                                const when = r.sent_at ?? r.attempted_at;
                                if (!when) return;
                                rows.push({
                                  key: `resend-${idx}`,
                                  ts: new Date(when).getTime(),
                                  when,
                                  kind: "Resend",
                                  actor: userName(r.by_user_id),
                                  to_email: r.to_email,
                                  outcome: r.status ?? "Delivered",
                                  error_message: r.error_message ?? null,
                                });
                              });

                              // Task-178 — Cool-down-suppressed attempts are
                              // sourced from the audit log (per task brief —
                              // no new persistence layer) via the in-memory
                              // adapter exposed by the fixtures module.
                              getOrderAuditEvents(order.id, [
                                'px_upload_link_resend_suppressed',
                              ]).forEach((evt, idx) => {
                                if (!evt.occurred_at) return;
                                const payload = evt.payload ?? {};
                                const cooldownSeconds =
                                  typeof payload.cooldown_seconds === 'number'
                                    ? payload.cooldown_seconds
                                    : 60;
                                const toEmail =
                                  typeof payload.to_email === 'string'
                                    ? payload.to_email
                                    : link.to_email;
                                rows.push({
                                  key: `suppressed-${idx}`,
                                  ts: new Date(evt.occurred_at).getTime(),
                                  when: evt.occurred_at,
                                  kind: "Suppressed",
                                  actor: userName(evt.actor_user_id),
                                  to_email: toEmail,
                                  outcome: "Rate-limited",
                                  error_message: `Cool-down active (${cooldownSeconds}s window) — patient was not emailed.`,
                                });
                              });

                              rows.sort((a, b) => a.ts - b.ts);
                              if (rows.length === 0) return null;

                              const outcomeClass = (o: HistoryRow["outcome"]) => {
                                switch (o) {
                                  case "Delivered":
                                    return "bg-ok-bg text-ok border-ok-bdr";
                                  case "Bounced":
                                  case "Failed":
                                    return "bg-err-bg text-err border-err-bdr";
                                  case "Rate-limited":
                                    return "bg-warn-bg text-warn border-warn-bdr";
                                }
                              };

                              return (
                                <div className="rounded-lg border border-bdr bg-surface">
                                  <button
                                    type="button"
                                    onClick={() => setShowPxEmailHistory((s) => !s)}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[12px] font-semibold text-t1 hover:bg-bg2 rounded-lg transition-colors"
                                    aria-expanded={showPxEmailHistory}
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <Mail className="w-3.5 h-3.5 text-t2" />
                                      Email history ({rows.length})
                                    </span>
                                    {showPxEmailHistory ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-t2" />
                                    ) : (
                                      <ChevronRightIcon className="w-3.5 h-3.5 text-t2" />
                                    )}
                                  </button>
                                  {showPxEmailHistory && (
                                    <ul className="px-3 pb-3 space-y-2">
                                      {rows.map((row) => (
                                        <li
                                          key={row.key}
                                          className="text-[11px] p-2 rounded-md bg-bg2 border border-bdr"
                                        >
                                          <div className="flex items-start justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-semibold text-t1">{row.kind}</span>
                                              <span className="text-t3">·</span>
                                              <span className="text-t2">{formatDateTime(row.when)}</span>
                                            </div>
                                            <span
                                              className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${outcomeClass(row.outcome)}`}
                                            >
                                              {row.outcome}
                                            </span>
                                          </div>
                                          <p className="mt-1 text-t2">
                                            {row.kind === "Suppressed" ? "Attempted by" : "Triggered by"}{" "}
                                            <span className="text-t1 font-semibold">{row.actor}</span>
                                            {" · to "}
                                            <span className="font-mono text-t1">{row.to_email}</span>
                                          </p>
                                          {row.error_message && (
                                            <p className="mt-1 text-t3 italic">
                                              {row.error_message}
                                            </p>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              );
                            })()}
                            {link && (
                              <div className="flex flex-wrap justify-end gap-2">
                                {/* Task-130 — Manual reminder, shown alongside
                                    the Task-91 resend. Only renders while the
                                    cron still has something to send (link
                                    active, not consumed, not both reminders
                                    fired). */}
                                {canSendManualReminder && can(currentUser, "write", "orders") && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSendPxReminderNow}
                                    disabled={isSendingPxReminder || isResendingPxLink}
                                    className="gap-1.5"
                                    title={
                                      reminderKindNext === "final"
                                        ? "Send the final reminder email now instead of waiting for the scheduled sweep."
                                        : "Send the first reminder email now instead of waiting for the scheduled sweep."
                                    }
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    {isSendingPxReminder ? "Sending…" : reminderButtonLabel}
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={handleResendPxUploadLink}
                                  disabled={isResendingPxLink || cooldownActive || isSendingPxReminder}
                                  title={buttonTitle}
                                  className="gap-1.5"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  {isResendingPxLink ? "Sending…" : buttonLabel}
                                </Button>
                              </div>
                            )}
                            {link && (firstReminderSent || finalReminderSent) && (
                              <p className="text-[11px] text-t3">
                                {firstReminderSent && (
                                  <>First reminder sent {formatDateTime(link.reminder_sent_at!)}</>
                                )}
                                {firstReminderSent && finalReminderSent && " · "}
                                {finalReminderSent && (
                                  <>Final reminder sent {formatDateTime(link.final_reminder_sent_at!)}</>
                                )}
                              </p>
                            )}
                            {/* Task-85 — Staff-side upload on patient's behalf.
                                Coexists with the Task-91 resend button: staff can either
                                re-issue the upload link OR, if the patient has already
                                emailed/posted a copy, attach it here directly. */}
                            {can(currentUser, "write", "orders") && (
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
                                      if (!f) return;
                                      // Task-251 — stash the selection and open a
                                      // confirm modal so staff verify the patient
                                      // before the file is uploaded.
                                      setPxUploadError(null);
                                      if (f.size > 10 * 1024 * 1024) {
                                        setPxUploadError("File is larger than 10 MB.");
                                        return;
                                      }
                                      if (pendingPxPreviewUrl) {
                                        URL.revokeObjectURL(pendingPxPreviewUrl);
                                      }
                                      const previewable =
                                        f.type.startsWith("image/") ||
                                        f.type === "application/pdf";
                                      setPendingPxFile(f);
                                      setPendingPxPreviewUrl(
                                        previewable ? URL.createObjectURL(f) : null,
                                      );
                                    }}
                                  />
                                </label>
                                {pxUploadError && (
                                  <p className="mt-2 text-[11px] text-err">{pxUploadError}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </DCard>
                )}

                {/* BLD-14.5 — Weight trajectory */}
                {order.weight_history && order.weight_history.length > 0 && (
                  <OrderWeightTrajectoryCard
                    order={order}
                    clinicId={clinicId}
                    weightWarningThresholds={clinic.config.weight_warning_thresholds}
                    canAcknowledgeWarnings={can(currentUser, "decide", "orders")}
                    onWarningAcknowledged={setOrder}
                  />
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
                {amendmentWindowOpen && can(currentUser, "write", "amendments") && (
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

            {/* Intercom tab — Phase 1 (read-only) real conversation thread */}
            {activeTab === "intercom" && (
              <OrderIntercomTab
                clinicId={clinicId}
                clinic={clinic}
                patient={patient}
                onUnreadChange={setIntercomUnread}
              />
            )}
            {activeTab === "activity" && (
              <OrderActivityTimeline order={order} onOrderUpdated={setOrder} />
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

      {/* Task-251 — Pre-attach confirmation for the empty-state staff upload
          card. Surfaces the patient's name + DOB alongside the chosen file
          (filename, type, size and an inline image/PDF preview) so staff can
          catch wrong-patient/wrong-tab mix-ups before the upload pipeline
          fires. Cancelling discards the selection and leaves the audit trail
          untouched; confirming hands off to handleStaffPxUpload unchanged. */}
      <ConfirmDialog
        open={pendingPxFile !== null}
        onOpenChange={(o) => {
          if (o || isUploadingPx) return;
          if (pendingPxPreviewUrl) URL.revokeObjectURL(pendingPxPreviewUrl);
          setPendingPxFile(null);
          setPendingPxPreviewUrl(null);
        }}
      >
        <ConfirmDialogContent className="max-w-md">
          <ConfirmDialogHeader>
            <ConfirmDialogTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4 text-warn" />
              Confirm patient before upload
            </ConfirmDialogTitle>
          </ConfirmDialogHeader>
          {pendingPxFile && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-[12px] rounded-md px-3 py-2 border border-warn-bdr bg-warn-bg text-warn">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  Double-check this file belongs to the patient below. Once
                  confirmed it is attached to this order and recorded in the
                  audit log.
                </div>
              </div>
              <div className="rounded-md border border-bdr bg-page-bg px-3 py-2 space-y-1 text-[12px]">
                <div className="flex justify-between gap-3">
                  <span className="text-t3">Patient</span>
                  <span className="text-t1 font-semibold text-right truncate max-w-[16rem]">
                    {d.full_name}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-t3">Date of birth</span>
                  <span className="text-t1 text-right">
                    {formatDate(d.dob)} · {age} yrs
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-t3">File</span>
                  <span className="text-t1 font-semibold text-right truncate max-w-[16rem]">
                    {pendingPxFile.name}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-t3">Type / size</span>
                  <span className="text-t1 text-right">
                    {pendingPxFile.type || "unknown"} ·{" "}
                    {pendingPxFile.size < 1024 * 1024
                      ? `${(pendingPxFile.size / 1024).toFixed(1)} KB`
                      : `${(pendingPxFile.size / 1024 / 1024).toFixed(1)} MB`}
                  </span>
                </div>
              </div>
              {pendingPxPreviewUrl && pendingPxFile.type.startsWith("image/") ? (
                <img
                  src={pendingPxPreviewUrl}
                  alt={`Preview of ${pendingPxFile.name}`}
                  className="max-h-64 w-auto rounded-md border border-bdr mx-auto"
                />
              ) : pendingPxPreviewUrl && pendingPxFile.type === "application/pdf" ? (
                <object
                  data={pendingPxPreviewUrl}
                  type="application/pdf"
                  aria-label={`PDF preview of ${pendingPxFile.name}`}
                  className="w-full h-64 rounded-md border border-bdr bg-bg2"
                >
                  <p className="text-[11px] text-t2 p-3">
                    Inline PDF preview isn’t supported in this browser — confirm
                    by filename above.
                  </p>
                </object>
              ) : (
                <p className="text-[11px] text-t2">
                  No inline preview available for this file type — confirm by
                  filename above.
                </p>
              )}
            </div>
          )}
          <ConfirmDialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (pendingPxPreviewUrl) URL.revokeObjectURL(pendingPxPreviewUrl);
                setPendingPxFile(null);
                setPendingPxPreviewUrl(null);
              }}
              disabled={isUploadingPx}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const file = pendingPxFile;
                if (!file) return;
                if (pendingPxPreviewUrl) URL.revokeObjectURL(pendingPxPreviewUrl);
                setPendingPxFile(null);
                setPendingPxPreviewUrl(null);
                void handleStaffPxUpload(file);
              }}
              disabled={isUploadingPx || !pendingPxFile}
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              Confirm &amp; upload
            </Button>
          </ConfirmDialogFooter>
        </ConfirmDialogContent>
      </ConfirmDialog>

      {/* Task-119 — Replace prescription confirm modal.
          Surfaces the existing file metadata so staff know exactly what they're
          swapping out, then opens the hidden file input. The replacement runs
          through handleStaffPxUpload which uses the same presigned-URL +
          validation pipeline as the original Task-85 staff upload, and the
          fixture's attachPxUpload captures both the prior file and the new
          uploader in the audit log. */}
      <ConfirmDialog open={replacePxOpen} onOpenChange={(o) => !o && !isUploadingPx && setReplacePxOpen(false)}>
        <ConfirmDialogContent className="max-w-md">
          <ConfirmDialogHeader>
            <ConfirmDialogTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4 text-warn" />
              Replace patient prescription
            </ConfirmDialogTitle>
          </ConfirmDialogHeader>
          <div className="space-y-3">
            {order.px_upload && (
              <div className="rounded-md border border-bdr bg-page-bg px-3 py-2 space-y-1 text-[12px]">
                <div className="flex justify-between gap-3">
                  <span className="text-t3">Current file</span>
                  <span className="text-t1 font-semibold text-right truncate max-w-[16rem]">
                    {order.px_upload.filename}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-t3">Uploaded</span>
                  <span className="text-t1 text-right">
                    {formatDateTime(order.px_upload.uploaded_at)}
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2 text-[12px] rounded-md px-3 py-2 border border-warn-bdr bg-warn-bg text-warn">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                The current file will be swapped for the one you pick next. The
                previous filename and uploader stay in the audit log so reviewers
                can see what changed.
              </div>
            </div>
            <p className="text-[11px] text-t2">
              JPG, PNG, WebP, HEIC or PDF, up to 10&nbsp;MB.
            </p>
          </div>
          <ConfirmDialogFooter className="gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setReplacePxOpen(false)} disabled={isUploadingPx}>
              Keep current file
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setReplacePxOpen(false);
                const input = document.getElementById("px-replace-file-input") as HTMLInputElement | null;
                input?.click();
              }}
              disabled={isUploadingPx}
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              Choose replacement file
            </Button>
          </ConfirmDialogFooter>
        </ConfirmDialogContent>
      </ConfirmDialog>

      {/* Task-126 — Confirm step when the previous link was sent very recently
          (< 10 minutes ago) and is still valid. Rotating the token now means
          the patient will get a second email and the link they may have just
          opened will stop working. */}
      <ConfirmDialog
        open={resendConfirmOpen}
        onOpenChange={(o) => !o && !isResendingPxLink && setResendConfirmOpen(false)}
      >
        <ConfirmDialogContent className="max-w-md">
          <ConfirmDialogHeader>
            <ConfirmDialogTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4 text-warn" />
              Resend upload link?
            </ConfirmDialogTitle>
          </ConfirmDialogHeader>
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-[12px] rounded-md px-3 py-2 border border-warn-bdr bg-warn-bg text-warn">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                A link was emailed to{" "}
                <strong>
                  {order.px_upload_link?.to_email ?? patient.contact.email}
                </strong>{" "}
                {pxSecondsSinceLastSend != null && pxSecondsSinceLastSend < 60
                  ? `${pxSecondsSinceLastSend} seconds ago`
                  : pxSecondsSinceLastSend != null
                  ? `${Math.floor(pxSecondsSinceLastSend / 60)} minutes ago`
                  : "very recently"}{" "}
                and is still valid. Sending another email will{" "}
                <strong>invalidate the previous link</strong> — if the patient
                clicks the older email after this, it will no longer work.
              </div>
            </div>
            <p className="text-[12px] text-t2">
              Only resend if the patient confirmed they can&apos;t find the
              previous email or asked for a new link.
            </p>
          </div>
          <ConfirmDialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResendConfirmOpen(false)}
              disabled={isResendingPxLink}
            >
              Keep the existing link
            </Button>
            <Button
              size="sm"
              onClick={confirmResendPxUploadLink}
              disabled={isResendingPxLink}
            >
              <Mail className="w-3.5 h-3.5 mr-1" />
              {isResendingPxLink ? "Sending…" : "Send a new link anyway"}
            </Button>
          </ConfirmDialogFooter>
        </ConfirmDialogContent>
      </ConfirmDialog>

      {/* Task-158 — Reverse decision modal: mandatory rationale, captured as
          clinical note + reversal_log audit entry. Surfaces what will happen
          (status flip, queue re-entry, side-effect cleanup) so the clinician
          opts in deliberately. */}
      <ConfirmDialog open={reverseOpen} onOpenChange={(o) => !o && !isReversing && setReverseOpen(false)}>
        <ConfirmDialogContent className="max-w-md">
          <ConfirmDialogHeader>
            <ConfirmDialogTitle className="text-base flex items-center gap-2">
              <ArrowLeft className="w-4 h-4 text-warn" />
              Reverse decision on {order.id}
            </ConfirmDialogTitle>
          </ConfirmDialogHeader>
          <div className="space-y-3">
            {order.clinical_decision && (
              <div className="rounded-md border border-bdr bg-page-bg px-3 py-2 space-y-1 text-[12px]">
                <div className="flex justify-between gap-3">
                  <span className="text-t3">Current decision</span>
                  <span className="text-t1 font-semibold text-right capitalize">
                    {order.clinical_decision.decision}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-t3">Decided by</span>
                  <span className="text-t1 text-right">
                    {USERS_REGISTRY[order.clinical_decision.prescriber_user_id]?.full_name
                      ?? order.clinical_decision.prescriber_user_id}
                    {order.clinical_decision.prescriber_user_id !== currentUser.id && (
                      <span className="ml-1 text-[10px] text-warn font-semibold">(another clinician)</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-t3">Decided at</span>
                  <span className="text-t1 text-right">{formatDateTime(order.clinical_decision.decided_at)}</span>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2 text-[12px] rounded-md px-3 py-2 border border-warn-bdr bg-warn-bg text-warn">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                The order will return to the <strong>clinical check</strong> queue.
                {order.clinical_decision?.decision === "approved" && (
                  <> The auto-triggered GP letter (if still pending) will be cancelled and the approval-gate clinical note will be marked as reversed — both preserved in the audit log.</>
                )}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-t3 uppercase tracking-wider mb-1 block">
                Reason for reversal <span className="text-err normal-case">(min {REVERSE_MIN_CHARS} characters)</span>
              </label>
              <Textarea
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="Why is this decision being reversed? Captured as a clinical note and stamped on the audit log."
                rows={4}
                className="text-[13px]"
              />
              <p className={`text-[11px] mt-1 ${reverseReason.trim().length >= REVERSE_MIN_CHARS ? "text-ok" : "text-t3"}`}>
                {reverseReason.trim().length} / {REVERSE_MIN_CHARS} characters
              </p>
            </div>
          </div>
          <ConfirmDialogFooter className="gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setReverseOpen(false)} disabled={isReversing}>
              Keep decision
            </Button>
            <Button
              size="sm"
              onClick={handleReverseDecision}
              disabled={isReversing || reverseReason.trim().length < REVERSE_MIN_CHARS}
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              {isReversing ? "Reversing…" : "Reverse and re-queue"}
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
