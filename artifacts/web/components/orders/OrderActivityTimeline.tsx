"use client";

import { Activity } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { DCard } from "./orderPrimitives";
import { USERS_REGISTRY } from "@/lib/api/mock";
import type { Order } from "@/types";

const WEIGHT_WARNING_LABEL: Record<string, string> = {
  weight_regain:        "weight regain",
  plateau:              "plateau",
  rapid_loss:           "rapid loss",
  bmi_below_threshold:  "BMI below continuation threshold",
};

type TimelineEntry = {
  key: string;
  dot: "ok" | "err" | "info" | "neutral";
  title: string;
  meta: string;
  ts: number;
  rationale?: string | null;
  subtext?: string | null;
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
}

export function OrderActivityTimeline({ order }: Props) {
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

  // Task-91 — Staff re-issued the px-upload link (previous token invalidated).
  if (order.px_upload_link?.resends?.length) {
    order.px_upload_link.resends.forEach((resend, idx) => {
      entries.push({
        key: `px_link_resent_${idx}`,
        dot: "info",
        title: resend.previous_expired
          ? "Px upload link re-issued (previous link had expired)"
          : "Px upload link resent to patient",
        meta: `to ${resend.to_email} · ${formatDateTime(resend.sent_at)} · by ${resend.by_user_id}`,
        ts: new Date(resend.sent_at).getTime(),
        subtext: `New single-use link · expires ${resend.expires_at.slice(0, 10)}`,
      });
    });
  }

  // Task-92 — Scheduled Px upload reminders (first nudge ~48h after sent_at,
  // final nudge within 24h of expires_at). Each fires at most once.
  if (order.px_upload_link?.reminder_sent_at) {
    entries.push({
      key: "px_link_reminder",
      dot: "info",
      title: "Px upload reminder emailed to patient",
      meta: `to ${order.px_upload_link.to_email} · ${formatDateTime(order.px_upload_link.reminder_sent_at)}`,
      ts: new Date(order.px_upload_link.reminder_sent_at).getTime(),
      subtext: `Reuses the original link · expires ${order.px_upload_link.expires_at.slice(0, 10)}`,
    });
  }
  if (order.px_upload_link?.final_reminder_sent_at) {
    entries.push({
      key: "px_link_final_reminder",
      dot: "info",
      title: "Final Px upload reminder emailed to patient",
      meta: `to ${order.px_upload_link.to_email} · ${formatDateTime(order.px_upload_link.final_reminder_sent_at)}`,
      ts: new Date(order.px_upload_link.final_reminder_sent_at).getTime(),
      subtext: `Last chance · link expires ${order.px_upload_link.expires_at.slice(0, 10)}`,
    });
  }

  // Task-129 — Failed reminder attempts (Bounced / Failed sends from Postmark)
  // surface with the underlying error message so reviewers can see why a nudge
  // never landed and decide whether to chase the patient another way.
  if (order.px_upload_link?.reminder_failures?.length) {
    order.px_upload_link.reminder_failures.forEach((failure, idx) => {
      const isFinal = failure.kind === "final";
      entries.push({
        key: `px_link_reminder_failed_${idx}`,
        dot: "err",
        title: isFinal
          ? "Final Px upload reminder failed to deliver"
          : "Px upload reminder failed to deliver",
        meta: `to ${failure.to_email} · ${formatDateTime(failure.attempted_at)} · ${failure.status}`,
        ts: new Date(failure.attempted_at).getTime(),
        rationale: failure.error_message ?? "Postmark did not return an error message.",
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
      entries.push({
        key: `weight_warning_ack_${ack.kind}_${ackIdx}_edit_${editIdx}`,
        dot: "info",
        title: `Weight warning rationale edited — ${label}`,
        meta: `by ${editor} · ${formatDateTime(edit.edited_at)}`,
        ts: new Date(edit.edited_at).getTime(),
        rationale: `Updated to: “${edit.new_rationale}” · Previously: “${edit.previous_rationale}”`,
      });
    });

    if (ack.reversed_at && ack.reversed_by_user_id) {
      const reverser = USERS_REGISTRY[ack.reversed_by_user_id]?.full_name
        ?? ack.reversed_by_user_id;
      entries.push({
        key: `weight_warning_ack_${ack.kind}_${ackIdx}_undone`,
        dot: "neutral",
        title: `Weight warning acknowledgement undone — ${label}`,
        meta: `by ${reverser} · ${formatDateTime(ack.reversed_at)}`,
        ts: new Date(ack.reversed_at).getTime(),
        rationale: ack.reversal_reason ?? null,
      });
    }
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
            </TimelineItem>
          ))}
        </ol>
      </div>
    </DCard>
  );
}
