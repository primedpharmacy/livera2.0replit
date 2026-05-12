"use client";

/**
 * SlaTimerWidget — BLD-3.1 (Wave 3).
 *
 * Compact timer chip showing time-until-breach.
 * Variant "full" shows a progress bar for Order Detail.
 * Variant "chip" shows a small inline badge for queue rows.
 *
 * Uses NOW from @/lib/api/constants — never Date.now().
 * All thresholds from props (sourced from clinic.config) — no literals.
 */

import { Clock, AlertTriangle } from "lucide-react";
import { NOW } from "@/lib/api/constants";

interface SlaTimerWidgetProps {
  sla_deadline: string;   // ISO — the breach_at timestamp
  sla_warn_at?: string;   // ISO — the warn_at timestamp (for colour tinting)
  label: string;          // e.g. "Approval SLA"
  total_hours: number;    // clinic.config.default_slas.approval_breach_hours
  variant?: "full" | "chip";
}

function computeState(deadlineMs: number, warnAtMs: number | null, nowMs: number) {
  const remainingMs = deadlineMs - nowMs;
  const breached    = remainingMs <= 0;
  const warned      = !breached && warnAtMs !== null && nowMs > warnAtMs;
  const hoursLeft   = Math.max(0, Math.floor(remainingMs / 3_600_000));
  const minsLeft    = Math.max(0, Math.floor((remainingMs % 3_600_000) / 60_000));
  const display     = breached ? "Breached" : `${String(hoursLeft).padStart(2, "0")}:${String(minsLeft).padStart(2, "0")}`;
  return { breached, warned, display };
}

export function SlaTimerWidget({
  sla_deadline,
  sla_warn_at,
  label,
  total_hours,
  variant = "full",
}: SlaTimerWidgetProps) {
  const nowMs      = new Date(NOW).getTime();
  const deadlineMs = new Date(sla_deadline).getTime();
  const warnAtMs   = sla_warn_at ? new Date(sla_warn_at).getTime() : null;

  const { breached, warned, display } = computeState(deadlineMs, warnAtMs, nowMs);

  const color =
    breached ? "err" :
    warned   ? "warn" :
    "t2";

  const bgClass    = breached ? "bg-err-bg border-err-bdr" : warned ? "bg-warn-bg border-warn-bdr" : "bg-page-bg border-bdr";
  const textClass  = breached ? "text-err" : warned ? "text-warn" : "text-t2";
  const valueClass = breached ? "text-err" : warned ? "text-warn" : "text-t1";

  if (variant === "chip") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${bgClass} ${textClass}`}
        title={`${label}: deadline ${sla_deadline}`}
      >
        {breached || warned ? (
          <AlertTriangle className={`w-3 h-3 ${textClass}`} />
        ) : (
          <Clock className="w-3 h-3" />
        )}
        {display}
      </span>
    );
  }

  // ── Full variant ──────────────────────────────────────────────────────────
  const elapsedMs    = Math.max(0, nowMs - (deadlineMs - total_hours * 3_600_000));
  const totalMs      = total_hours * 3_600_000;
  const progressPct  = Math.min(100, Math.round((elapsedMs / totalMs) * 100));

  const barBg  = breached ? "bg-err"  : warned ? "bg-warn"  : "bg-brand";

  return (
    <div className={`rounded-lg border p-4 ${bgClass}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          {breached || warned
            ? <AlertTriangle className={`w-4 h-4 ${textClass}`} />
            : <Clock className={`w-4 h-4 ${textClass}`} />}
          <span className={`text-[12px] font-semibold ${textClass}`}>{label}</span>
        </div>
        <span className={`text-[20px] font-bold tabular-nums leading-none ${valueClass}`}>
          {display}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-page-bg rounded-full overflow-hidden border border-bdr">
        <div
          className={`h-full rounded-full transition-none ${barBg}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className={`mt-2 text-[10px] ${textClass}`}>
        {breached
          ? `SLA breached — deadline was ${new Date(sla_deadline).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
          : `Deadline: ${new Date(sla_deadline).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
        }
      </div>
    </div>
  );
}
