"use client";

import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatRelativeTime } from "@/lib/format";
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

interface AmendmentListTableProps {
  amendments: Amendment[];
  clinicId: string;
}

export function AmendmentListTable({ amendments, clinicId }: AmendmentListTableProps) {
  const router = useRouter();

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
          </TableRow>
        </TableHeader>
        <TableBody>
          {amendments.map((amendment) => (
            <TableRow
              key={amendment.id}
              className="cursor-pointer border-bdr hover:bg-brand-light transition-colors"
              onClick={() => router.push(`/${clinicId}/amendments/${amendment.id}`)}
            >
              <TableCell className="py-3">
                <div className="font-mono text-[12px] font-semibold text-t1">{amendment.id}</div>
              </TableCell>
              <TableCell className="py-3">
                <div className="font-mono text-[12px] font-semibold text-brand">{amendment.order_id}</div>
              </TableCell>
              <TableCell className="py-3">
                <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded border ${TYPE_VARIANT[amendment.type]}`}>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
