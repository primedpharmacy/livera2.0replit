"use client";

import { Clock } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { DCard } from "./orderPrimitives";

interface Props {
  slaBreached: boolean;
  slaWarning: boolean;
  slaHoursLeft: number;
  slaTotalHours: number;
  sla_breach_at: string;
}

export function OrderSLACard({
  slaBreached,
  slaWarning,
  slaHoursLeft,
  slaTotalHours,
  sla_breach_at,
}: Props) {
  return (
    <DCard icon={Clock} title="SLA Status">
      <div className={`flex items-start gap-3 p-3 rounded-md border ${
        slaBreached ? "bg-err-bg border-err-bdr" :
        slaWarning  ? "bg-warn-bg border-warn-bdr" :
        "bg-info-bg border-info-bdr"
      }`}>
        <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${
          slaBreached ? "text-err" : slaWarning ? "text-warn" : "text-info"
        }`} />
        <div>
          <p className={`text-[13px] font-semibold ${
            slaBreached ? "text-err" : slaWarning ? "text-warn" : "text-info"
          }`}>
            {slaBreached
              ? "SLA Breached"
              : slaWarning
              ? `SLA Warning — ${slaHoursLeft}h remaining`
              : `On track — ${slaHoursLeft}h remaining`}
          </p>
          <p className="text-[11px] text-t2 mt-0.5">
            Target: {slaTotalHours}h from submission · Breach at {formatDateTime(sla_breach_at)}
          </p>
        </div>
      </div>
    </DCard>
  );
}
