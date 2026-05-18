"use client";

import { FileText, RefreshCw } from "lucide-react";
import { DCard, Row } from "./orderPrimitives";

interface Props {
  amount_authorised: number | null;
  amount_charged: number | null;
  ryft_authorisation_id: string | null;
  // Task-38 — surface refund delta once a refund amendment is `applied`.
  refunded_amount_gbp?: number | null;
  ryft_refund_ref?: string | null;
}

export function OrderPaymentSummary({
  amount_authorised,
  amount_charged,
  ryft_authorisation_id,
  refunded_amount_gbp,
  ryft_refund_ref,
}: Props) {
  const hasRefund = refunded_amount_gbp != null && refunded_amount_gbp > 0;

  return (
    <DCard icon={FileText} title="Payment">
      <Row
        label="Amount authorised"
        value={amount_authorised != null ? `£${amount_authorised.toFixed(2)}` : "—"}
      />
      <Row
        label="Amount charged"
        value={amount_charged != null ? `£${amount_charged.toFixed(2)}` : "Pending"}
      />
      {ryft_authorisation_id && (
        <Row label="Ryft auth ID" value={ryft_authorisation_id} mono />
      )}

      {hasRefund && (
        <div className="mt-2 pt-2 border-t border-bdr space-y-1.5 bg-warn-bg/40 -mx-4 -mb-3 px-4 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <RefreshCw className="w-3 h-3 text-warn" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-warn">
              Refund issued
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-[12px] text-t3">Refunded</span>
            <span className="text-[12px] font-semibold text-warn text-right">
              £{refunded_amount_gbp!.toFixed(2)}
            </span>
          </div>
          {ryft_refund_ref && (
            <div className="flex items-start justify-between gap-4">
              <span className="text-[12px] text-t3">Ryft refund ref</span>
              <span className="text-[12px] font-mono text-t1 text-right break-all">
                {ryft_refund_ref}
              </span>
            </div>
          )}
        </div>
      )}
    </DCard>
  );
}
