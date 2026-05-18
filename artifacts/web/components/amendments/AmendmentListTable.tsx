"use client";

import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatRelativeTime } from "@/lib/format";
import { CURRENT_USER } from "@/lib/api/mock";
import type { Amendment } from "@/types";

const TYPE_LABELS: Record<Amendment["type"], string> = {
  dose_change:     "Dose Change",
  cancellation:    "Cancellation",
  refund:          "Refund",
  reschedule:      "Reschedule",
  address_change:  "Address Change",
  dose_escalation: "Dose Escalation",
};

const ACTOR_LABELS: Record<string, string> = {
  patient:   "Patient",
  admin:     "Admin",
  clinician: "Clinician",
  system:    "System",
};

const TYPE_VARIANT: Record<Amendment["type"], string> = {
  dose_change:     "bg-info-bg text-info border-info-bdr",
  cancellation:    "bg-err-bg text-err border-err-bdr",
  refund:          "bg-warn-bg text-warn border-warn-bdr",
  reschedule:      "bg-coach-bg text-coach border-coach-bdr",
  address_change:  "bg-page-bg text-t2 border-bdr",
  dose_escalation: "bg-ok-bg text-ok border-ok-bdr",
};

// Task-38 — pending refund amendments need refund authority to action.
const ACTIONABLE_STATUSES: Amendment["status"][] = ["requested", "reviewing"];

interface AmendmentListTableProps {
  amendments: Amendment[];
  clinicId: string;
}

export function AmendmentListTable({ amendments, clinicId }: AmendmentListTableProps) {
  const router = useRouter();
  const canRefund = !!CURRENT_USER.can_refund;

  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-page-bg hover:bg-page-bg border-bdr">
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Amendment</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Order</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Type</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Requested by</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Requested</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Status</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5 w-[80px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {amendments.map((amendment) => {
            // Task-38 — refund rows require can_refund authority to action.
            const isRefund = amendment.type === "refund";
            const isPending = ACTIONABLE_STATUSES.includes(amendment.status);
            const refundLocked = isRefund && isPending && !canRefund;

            return (
              <TableRow
                key={amendment.id}
                className={`border-bdr transition-colors ${
                  refundLocked
                    ? "cursor-not-allowed bg-page-bg/40"
                    : "cursor-pointer hover:bg-brand-light"
                }`}
                onClick={() => {
                  if (!refundLocked) router.push(`/${clinicId}/amendments/${amendment.id}`);
                }}
              >
                <TableCell className="py-3">
                  <div className="font-mono text-[12px] font-semibold text-t1">{amendment.id}</div>
                </TableCell>
                <TableCell className="py-3">
                  <div className="font-mono text-[12px] font-semibold text-brand">{amendment.order_id}</div>
                </TableCell>
                <TableCell className="py-3">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_VARIANT[amendment.type]}`}>
                    {isRefund && <span aria-hidden>£</span>}
                    {TYPE_LABELS[amendment.type]}
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  <span className="text-[12px] text-t2 font-medium">
                    {ACTOR_LABELS[amendment.requested_by.actor_type] ?? amendment.requested_by.actor_type}
                  </span>
                </TableCell>
                <TableCell className="py-3 text-[12px] text-t2 tabular-nums">
                  {formatRelativeTime(amendment.requested_at)}
                </TableCell>
                <TableCell className="py-3">
                  <StatusBadge value={amendment.status} kind="amendment" />
                </TableCell>
                <TableCell className="py-3">
                  {refundLocked ? (
                    <span
                      title="Refund authority required"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-t3"
                    >
                      <Lock className="w-3 h-3" />
                      Locked
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-brand">Open →</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
