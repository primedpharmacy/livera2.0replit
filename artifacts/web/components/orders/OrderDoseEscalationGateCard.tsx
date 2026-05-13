import { TrendingUp, CheckCircle, XCircle, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

interface Props {
  gate: NonNullable<NonNullable<Order["dose_escalation_gate"]>>;
}

export function OrderDoseEscalationGateCard({ gate }: Props) {
  const criteria = [
    {
      label: "Weeks at current dose",
      value: `${gate.weeks_at_current_dose} weeks`,
      detail: `≥${gate.weeks_required} required`,
      pass: gate.weeks_at_current_dose >= gate.weeks_required,
    },
    {
      label: "Weight loss",
      value: `${gate.weight_loss_pct.toFixed(1)}%`,
      detail: "Trending toward 5% NICE target",
      pass: gate.weight_loss_pct >= 3,
    },
    {
      label: "Prior-dose evidence",
      value: gate.prior_evidence_uploaded ? "Uploaded" : "Not uploaded",
      detail: gate.evidence_label,
      pass: gate.prior_evidence_uploaded,
    },
  ];

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-surface-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-brand" />
          <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider">Dose escalation gate</h3>
        </div>
        <span className="text-[11px] font-semibold text-t3">
          {gate.from_dose} → {gate.to_dose}
        </span>
      </div>

      <div className="p-3">
        <div className={cn(
          "rounded-lg border p-3 mb-3",
          gate.eligible ? "bg-ok-bg border-ok-bdr" : "bg-err-bg border-err-bdr"
        )}>
          <div className={cn(
            "flex items-center gap-2 text-[13px] font-bold mb-3",
            gate.eligible ? "text-ok" : "text-err"
          )}>
            {gate.eligible
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <XCircle className="w-4 h-4 shrink-0" />
            }
            Dose escalation: {gate.eligible ? "eligible" : "not eligible"}
          </div>

          <div className="space-y-2">
            {criteria.map((c) => (
              <div key={c.label} className="flex items-start gap-2">
                {c.pass
                  ? <CheckCircle className="w-3.5 h-3.5 text-ok shrink-0 mt-0.5" />
                  : <XCircle className="w-3.5 h-3.5 text-err shrink-0 mt-0.5" />
                }
                <div className="text-[12px]">
                  <span className="text-t2">{c.label}: </span>
                  <span className="font-semibold text-t1">{c.value}</span>
                  {c.detail && (
                    <span className="text-t3 ml-1">({c.detail})</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {gate.evidence_label && gate.prior_evidence_uploaded && (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-t3">
              <Paperclip className="w-3 h-3 shrink-0" />
              <span>{gate.evidence_label}</span>
              <button
                onClick={() => {}}
                className="text-brand hover:underline ml-0.5"
              >
                View
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
