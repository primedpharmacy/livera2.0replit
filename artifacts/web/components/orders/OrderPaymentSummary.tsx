"use client";

import { FileText } from "lucide-react";
import { DCard, Row } from "./orderPrimitives";

interface Props {
  amount_authorised: number | null;
  amount_charged: number | null;
  ryft_authorisation_id: string | null;
}

export function OrderPaymentSummary({
  amount_authorised,
  amount_charged,
  ryft_authorisation_id,
}: Props) {
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
    </DCard>
  );
}
