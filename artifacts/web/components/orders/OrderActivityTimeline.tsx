"use client";

import { Activity } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { DCard } from "./orderPrimitives";
import type { Order } from "@/types";

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
  return (
    <DCard icon={Activity} title="Activity Log">
      <div className="relative">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-bdr" />
        <ol className="space-y-0 -mx-4">
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

          {order.status !== "clinical_check" && (
            <TimelineItem
              dot="neutral"
              title={`Status changed to ${order.status.replace(/_/g, " ")}`}
              meta={order.clinical_decision
                ? formatDateTime(order.clinical_decision.decided_at)
                : formatDateTime(order.updated_at)}
            />
          )}

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
  );
}
