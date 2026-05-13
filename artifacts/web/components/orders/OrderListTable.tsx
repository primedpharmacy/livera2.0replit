"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { NOW } from "@/lib/api/constants";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order, Clinic } from "@/types";

interface OrderListTableProps {
  orders: Order[];
  clinicId: string;
  clinic: Clinic;
  showQueueAge?: boolean; // BLD-15.1 — show "In queue" age badge (clinical check context only)
}

export function OrderListTable({
  orders,
  clinicId,
  clinic,
  showQueueAge = false,
}: OrderListTableProps) {
  const router = useRouter();
  const now = new Date(NOW).getTime();

  const withTint = useMemo(() => {
    return orders.map((order) => {
      let tint = "";
      if (order.status === "clinical_check") {
        const warnAt   = new Date(order.sla_warn_at).getTime();
        const breachAt = new Date(order.sla_breach_at).getTime();
        if (now > breachAt)    tint = "bg-err-bg";
        else if (now > warnAt) tint = "bg-warn-bg";
      }
      return { order, tint };
    });
  }, [orders, now]);

  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-page-bg hover:bg-page-bg border-bdr">
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Order</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Patient</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Treatment</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Status</TableHead>
            {showQueueAge && (
              <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">In queue</TableHead>
            )}
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">SLA</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Submitted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {withTint.map(({ order, tint }) => (
            <TableRow
              key={order.id}
              className={cn(
                "cursor-pointer border-bdr transition-colors",
                tint || "hover:bg-brand-light"
              )}
              onClick={() => router.push(`/${clinicId}/orders/${order.id}`)}
            >
              <TableCell className="py-3">
                <div className="font-mono text-[12px] font-semibold text-t1">{order.id}</div>
                <div className="text-[11px] text-t3 capitalize mt-0.5">{order.type}</div>
              </TableCell>
              <TableCell className="py-3">
                <div className="text-[12.5px] font-medium text-t1">{order.patient_id}</div>
              </TableCell>
              <TableCell className="py-3">
                <div className="text-[12.5px] text-t1">{order.product.medication}</div>
                <div className="text-[11px] text-t2">{order.product.dose}</div>
              </TableCell>
              <TableCell className="py-3">
                <div className="flex items-center gap-2">
                  <StatusBadge value={order.status} kind="order" />
                  {order.g6_flags.length > 0 && (
                    <span className="text-[9px] font-bold text-ok bg-ok-bg border border-ok-bdr px-1.5 py-px rounded">
                      G6
                    </span>
                  )}
                </div>
              </TableCell>
              {showQueueAge && (
                <TableCell className="py-3">
                  <QueueAgeBadge order={order} clinic={clinic} now={now} />
                </TableCell>
              )}
              <TableCell className="py-3">
                {order.status === "clinical_check" ? (
                  <SLACell order={order} now={now} />
                ) : (
                  <span className="text-[11px] text-t3">—</span>
                )}
              </TableCell>
              <TableCell className="py-3 text-[12px] text-t2 tabular-nums">
                {formatRelativeTime(order.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// BLD-15.1 — Queue age badge
// Thresholds sourced from clinic.config.default_slas (Rule 4 — no hardcoded values).
// Green  = order submitted within SLA warn window
// Amber  = between warn and breach threshold
// Red    = past breach threshold
function QueueAgeBadge({
  order,
  clinic,
  now,
}: {
  order: Order;
  clinic: Clinic;
  now: number;
}) {
  if (order.status !== "clinical_check") {
    return <span className="text-[11px] text-t3">—</span>;
  }

  const elapsedMs    = now - new Date(order.created_at).getTime();
  const elapsedHours = elapsedMs / 3600000;
  const totalMins    = Math.floor(elapsedMs / 60000);
  const hrs          = Math.floor(totalMins / 60);
  const mins         = totalMins % 60;
  const label        = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  const warnHours   = clinic.config.default_slas.approval_warn_hours;
  const breachHours = clinic.config.default_slas.approval_breach_hours;

  const variant =
    elapsedHours >= breachHours ? "err"  :
    elapsedHours >= warnHours   ? "warn" :
    "ok";

  const cls =
    variant === "err"  ? "bg-err-bg  border-err-bdr  text-err"  :
    variant === "warn" ? "bg-warn-bg border-warn-bdr text-warn" :
                         "bg-ok-bg   border-ok-bdr   text-ok";

  return (
    <span className={`inline-flex items-center text-[11px] font-semibold border rounded-full px-2 py-0.5 ${cls}`}>
      {label}
    </span>
  );
}

function SLACell({ order, now }: { order: Order; now: number }) {
  const warnAt   = new Date(order.sla_warn_at).getTime();
  const breachAt = new Date(order.sla_breach_at).getTime();

  if (now > breachAt) {
    return <span className="text-[11px] font-bold text-err">Breached</span>;
  }
  if (now > warnAt) {
    const hoursLeft = Math.floor((breachAt - now) / 3600000);
    return <span className="text-[11px] font-semibold text-warn">{hoursLeft}h left</span>;
  }
  const hoursLeft = Math.floor((warnAt - now) / 3600000);
  return <span className="text-[11px] text-t2">Warn in {hoursLeft}h</span>;
}
