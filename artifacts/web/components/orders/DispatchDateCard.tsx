"use client";

/**
 * DispatchDateCard — BLD-4.6.3
 *
 * Four-scenario dispatch date calculator.
 * Displayed on the Order Detail left panel for orders in
 * clinical_check / approved / on_hold / dispensed status.
 *
 * Scenario A — Same-day:       approved before 13:00 on a working day
 * Scenario B — Next WD:        approved after 13:00 on a weekday
 * Scenario C — Holiday skip:   next WD is a UK bank holiday → advance
 * Scenario D — Pre-weekend:    Friday after 13:00 → Monday
 */

import { Truck, Clock, Sun, CalendarX, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  calculateDispatchDate,
  SAME_DAY_CUTOFF_HOUR,
  type DispatchScenario,
  type HolidayEntry,
} from "@/lib/dispatchCalculator";

interface Props {
  approvedAt:      string;        // ISO timestamp — when clinical approval occurred
  holidays:        HolidayEntry[];
  orderStatus:     string;
}

// ── Scenario display config ────────────────────────────────────────────────────

const SCENARIO_CONFIG: Record<
  DispatchScenario,
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  same_day: {
    label:  "Same-day dispatch",
    icon:   Truck,
    color:  "text-ok",
    bg:     "bg-ok-bg",
    border: "border-ok-bdr",
  },
  next_working_day: {
    label:  "Next working day",
    icon:   Calendar,
    color:  "text-brand",
    bg:     "bg-brand-light",
    border: "border-brand/20",
  },
  holiday_skip: {
    label:  "Bank holiday delay",
    icon:   CalendarX,
    color:  "text-warn",
    bg:     "bg-warn-bg",
    border: "border-warn-bdr",
  },
  pre_weekend: {
    label:  "Weekend delay",
    icon:   Sun,
    color:  "text-brand",
    bg:     "bg-brand-light",
    border: "border-brand/20",
  },
};

// ── Sub-component: scenario badge ─────────────────────────────────────────────

function ScenarioBadge({ scenario }: { scenario: DispatchScenario }) {
  const cfg = SCENARIO_CONFIG[scenario];
  const Icon = cfg.icon;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide",
      cfg.bg, cfg.color, cfg.border
    )}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ── Sub-component: scenario timeline ──────────────────────────────────────────

function ScenarioTimeline({ scenario, cutoffMet, workingDaysAdded, skippedHolidays }: {
  scenario: DispatchScenario;
  cutoffMet: boolean;
  workingDaysAdded: number;
  skippedHolidays: string[];
}) {
  const steps: { label: string; done: boolean; warn?: boolean }[] = [];

  if (scenario === "same_day") {
    steps.push(
      { label: `Approved before ${SAME_DAY_CUTOFF_HOUR}:00 cut-off`, done: true },
      { label: "Working day confirmed", done: true },
      { label: "Dispatches today ✓", done: true },
    );
  } else if (scenario === "next_working_day") {
    steps.push(
      { label: `Approved after ${SAME_DAY_CUTOFF_HOUR}:00 cut-off`, done: true },
      { label: "Next calendar day is a working day", done: true },
      { label: "Dispatches next working day", done: true },
    );
  } else if (scenario === "holiday_skip") {
    steps.push(
      { label: `Approved after ${SAME_DAY_CUTOFF_HOUR}:00 cut-off`, done: true },
      { label: `Bank holiday${skippedHolidays.length > 1 ? "s" : ""}: ${skippedHolidays.join(", ")}`, done: true, warn: true },
      { label: `Advanced +${workingDaysAdded} day${workingDaysAdded !== 1 ? "s" : ""} to next working day`, done: true },
    );
  } else {
    steps.push(
      { label: `Approved after ${SAME_DAY_CUTOFF_HOUR}:00 on Friday`, done: true },
      { label: "Saturday + Sunday skipped", done: true, warn: false },
      { label: "Dispatches Monday", done: true },
    );
  }

  return (
    <div className="flex flex-col gap-1 mt-2.5">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 text-[11px]">
          <span className={cn(
            "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0",
            step.warn ? "bg-warn text-white" : "bg-ok text-white"
          )}>
            {i + 1}
          </span>
          <span className={step.warn ? "text-warn font-semibold" : "text-t2"}>{step.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const SHOW_FOR_STATUSES = new Set([
  "clinical_check", "approved", "on_hold", "dispensed",
]);

export function DispatchDateCard({ approvedAt, holidays, orderStatus }: Props) {
  if (!SHOW_FOR_STATUSES.has(orderStatus)) return null;

  const result = calculateDispatchDate(approvedAt, holidays);
  const cfg    = SCENARIO_CONFIG[result.scenario];
  const Icon   = cfg.icon;

  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-page-bg border-b border-bdr">
        <Truck className="w-3.5 h-3.5 text-t2 shrink-0" />
        <span className="text-[11px] font-bold text-t2 uppercase tracking-wider flex-1">
          Estimated dispatch
        </span>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-light text-brand border border-brand/20">
          BLD-4.6.3
        </span>
      </div>

      {/* Body */}
      <div className="px-3.5 py-3">
        {/* Dispatch date + scenario badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-[18px] font-bold text-t1 leading-tight">
              {result.dispatchDateStr}
            </p>
            {result.workingDaysAdded === 0 ? (
              <p className="text-[11px] text-ok font-semibold mt-0.5">Today</p>
            ) : (
              <p className="text-[11px] text-t3 mt-0.5">
                +{result.workingDaysAdded} calendar day{result.workingDaysAdded !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
            cfg.bg, cfg.border, "border"
          )}>
            <Icon className={cn("w-4 h-4", cfg.color)} />
          </div>
        </div>

        <ScenarioBadge scenario={result.scenario} />

        {/* Explanation */}
        <p className="text-[11px] text-t2 leading-relaxed mt-2.5 mb-2.5">
          {result.explanation}
        </p>

        {/* Scenario steps */}
        <ScenarioTimeline
          scenario={result.scenario}
          cutoffMet={result.cutoffMet}
          workingDaysAdded={result.workingDaysAdded}
          skippedHolidays={result.skippedHolidays}
        />

        {/* Cut-off info footer */}
        <div className="mt-3 pt-2.5 border-t border-bdr flex items-center gap-1.5 text-[10px] text-t3">
          <Clock className="w-3 h-3 shrink-0" />
          <span>
            Same-day cut-off: <strong className="text-t2">{SAME_DAY_CUTOFF_HOUR}:00</strong> · UK bank holidays applied from clinic calendar
          </span>
        </div>
      </div>
    </div>
  );
}
