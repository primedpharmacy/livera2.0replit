"use client";

/**
 * ClinicalFlagsView — BLD-16.6 / BLD-16.7
 *
 * G6 Clinical Flag Dashboard. Mirrors Primed Annex H §B2/§B3 reporting format.
 * Shows proactive disclosure effectiveness, flag frequency by code, and severity distribution.
 * Range / clinic / severity filters drive static mock data.
 */

import { useState } from "react";
import { Download, FileDown, Settings, FileText, TrendingUp, TrendingDown } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Range = "7d" | "30d" | "90d" | "ytd" | "all";
type ClinicFilter = "all" | "vsc" | "feeltru";
type SeverityFilter = "all" | "critical" | "high+";

// ── Mock data ─────────────────────────────────────────────────────────────────

interface DashboardData {
  effectivenessPct: number;   effectivenessDelta: string;
  flagsFired: number;         flagsDelta: string;
  proactiveNotes: number;     notesDelta: string;
  annexGQueries: number;      queriesDelta: string;
  slaCompliantPct: number;    slaDelta: string;
  avgResolutionH: number;     resDelta: string;
}

const DATA_90D: DashboardData = {
  effectivenessPct: 73,  effectivenessDelta: "+18 pts vs prior 90d",
  flagsFired: 224,       flagsDelta: "+12% vs prior",
  proactiveNotes: 164,   notesDelta: "+28% vs prior",
  annexGQueries: 38,     queriesDelta: "-41% vs prior",
  slaCompliantPct: 96,   slaDelta: "+4 pts vs prior",
  avgResolutionH: 4.2,   resDelta: "-1.1h vs prior",
};

const DATA_30D: DashboardData = {
  effectivenessPct: 76,  effectivenessDelta: "+11 pts vs prior 30d",
  flagsFired: 78,        flagsDelta: "+9% vs prior",
  proactiveNotes: 59,    notesDelta: "+22% vs prior",
  annexGQueries: 12,     queriesDelta: "-38% vs prior",
  slaCompliantPct: 97,   slaDelta: "+3 pts vs prior",
  avgResolutionH: 3.9,   resDelta: "-0.8h vs prior",
};

const DATA_7D: DashboardData = {
  effectivenessPct: 79,  effectivenessDelta: "+8 pts vs prior 7d",
  flagsFired: 18,        flagsDelta: "+6% vs prior",
  proactiveNotes: 14,    notesDelta: "+17% vs prior",
  annexGQueries: 2,      queriesDelta: "-50% vs prior",
  slaCompliantPct: 98,   slaDelta: "+2 pts vs prior",
  avgResolutionH: 3.7,   resDelta: "-0.6h vs prior",
};

const DATA_BY_RANGE: Record<Range, DashboardData> = {
  "7d":  DATA_7D,
  "30d": DATA_30D,
  "90d": DATA_90D,
  "ytd": { ...DATA_90D, effectivenessPct: 71, flagsFired: 341, proactiveNotes: 249, annexGQueries: 62 },
  "all": { ...DATA_90D, effectivenessPct: 68, flagsFired: 512, proactiveNotes: 362, annexGQueries: 94 },
};

// ── Flag codes ────────────────────────────────────────────────────────────────

interface FlagCode {
  code: string; labelLine1: string; labelLine2: string;
  count: number; proactivePct: number; colorClass: string;
}

const FLAG_CODES: FlagCode[] = [
  { code: "A2",  labelLine1: "Identity",         labelLine2: "",            count: 12,  proactivePct: 75,  colorClass: "bg-[#6366f1]" },
  { code: "B1",  labelLine1: "BMI",              labelLine2: "Missing",     count: 8,   proactivePct: 88,  colorClass: "bg-[#7c3aed]" },
  { code: "B2",  labelLine1: "BMI",              labelLine2: "Outdated",    count: 14,  proactivePct: 86,  colorClass: "bg-[#7c3aed]" },
  { code: "B3",  labelLine1: "Low BMI",          labelLine2: "Initial",     count: 41,  proactivePct: 68,  colorClass: "bg-[#7c3aed]" },
  { code: "B4",  labelLine1: "Low BMI",          labelLine2: "Repeat",      count: 63,  proactivePct: 77,  colorClass: "bg-[#7c3aed]" },
  { code: "C1",  labelLine1: "Wrong Start",      labelLine2: "Dose",        count: 6,   proactivePct: 100, colorClass: "bg-[#0891b2]" },
  { code: "C2",  labelLine1: "Excessive",        labelLine2: "Increase",    count: 22,  proactivePct: 73,  colorClass: "bg-[#0891b2]" },
  { code: "D1",  labelLine1: "Off-schedule",     labelLine2: "Reorder",     count: 18,  proactivePct: 61,  colorClass: "bg-[#b45309]" },
];

const MAX_COUNT = Math.max(...FLAG_CODES.map((f) => f.count));

// ── Severity ──────────────────────────────────────────────────────────────────

