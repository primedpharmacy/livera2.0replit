"use client";

import { useState } from "react";
import { Activity, Send } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { DCard } from "./orderPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { USERS_REGISTRY, CURRENT_USER } from "@/lib/api/mock";
import { can } from "@/lib/permissions";
import { MOCK_CLINICAL_NOTES } from "@/lib/api/fixtures/clinicalNotes";
import type { Order } from "@/types";

const WEIGHT_WARNING_LABEL: Record<string, string> = {
  weight_regain:        "weight regain",
  plateau:              "plateau",
  rapid_loss:           "rapid loss",
  bmi_below_threshold:  "BMI below continuation threshold",
};

type ReminderRetryAction = {
  kind: "first" | "final";
  toEmail: string;
};

type TimelineEntry = {
  key: string;
  dot: "ok" | "err" | "info" | "neutral";
  title: string;
  meta: string;
  ts: number;
  rationale?: string | null;
  subtext?: string | null;
  reminderRetry?: ReminderRetryAction | null;
};

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
    dot === "ok"   ? "bg-ok border-ok-bdr"    :
    dot === "err"  ? "bg-err border-err-bdr"  :
    dot === "info" ? "bg-info border-info-bdr" :
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

interface Props {
  order: Order;
  /**
   * Task-179 — invoked after a successful retry of a failed reminder so the
   * surrounding OrderDetailClient can refresh its `order` state (idempotency
   * flag flipped, link.to_email persisted). Optional so existing callers that
   * don't need write-back keep working.
   */
  onOrderUpdated?: (order: Order) => void;
}

