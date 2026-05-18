import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { analyseWeightHistory, WEIGHT_WARNING_CHIP_CLS } from "@/lib/clinical/weightWarnings";
import type { Order } from "@/types";

interface Props {
  history: NonNullable<Order["weight_history"]>;
  orderType?: Order["type"];
}

export function OrderWeightTrajectoryCard({ history, orderType }: Props) {
  if (history.length === 0) return null;
  const warnings = analyseWeightHistory(history, {
    isContinuation: orderType === "reorder",
  });

  const sorted    = [...history].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const first     = sorted[0];
  const last      = sorted[sorted.length - 1];
  const lostKg    = +(first.weight_kg - last.weight_kg).toFixed(1);
  const lostPct   = +((lostKg / first.weight_kg) * 100).toFixed(1);
  const gained    = lostKg < 0;

  // Sparkline — normalize weights to SVG viewport (0-100 height)
  const weights   = sorted.map((r) => r.weight_kg);
  const minW      = Math.min(...weights);
  const maxW      = Math.max(...weights);
  const range     = Math.max(maxW - minW, 1);
  const padH      = 10;  // top/bottom padding in SVG units

  const pts = sorted.map((r, i) => {
    const x = sorted.length === 1 ? 50 : (i / (sorted.length - 1)) * 100;
    const y = padH + ((maxW - r.weight_kg) / range) * (100 - padH * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polyline = pts.join(" ");

  const startWeekLabel = format(parseISO(first.recorded_at), "d MMM yyyy");
  const endWeekLabel   = format(parseISO(last.recorded_at),  "d MMM yyyy");

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-surface-2">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-3.5 h-3.5 text-brand" />
          <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider">
            Weight trajectory · last {sorted.length} readings
          </h3>
        </div>
        <span className="text-[11px] text-t3">
          {first.weight_kg}kg → {last.weight_kg}kg
        </span>
      </div>

      <div className="p-4">
        {/* Concerning trend warnings (Task-69) */}
        {warnings.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {warnings.map((w) => (
              <span
                key={w.kind}
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-semibold border rounded-full px-2 py-0.5",
                  WEIGHT_WARNING_CHIP_CLS[w.severity],
                )}
              >
                <AlertTriangle className="w-3 h-3" />
                {w.label}
              </span>
            ))}
          </div>
        )}

        {/* Main trajectory row */}
        <div className="flex items-center gap-4">
          {/* Start stat */}
          <div className="shrink-0 text-right w-[80px]">
            <p className="text-[9.5px] text-t3 uppercase tracking-wide">Start</p>
            <p className="text-[15px] font-bold text-t1">{first.weight_kg}kg</p>
            <p className="text-[10px] text-t3">{startWeekLabel}</p>
          </div>

          {/* SVG sparkline */}
          <div className="flex-1 min-w-0 h-[52px] relative">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              {/* Trend line */}
              <polyline
                points={polyline}
                fill="none"
                stroke="#4f46e5"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {/* Data point dots */}
              {sorted.map((r, i) => {
                const x = sorted.length === 1 ? 50 : (i / (sorted.length - 1)) * 100;
                const y = padH + ((maxW - r.weight_kg) / range) * (100 - padH * 2);
                return (
                  <circle
                    key={r.recorded_at}
                    cx={x}
                    cy={y}
                    r="2.5"
                    fill="#4f46e5"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
          </div>

          {/* End stat */}
          <div className="shrink-0 w-[90px]">
            <p className="text-[9.5px] text-t3 uppercase tracking-wide">Now · change</p>
            <p className="text-[15px] font-bold text-t1">{last.weight_kg}kg</p>
            <p className={cn(
              "text-[11px] font-semibold",
              gained ? "text-err" : "text-ok"
            )}>
              {gained ? "+" : "−"}{Math.abs(lostKg)}kg · {gained ? "+" : "−"}{Math.abs(lostPct)}%
            </p>
          </div>
        </div>

        {/* Reading table */}
        <div className="mt-3 border border-border rounded-md overflow-hidden">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-surface-2 border-b border-border">
                <th className="text-left px-3 py-1.5 font-semibold text-t3">Date</th>
                <th className="text-right px-3 py-1.5 font-semibold text-t3">Weight</th>
                <th className="text-right px-3 py-1.5 font-semibold text-t3">BMI</th>
                <th className="text-right px-3 py-1.5 font-semibold text-t3">Change</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const prev     = i > 0 ? sorted[i - 1] : null;
                const delta    = prev ? +(prev.weight_kg - r.weight_kg).toFixed(1) : null;
                const isGained = delta !== null && delta < 0;
                const isLast   = i === sorted.length - 1;
                return (
                  <tr key={r.recorded_at} className={cn(
                    "border-b border-border last:border-0",
                    isLast && "bg-surface-2"
                  )}>
                    <td className="px-3 py-1.5 text-t2">
                      {format(parseISO(r.recorded_at), "d MMM yyyy")}
                      {isLast && <span className="ml-1 text-[9px] font-bold text-brand">LATEST</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold text-t1">{r.weight_kg}kg</td>
                    <td className="px-3 py-1.5 text-right text-t2">{r.bmi.toFixed(1)}</td>
                    <td className={cn(
                      "px-3 py-1.5 text-right font-semibold",
                      delta === null ? "text-t3" :
                      isGained ? "text-err" : "text-ok"
                    )}>
                      {delta === null ? "—" : `${isGained ? "+" : "−"}${Math.abs(delta)}kg`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