const SEVERITY = [
  { label: "Critical (E2)", count: 12, pct: 5.4,  color: "#991b1b", dotClass: "bg-[#991b1b]" },
  { label: "High",          count: 81, pct: 36.2, color: "#ef4444", dotClass: "bg-[#ef4444]" },
  { label: "Medium",        count: 131, pct: 58.5, color: "#f59e0b", dotClass: "bg-[#f59e0b]" },
];

const TOTAL_FLAGS = SEVERITY.reduce((a, s) => a + s.count, 0);

// ── Main component ────────────────────────────────────────────────────────────

export function ClinicalFlagsView() {
  const [range,    setRange]    = useState<Range>("90d");
  const [clinic,   setClinic]   = useState<ClinicFilter>("all");
  const [severity, setSeverity] = useState<SeverityFilter>("all");

  const d = DATA_BY_RANGE[range];

  const windowLabel = range === "90d" ? "06 Feb 2026 → 06 May 2026"
    : range === "30d" ? "14 Apr 2026 → 13 May 2026"
    : range === "7d"  ? "06 May 2026 → 13 May 2026"
    : range === "ytd" ? "01 Jan 2026 → 06 May 2026"
    : "All time";

  return (
    <div className="p-6 space-y-6">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Range */}
        <FilterGroup<Range>
          options={["7d", "30d", "90d", "ytd", "all"]}
          value={range}
          onChange={setRange}
          labels={{ "7d": "7D", "30d": "30D", "90d": "90D", "ytd": "YTD", "all": "All" }}
        />
        {/* Clinic */}
        <FilterGroup<ClinicFilter>
          options={["all", "vsc", "feeltru"]}
          value={clinic}
          onChange={setClinic}
          labels={{ all: "All clinics", vsc: "VSC", feeltru: "FeelTru" }}
        />
        {/* Severity */}
        <FilterGroup<SeverityFilter>
          options={["all", "critical", "high+"]}
          value={severity}
          onChange={setSeverity}
          labels={{ all: "All", critical: "Critical only", "high+": "High+" }}
        />

        <span className="text-[11px] text-t3 ml-1">Window: {windowLabel}</span>

        <div className="ml-auto flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-bdr text-[12px] font-semibold text-t2 hover:bg-page-bg">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-bdr text-[12px] font-semibold text-t2 hover:bg-page-bg">
            <FileDown className="w-3.5 h-3.5" /> Export PDF
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand text-white text-[12px] font-semibold">
            <TrendingUp className="w-3.5 h-3.5" /> Schedule export
          </button>
        </div>
      </div>

      {/* ── Hero row: Proactive Disclosure + Annex H panel ── */}
      <div className="grid grid-cols-5 gap-4">

        {/* Proactive disclosure hero */}
        <div className="col-span-3 rounded-xl p-6" style={{ background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)" }}>
          <p className="text-[11px] font-bold text-teal-200 uppercase tracking-widest mb-3">
            Proactive Disclosure Effectiveness
          </p>
          <div className="flex items-end gap-4 mb-3">
            <span className="text-[64px] font-black text-white leading-none tabular-nums">{d.effectivenessPct}</span>
            <span className="text-[32px] font-bold text-teal-300 mb-1">%</span>
          </div>
          <div className="inline-flex items-center gap-1.5 bg-teal-600/40 rounded-full px-3 py-1 mb-4">
            <TrendingUp className="w-3.5 h-3.5 text-teal-200" />
            <span className="text-[12px] font-semibold text-teal-100">{d.effectivenessDelta}</span>
          </div>
          <p className="text-[12.5px] text-teal-100 leading-relaxed">
            {d.effectivenessPct}% of flags fired on Livera-side ({d.proactiveNotes} of {d.flagsFired}) had a proactive note attached
            <span className="font-semibold"> before</span> Primed needed to raise an Annex G query.
            Up from {d.effectivenessPct - 18}% in the prior 90-day window. Target: 80% by Q3 2026.
          </p>
        </div>

        {/* Annex H reference panel */}
        <div className="col-span-2 bg-surface border border-bdr rounded-xl p-5">
          <p className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-1">Annex H Reference</p>
          <p className="text-[15px] font-bold text-t1 mb-3">Mirrors Primed §B2 + §B3 reporting format</p>
          <p className="text-[12px] text-t2 leading-relaxed mb-4">
            Numbers on this dashboard match Primed's monthly governance report exactly.
            Same flag definitions, same severity bands, same time windows.
            CSV export produces an Annex H-compliant file for direct comparison against Primed's report at the next governance review.
          </p>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-bdr text-[12px] font-semibold text-t2 hover:bg-page-bg">
              <Settings className="w-3.5 h-3.5" /> Configure rules
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-bdr text-[12px] font-semibold text-t2 hover:bg-page-bg">
              <FileText className="w-3.5 h-3.5" /> Annex H format
            </button>
          </div>
        </div>
      </div>

      {/* ── 5 Metric cards ── */}
      <div className="grid grid-cols-5 gap-4">
        <SmallMetric label="Flags fired (90d)"         value={d.flagsFired.toString()}  sub="Across all 9 mirrored Annex E codes" delta={d.flagsDelta}      />
        <SmallMetric label="Proactive notes attached"  value={d.proactiveNotes.toString()} sub="Authored at approval-time via BLD-16.4" delta={d.notesDelta}  positive />
        <SmallMetric label="Annex G queries raised"    value={d.annexGQueries.toString()} sub="By Primed despite Livera-side flag" delta={d.queriesDelta}    negative />
        <SmallMetric label="SLA-compliant responses"   value={`${d.slaCompliantPct}%`}  sub="Clinic responded within 24h"         delta={d.slaDelta}       positive />
        <SmallMetric label="Avg resolution time"       value={`${d.avgResolutionH}h`}   sub="From query raised to query closed"   delta={d.resDelta}       negative />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-5 gap-4">

        {/* Flag frequency by code */}
        <div className="col-span-3 bg-surface border border-bdr rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] font-bold text-t1">Flag fire frequency by code</span>
            <span className="text-[11px] text-t3">9 mirrored Annex E flags · last 90 days</span>
          </div>
          <p className="text-[11px] text-t3 mb-4">
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-teal-500 inline-block" />
              teal segment = proactive note attached
            </span>
          </p>
          <div className="space-y-2.5">
            {FLAG_CODES.map((flag) => {
              const barWidth = (flag.count / MAX_COUNT) * 100;
              const tealWidth = (flag.proactivePct / 100) * barWidth;
              return (
                <div key={flag.code} className="flex items-center gap-3">
                  <div className={`w-14 shrink-0 rounded-md px-1.5 py-1 text-center ${flag.colorClass}`}>
                    <p className="text-[9px] font-bold text-white leading-tight">{flag.code}</p>
                    <p className="text-[9px] text-white/80 leading-tight">{flag.labelLine1}</p>
                    {flag.labelLine2 && <p className="text-[9px] text-white/80 leading-tight">{flag.labelLine2}</p>}
                  </div>
                  <div className="flex-1 h-5 bg-page-bg rounded overflow-hidden relative">
                    {/* Total bar */}
                    <div
                      className="absolute inset-y-0 left-0 bg-bdr rounded"
                      style={{ width: `${barWidth}%` }}
                    />
                    {/* Proactive (teal) overlay */}
                    <div
                      className="absolute inset-y-0 left-0 bg-teal-500 rounded"
                      style={{ width: `${tealWidth}%` }}
                    />
                  </div>
                  <span className="w-7 text-right text-[12px] font-bold text-t1 tabular-nums">{flag.count}</span>
                  <span className="w-9 text-right text-[12px] font-semibold text-teal-600 tabular-nums">{flag.proactivePct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Severity distribution donut */}
        <div className="col-span-2 bg-surface border border-bdr rounded-xl p-5">
          <div className="mb-4">
            <span className="text-[13px] font-bold text-t1">Severity distribution</span>
            <span className="text-[11px] text-t3 ml-2">All flags · 90d</span>
          </div>

          <div className="flex items-center gap-5">
            {/* Donut */}
            <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
              <div
                className="w-full h-full rounded-full"
                style={{
                  background: `conic-gradient(
                    #991b1b 0% 5.4%,
                    #ef4444 5.4% 41.6%,
                    #f59e0b 41.6% 100%
                  )`,
                }}
              />
              <div className="absolute inset-[22px] rounded-full bg-surface flex flex-col items-center justify-center text-center">
                <span className="text-[20px] font-bold text-t1 leading-none">{TOTAL_FLAGS}</span>
                <span className="text-[9px] text-t3 uppercase tracking-wide mt-0.5">TOTAL FLAGS</span>
                <span className="text-[9px] text-t3 uppercase tracking-wide">90D</span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-3">
              {SEVERITY.map((s) => (
                <div key={s.label}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`w-3 h-3 rounded-sm shrink-0 ${s.dotClass}`} />
                    <span className="text-[12px] font-semibold text-t1">{s.label}</span>
                  </div>
                  <p className="text-[11px] text-t3 pl-5">{s.count} · {s.pct}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FilterGroup<T extends string>({
  options, value, onChange, labels,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <div className="flex items-center bg-page-bg border border-bdr rounded-lg p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
            value === opt ? "bg-brand text-white" : "text-t2 hover:text-t1"
          }`}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

function SmallMetric({
  label, value, sub, delta, positive, negative,
}: {
  label: string; value: string; sub: string; delta: string; positive?: boolean; negative?: boolean;
}) {
  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <p className="text-[10.5px] font-bold text-t3 uppercase tracking-wider mb-2">{label}</p>
      <span className="text-[24px] font-bold text-t1 tabular-nums">{value}</span>
      <p className="text-[10.5px] text-t3 leading-tight mt-1 mb-2">{sub}</p>
      <span className={`flex items-center gap-1 text-[11px] font-semibold ${
        positive ? "text-ok" : negative ? "text-err" : "text-t3"
      }`}>
        {positive ? <TrendingUp className="w-3 h-3" /> : negative ? <TrendingDown className="w-3 h-3" /> : null}
        {delta}
      </span>
    </div>
  );
}
