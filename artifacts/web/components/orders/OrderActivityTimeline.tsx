"use client";

import { Activity } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { DCard } from "./orderPrimitives";
import type { Order } from "@/types";

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

  // Px upload received (success-screen or email link)
  if (order.px_upload?.uploaded_at) {
    const viaLink = order.px_upload.source === "email_link" || !!order.px_upload_link?.consumed_at;
    entries.push({
      key: "px_upload",
      dot: "ok",
      title: viaLink ? "Px upload received via email link" : "Px upload received",
      meta: `${order.px_upload.filename} · ${formatDateTime(order.px_upload.uploaded_at)}`,
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