export function OrderActivityTimeline({ order, onOrderUpdated }: Props) {
  const [retryFor, setRetryFor]   = useState<ReminderRetryAction | null>(null);
  const [retryEmail, setRetryEmail] = useState("");
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);

  const entries: TimelineEntry[] = [];

  entries.push({
    key: "submitted",
    dot: "neutral",
    title: "Order submitted",
    meta: formatDateTime(order.created_at),
    ts: new Date(order.created_at).getTime(),
    subtext: `${order.product.medication} ${order.product.dose} · ${order.type} order`,
  });

  // Task-80 — Px upload link email sent
  if (order.px_upload_link?.sent_at) {
    entries.push({
      key: "px_link_sent",
      dot: "info",
      title: "Px upload link emailed to patient",
      meta: `to ${order.px_upload_link.to_email} · ${formatDateTime(order.px_upload_link.sent_at)}`,
      ts: new Date(order.px_upload_link.sent_at).getTime(),
      subtext: `Single-use link · expires ${order.px_upload_link.expires_at.slice(0, 10)}`,
    });
  }

  // Task-91 / Task-177 — Staff re-issued the px-upload link (previous token
  // invalidated). We surface one timeline entry per recorded resend so the
  // wider team can see exactly how many times a patient has been chased,
  // which staff member triggered each resend, and whether the link they
  // replaced had already expired at the time.
  if (order.px_upload_link?.resends?.length) {
    const totalResends = order.px_upload_link.resends.length;
    order.px_upload_link.resends.forEach((resend, idx) => {
      const staff = USERS_REGISTRY[resend.by_user_id]?.full_name
        ?? resend.by_user_id;
      const attemptLabel = `Resend ${idx + 1} of ${totalResends}`;
      // Task-178 — Render Bounced/Failed resends as a distinct error entry
      // instead of treating them as a successful "Px upload link resent".
      const isDelivered = (resend.status ?? 'Delivered') === 'Delivered';
      const whenIso = isDelivered
        ? (resend.sent_at ?? resend.attempted_at)
        : (resend.attempted_at ?? resend.sent_at);
      if (!whenIso) return;
      if (!isDelivered) {
        entries.push({
          key: `px_link_resend_failed_${idx}`,
          dot: "err",
          title: `Px upload link resend failed to deliver`,
          meta: `to ${resend.to_email} · ${formatDateTime(whenIso)} · by ${staff} · ${resend.status}`,
          ts: new Date(whenIso).getTime(),
          rationale: resend.error_message ?? "Postmark did not return an error message.",
        });
        return;
      }
      entries.push({
        key: `px_link_resent_${idx}`,
        dot: "info",
        title: resend.previous_expired
          ? "Px upload link re-issued (previous link had expired)"
          : "Px upload link resent to patient",
        meta: `to ${resend.to_email} · ${formatDateTime(whenIso)} · by ${staff}`,
        ts: new Date(whenIso).getTime(),
        subtext: `${attemptLabel} · New single-use link · expires ${resend.expires_at.slice(0, 10)}`,
      });
    });
  }

  // Task-92 — Scheduled Px upload reminders (first nudge ~48h after sent_at,
  // final nudge within 24h of expires_at). Each fires at most once.
  // Task-261 — Surface whether the reminder came from the scheduled job
  // (null actor) or a staff member (sendPxUploadReminderNow /
  // retryFailedPxUploadReminder), mirroring how Task-177 attributes the
  // manual resends. `undefined` is treated as system-sent for back-compat
  // with fixture rows written before this field existed.
  const reminderActorLabel = (userId: string | null | undefined): string => {
    if (userId == null) return "FeelTru reminder job";
    return USERS_REGISTRY[userId]?.full_name ?? userId;
  };
  if (order.px_upload_link?.reminder_sent_at) {
    const actor = reminderActorLabel(order.px_upload_link.reminder_sent_by_user_id);
    entries.push({
      key: "px_link_reminder",
      dot: "info",
      title: "Px upload reminder emailed to patient",
      meta: `to ${order.px_upload_link.to_email} · ${formatDateTime(order.px_upload_link.reminder_sent_at)} · by ${actor}`,
      ts: new Date(order.px_upload_link.reminder_sent_at).getTime(),
      subtext: `Reuses the original link · expires ${order.px_upload_link.expires_at.slice(0, 10)}`,
    });
  }
  if (order.px_upload_link?.final_reminder_sent_at) {
    const actor = reminderActorLabel(order.px_upload_link.final_reminder_sent_by_user_id);
    entries.push({
      key: "px_link_final_reminder",
      dot: "info",
      title: "Final Px upload reminder emailed to patient",
      meta: `to ${order.px_upload_link.to_email} · ${formatDateTime(order.px_upload_link.final_reminder_sent_at)} · by ${actor}`,
      ts: new Date(order.px_upload_link.final_reminder_sent_at).getTime(),
      subtext: `Last chance · link expires ${order.px_upload_link.expires_at.slice(0, 10)}`,
    });
  }

  // Task-175 — Cron-triggered auto-resends. Each entry on auto_resends[]
  // is a system-initiated token rotation that fired once the link was
  // expired (or within 24h of expiring). We render them inline with the
  // staff-driven resends so reviewers can see the full chase history.
  if (order.px_upload_link?.auto_resends?.length) {
    const total = order.px_upload_link.auto_resends.length;
    order.px_upload_link.auto_resends.forEach((auto, idx) => {
      const attemptLabel = `Auto-resend ${idx + 1} of ${total}`;
      if (auto.status === 'Delivered') {
        entries.push({
          key: `px_link_auto_resent_${idx}`,
          dot: "info",
          title: auto.previous_expired
            ? "System auto-resent Px upload link (previous link had expired)"
            : "System auto-resent Px upload link",
          meta: `to ${auto.to_email} · ${formatDateTime(auto.sent_at)} · by system`,
          ts: new Date(auto.sent_at).getTime(),
          subtext: `${attemptLabel} · New single-use link · expires ${auto.expires_at.slice(0, 10)}`,
        });
      } else {
        entries.push({
          key: `px_link_auto_resent_failed_${idx}`,
          dot: "err",
          title: "System auto-resend of Px upload link failed to deliver",
          meta: `to ${auto.to_email} · ${formatDateTime(auto.sent_at)} · ${auto.status}`,
          ts: new Date(auto.sent_at).getTime(),
          rationale: auto.error_message ?? "Postmark did not return an error message.",
        });
      }
    });
  }

  // Task-175 — Auto-chase escalation. Once the cron has burned through
  // its retry cap without an upload, the order is escalated for a staff
  // phone call. We surface this as its own warn-tinted row so it stands
  // out from the routine auto-resends above it.
  if (order.px_upload_link?.auto_chase_escalated_at) {
    entries.push({
      key: "px_link_auto_chase_escalated",
      dot: "err",
      title: "Auto-chase escalated — staff to call patient",
      meta: `${formatDateTime(order.px_upload_link.auto_chase_escalated_at)} · by system`,
      ts: new Date(order.px_upload_link.auto_chase_escalated_at).getTime(),
      subtext: `Retry cap reached after ${order.px_upload_link.auto_resends?.length ?? 0} auto-resends`,
    });
  }

  // Task-129 — Failed reminder attempts (Bounced / Failed sends from Postmark)
  // surface with the underlying error message so reviewers can see why a nudge
  // never landed and decide whether to chase the patient another way.
  // Task-179 — The most recent failure of each kind (that hasn't since been
  // superseded by a successful send) gets a "Retry reminder" action so staff
  // can correct a bad address and resend without waiting for the daily sweep.
  if (order.px_upload_link?.reminder_failures?.length) {
    const link = order.px_upload_link;
    const linkExpired = new Date(link.expires_at).getTime() <= Date.now();
    const linkConsumed = link.consumed_at != null || order.px_upload != null;
    const canRetryNow =
      can(CURRENT_USER, "write", "orders") && !linkExpired && !linkConsumed;

    // Identify the latest failure per kind so we don't show "Retry" on every
    // historical entry — only the most recent one for that kind is actionable.
    const failures = link.reminder_failures!;
    const latestIdxByKind: Record<"first" | "final", number> = { first: -1, final: -1 };
    failures.forEach((f, idx) => {
      latestIdxByKind[f.kind] = idx;
    });

    failures.forEach((failure, idx) => {
      const isFinal = failure.kind === "final";
      const kindAlreadySent =
        (failure.kind === "first" && link.reminder_sent_at != null) ||
        (failure.kind === "final" && link.final_reminder_sent_at != null);
      const isLatestForKind = latestIdxByKind[failure.kind] === idx;
      const showRetry =
        canRetryNow && isLatestForKind && !kindAlreadySent;

      // Task-261 — Attribute each failed attempt to the scheduled job or
      // the staff member who triggered it (via retryFailedPxUploadReminder
      // / sendPxUploadReminderNow). Treat undefined as system-sent for
      // back-compat with fixture rows written before this field existed.
      const failureActor = reminderActorLabel(failure.by_user_id);
      entries.push({
        key: `px_link_reminder_failed_${idx}`,
        dot: "err",
        title: isFinal
          ? "Final Px upload reminder failed to deliver"
          : "Px upload reminder failed to deliver",
        meta: `to ${failure.to_email} · ${formatDateTime(failure.attempted_at)} · ${failure.status} · by ${failureActor}`,
        ts: new Date(failure.attempted_at).getTime(),
        rationale: failure.error_message ?? "Postmark did not return an error message.",
        reminderRetry: showRetry
          ? { kind: failure.kind, toEmail: failure.to_email }
          : null,
      });
    });
  }

  // Px upload received (success-screen, email link, or staff upload).
  // Task-118 — surface the uploader so reviewers can tell at a glance whether
  // the patient self-served or a teammate uploaded on their behalf.
  if (order.px_upload?.uploaded_at) {
    const source = order.px_upload.source
      ?? (order.px_upload_link?.consumed_at ? "email_link" : "success_screen");
    let title: string;
    let actorMeta: string;
    if (source === "staff_upload") {
      const staffId = order.px_upload.uploaded_by_user_id ?? "";
      const staffName = USERS_REGISTRY[staffId]?.full_name || staffId || "staff";
      title = `Px upload received — uploaded by ${staffName} on patient's behalf`;
      actorMeta = `by ${staffName} · `;
    } else if (source === "email_link") {
      title = "Px upload received via email link";
      actorMeta = "by patient · ";
    } else {
      title = "Px upload received";
      actorMeta = "by patient · ";
    }
    entries.push({
      key: "px_upload",
      dot: "ok",
      title,
      meta: `${actorMeta}${order.px_upload.filename} · ${formatDateTime(order.px_upload.uploaded_at)}`,
      ts: new Date(order.px_upload.uploaded_at).getTime(),
    });
  }

  // Task-154 — Surface clinical-note reversals on the order timeline. When a
  // prescriber undoes an approval (Task-109), the approval-gate note for this
  // order is stamped with `reversed_at`/`reversed_by_user_id`. Show that event
  // so the wider team can see the note is no longer authoritative.
  MOCK_CLINICAL_NOTES
    .filter(
      (n) =>
        n.clinic_id === order.clinic_id &&
        n.approval_gate_for_order_id === order.id &&
        n.reversed_at,
    )
    .forEach((n) => {
      const reverser = n.reversed_by_user_id
        ? (USERS_REGISTRY[n.reversed_by_user_id]?.full_name ?? n.reversed_by_user_id)
        : "unknown";
      entries.push({
        key: `clinical_note_reversed_${n.id}`,
        dot: "neutral",
        title: "Clinical note marked as reversed",
        meta: `${n.id} · by ${reverser} · ${formatDateTime(n.reversed_at!)}`,
        ts: new Date(n.reversed_at!).getTime(),
        rationale: "Approval was undone — note preserved for audit but no longer authoritative.",
      });
    });

  if (order.clinical_decision) {
    entries.push({
      key: "decision",
      dot:
        order.clinical_decision.decision === "approved" ? "ok" :
        order.clinical_decision.decision === "declined" ? "err" : "info",
      title: `Order ${order.clinical_decision.decision}`,
      meta: `by ${order.clinical_decision.prescriber_user_id} · ${formatDateTime(order.clinical_decision.decided_at)}`,
      ts: new Date(order.clinical_decision.decided_at).getTime(),
      rationale: order.clinical_decision.rationale,
    });
  }

  // Task-159's "Decision undone" rows are now rendered by the consolidated
  // Task-158 `reversal_log` loop below — it covers both quick-undo and the
  // long-window path and carries prior-decision/prescriber metadata.

  // Task-99 / Task-135 — weight warning acknowledgements appear in the audit
  // timeline so the wider team can see who reviewed which warning, when, and
  // why. Edits and reversals each emit their own entry; the original
  // acknowledgement is preserved (never silently overwritten) so the full
  // history reads top-to-bottom.
  (order.weight_warning_acknowledgements ?? []).forEach((ack, ackIdx) => {
    const label = WEIGHT_WARNING_LABEL[ack.kind] ?? ack.kind;
    const actor = USERS_REGISTRY[ack.acknowledged_by_user_id]?.full_name
      ?? ack.acknowledged_by_user_id;
    // The acknowledgement row carries the *current* rationale once edits have
    // been applied; the original rationale is the earliest edit's
    // `previous_rationale`, or the live `rationale` if no edits exist yet.
    const originalRationale =
      ack.edits && ack.edits.length > 0
        ? ack.edits[0].previous_rationale
        : ack.rationale;
    entries.push({
      key: `weight_warning_ack_${ack.kind}_${ackIdx}`,
      dot: "info",
      title: `Weight warning acknowledged — ${label}`,
      meta: `by ${actor} · ${formatDateTime(ack.acknowledged_at)}`,
      ts: new Date(ack.acknowledged_at).getTime(),
      rationale: originalRationale,
    });

    (ack.edits ?? []).forEach((edit, editIdx) => {
      const editor = USERS_REGISTRY[edit.edited_by_user_id]?.full_name
        ?? edit.edited_by_user_id;
      // Task-189 — when the editor isn't the original acknowledger, surface
      // the override explicitly so the wider team can see who overrode whom.
      const isOverride = edit.edited_by_user_id !== ack.acknowledged_by_user_id;
      const titleSuffix = isOverride ? ` — override of ${actor}` : "";
      entries.push({
        key: `weight_warning_ack_${ack.kind}_${ackIdx}_edit_${editIdx}`,
        dot: "info",
        title: `Weight warning rationale edited — ${label}${titleSuffix}`,
        meta: `by ${editor}${isOverride ? ` · overriding ${actor}` : ""} · ${formatDateTime(edit.edited_at)}`,
        ts: new Date(edit.edited_at).getTime(),
        rationale: `Updated to: “${edit.new_rationale}” · Previously: “${edit.previous_rationale}”`,
      });
    });

    if (ack.reversed_at && ack.reversed_by_user_id) {
      const reverser = USERS_REGISTRY[ack.reversed_by_user_id]?.full_name
        ?? ack.reversed_by_user_id;
      // Task-189 — same here: a reversal recorded by someone other than the
      // original acknowledger is an override, and the timeline should name
      // both the actor and the colleague whose ack was overridden.
      const isOverride = ack.reversed_by_user_id !== ack.acknowledged_by_user_id;
      const titleSuffix = isOverride ? ` — override of ${actor}` : "";
      entries.push({
        key: `weight_warning_ack_${ack.kind}_${ackIdx}_undone`,
        dot: "neutral",
        title: `Weight warning acknowledgement undone — ${label}${titleSuffix}`,
        meta: `by ${reverser}${isOverride ? ` · overriding ${actor}` : ""} · ${formatDateTime(ack.reversed_at)}`,
        ts: new Date(ack.reversed_at).getTime(),
        rationale: ack.reversal_reason ?? null,
      });
    }
  });

  // Task-158 — Reversal log entries. Each reversal preserves the prior
  // decision (so colleagues can see what was originally chosen) plus the
  // rationale captured at reversal time and any side-effects that were
  // cleaned up (auto GP letter cancelled, approval-gate notes reversed).
  // Quick-undo (5s window) entries have no reason and render without prose.
  (order.reversal_log ?? []).forEach((rev, revIdx) => {
    const reverser = USERS_REGISTRY[rev.reversed_by_user_id]?.full_name
      ?? rev.reversed_by_user_id;
    const sideBits: string[] = [];
    if (rev.side_effects?.gp_letter_cancelled_id) {
      sideBits.push(`auto GP letter ${rev.side_effects.gp_letter_cancelled_id} cancelled`);
    }
    const reversedNoteCount = rev.side_effects?.clinical_notes_reversed_ids?.length ?? 0;
    if (reversedNoteCount > 0) {
      sideBits.push(`${reversedNoteCount} approval-gate note(s) marked reversed`);
    }
    const sideText = sideBits.length > 0 ? `Side-effects: ${sideBits.join("; ")}.` : null;
    const rationale = rev.reason
      ? sideText ? `${rev.reason}\n\n${sideText}` : rev.reason
      : sideText ?? "Quick-undo within 5-second window — no written reason captured.";
    entries.push({
      key: `decision_reversed_${revIdx}`,
      dot: "neutral",
      title: `Decision reversed — was ${rev.prior_decision}`,
      meta: `by ${reverser} · ${formatDateTime(rev.reversed_at)}`,
      ts: new Date(rev.reversed_at).getTime(),
      rationale,
    });
  });

  if (order.status !== "clinical_check") {
    const ts = order.clinical_decision?.decided_at ?? order.updated_at;
    entries.push({
      key: "status",
      dot: "neutral",
      title: `Status changed to ${order.status.replace(/_/g, " ")}`,
      meta: formatDateTime(ts),
      ts: new Date(ts).getTime(),
    });
  }

  // Most recent first.
  entries.sort((a, b) => b.ts - a.ts);

  function openRetry(action: ReminderRetryAction) {
    setRetryFor(action);
    setRetryEmail(action.toEmail);
    setRetryError(null);
    setRetryNotice(null);
  }

  function closeRetry() {
    if (retryBusy) return;
    setRetryFor(null);
    setRetryEmail("");
    setRetryError(null);
  }

  async function submitRetry() {
    if (!retryFor) return;
    const email = retryEmail.trim();
    if (!email) {
      setRetryError("Please enter a recipient email.");
      return;
    }
    setRetryBusy(true);
    setRetryError(null);
    try {
      const res = await fetch(
        `/api/orders/${order.clinic_id}/${order.id}/px-upload/reminder-retry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: retryFor.kind, to_email: email }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        status?: "Delivered" | "Bounced" | "Failed";
        px_upload_link?: Order["px_upload_link"];
      };
      if (!res.ok && res.status !== 502) {
        throw new Error(body.message || `Retry failed (${res.status}).`);
      }
      // Apply the server-returned link snapshot locally so the timeline
      // refreshes immediately (success entry / new failure row) without a
      // full page reload.
      const nextOrder: Order = { ...order, px_upload_link: body.px_upload_link ?? order.px_upload_link };
      onOrderUpdated?.(nextOrder);

      if (body.status === "Delivered") {
        setRetryNotice(`Reminder sent to ${email}.`);
        setRetryFor(null);
        setRetryEmail("");
      } else {
        const detail = body.message ? ` (${body.message})` : "";
        setRetryError(`Reminder still failed to deliver${detail}. You can edit the address and try again.`);
      }
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Could not send reminder. Please retry.");
    } finally {
      setRetryBusy(false);
    }
  }

  return (
    <DCard icon={Activity} title="Activity Log">
      <div className="relative">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-bdr" />
        <ol className="space-y-0 -mx-4">
          {entries.map((entry, idx) => (
            <TimelineItem
              key={entry.key}
              dot={entry.dot}
              title={entry.title}
              meta={entry.meta}
              isLast={idx === entries.length - 1}
            >
              {entry.rationale && (
                <p className="mt-1.5 text-[12px] text-t1 bg-page-bg border border-bdr rounded px-3 py-2 leading-relaxed">
                  {entry.rationale}
                </p>
              )}
              {entry.subtext && (
                <p className="mt-1 text-[11px] text-t3">{entry.subtext}</p>
              )}
              {entry.reminderRetry && (
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openRetry(entry.reminderRetry!)}
                    className="gap-1.5 h-7 text-[11.5px]"
                    title="Confirm or update the recipient email and resend this reminder."
                  >
                    <Send className="w-3 h-3" />
                    Retry reminder
                  </Button>
                </div>
              )}
            </TimelineItem>
          ))}
        </ol>
      </div>

      {retryNotice && (
        <div
          role="status"
          className="mt-3 text-[12px] text-ok bg-ok-bg border border-ok-bdr rounded px-3 py-2"
        >
          {retryNotice}
        </div>
      )}

      <Dialog open={retryFor != null} onOpenChange={(open) => { if (!open) closeRetry(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {retryFor?.kind === "final"
                ? "Retry final upload reminder"
                : "Retry upload reminder"}
            </DialogTitle>
            <DialogDescription>
              The previous attempt bounced or failed. Confirm or update the
              recipient email and we'll resend the reminder right away —
              reusing the same single-use upload link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="retry-reminder-email" className="text-[12px]">
              Recipient email
            </Label>
            <Input
              id="retry-reminder-email"
              type="email"
              value={retryEmail}
              onChange={(e) => setRetryEmail(e.target.value)}
              disabled={retryBusy}
              autoFocus
            />
            {retryError && (
              <p className="text-[12px] text-err">{retryError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeRetry}
              disabled={retryBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitRetry}
              disabled={retryBusy || retryEmail.trim() === ""}
              className="gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {retryBusy ? "Sending…" : "Resend reminder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DCard>
  );
}
