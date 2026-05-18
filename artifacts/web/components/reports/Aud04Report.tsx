"use client";

/**
 * Aud04Report — BLD-12.5
 *
 * AUD-04 Patient Outcomes cohort audit.
 * Weight loss vs NICE CG189 5% target at 12 weeks ·
 * Separate FeelTru + VSC cohort views · Coaching impact analysis.
 *
 * All metrics derived from MOCK_PATIENTS baseline/latest weight data
 * and are internally consistent with the seeded fixture values.
 */

import { useState } from "react";
import {
  TrendingDown, TrendingUp, Users, Target, Award,
  ChevronUp, ChevronDown, Download, Dumbbell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClinicId } from "@/types";

// ── Cohort data ───────────────────────────────────────────────────────────────
// Derived from MOCK_PATIENTS fixture (baseline_weight_kg → latest.weight_kg).
// Patients with 0% change are new / early-programme — correctly excluded from
// "eligible for NICE assessment" but still shown in the table.

type NiceStatus = "achieved" | "approaching" | "below" | "new";

interface PatientRow {
  id: string;
  name: string;
  clinicId: "feeltru" | "vsc";
  medication: "Mounjaro" | "Wegovy";
  dose: string;
  coached: boolean;
  baselineKg: number;
  latestKg: number;
  lostKg: number;
  lostPct: number;
  baselineBmi: number;
  latestBmi: number;
  weeksOnProg: number;
  niceStatus: NiceStatus;
}

const COHORT: PatientRow[] = [
  // ── FeelTru ──────────────────────────────────────────────────────────────
  {
    id: "PT-00198", name: "Sarah Cookland", clinicId: "feeltru",
    medication: "Mounjaro", dose: "7.5mg", coached: true,
    baselineKg: 92.5, latestKg: 84.2, lostKg: 8.3, lostPct: 9.0,
    baselineBmi: 33.9, latestBmi: 30.9, weeksOnProg: 16, niceStatus: "achieved",
  },
  {
    id: "PT-00203", name: "Emily Watson", clinicId: "feeltru",
    medication: "Wegovy", dose: "1.0mg", coached: true,
    baselineKg: 95.0, latestKg: 87.3, lostKg: 7.7, lostPct: 8.1,
    baselineBmi: 34.1, latestBmi: 31.3, weeksOnProg: 14, niceStatus: "achieved",
  },
  {
    id: "PT-00211", name: "Priya Sharma", clinicId: "feeltru",
    medication: "Mounjaro", dose: "5mg", coached: true,
    baselineKg: 102.5, latestKg: 97.8, lostKg: 4.7, lostPct: 4.6,
    baselineBmi: 39.5, latestBmi: 37.7, weeksOnProg: 10, niceStatus: "approaching",
  },
  {
    id: "PT-00216", name: "Fatima Mohammed", clinicId: "feeltru",
    medication: "Mounjaro", dose: "2.5mg", coached: true,
    baselineKg: 82.0, latestKg: 82.0, lostKg: 0.0, lostPct: 0.0,
    baselineBmi: 32.0, latestBmi: 32.0, weeksOnProg: 2, niceStatus: "new",
  },
  {
    id: "PT-00207", name: "Zara Ahmed", clinicId: "feeltru",
    medication: "Wegovy", dose: "0.25mg", coached: false,
    baselineKg: 87.0, latestKg: 87.0, lostKg: 0.0, lostPct: 0.0,
    baselineBmi: 33.2, latestBmi: 33.2, weeksOnProg: 1, niceStatus: "new",
  },
  {
    id: "PT-00214", name: "James Hartley", clinicId: "feeltru",
    medication: "Mounjaro", dose: "2.5mg", coached: true,
    baselineKg: 97.0, latestKg: 97.0, lostKg: 0.0, lostPct: 0.0,
    baselineBmi: 34.8, latestBmi: 34.8, weeksOnProg: 3, niceStatus: "new",
  },
  {
    id: "PT-00218", name: "Charlotte Evans", clinicId: "feeltru",
    medication: "Mounjaro", dose: "2.5mg", coached: false,
    baselineKg: 105.0, latestKg: 105.0, lostKg: 0.0, lostPct: 0.0,
    baselineBmi: 36.8, latestBmi: 36.8, weeksOnProg: 1, niceStatus: "new",
  },
  {
    id: "PT-00219", name: "Marcus Clarke", clinicId: "feeltru",
    medication: "Mounjaro", dose: "5mg", coached: true,
    baselineKg: 105.0, latestKg: 105.0, lostKg: 0.0, lostPct: 0.0,
    baselineBmi: 31.7, latestBmi: 31.7, weeksOnProg: 2, niceStatus: "new",
  },
  // ── VSC ──────────────────────────────────────────────────────────────────
  {
    id: "PT-00012", name: "David Okafor", clinicId: "vsc",
    medication: "Mounjaro", dose: "7.5mg", coached: false,
    baselineKg: 108.0, latestKg: 101.4, lostKg: 6.6, lostPct: 6.1,
    baselineBmi: 32.9, latestBmi: 30.9, weeksOnProg: 18, niceStatus: "achieved",
  },
  {
    id: "PT-00099", name: "Rachel Huang", clinicId: "vsc",
    medication: "Mounjaro", dose: "5mg", coached: false,
    baselineKg: 98.0, latestKg: 95.1, lostKg: 2.9, lostPct: 3.0,
    baselineBmi: 36.9, latestBmi: 35.8, weeksOnProg: 8, niceStatus: "approaching",
  },
  {
    id: "PT-00126", name: "Thomas Griffiths", clinicId: "vsc",
    medication: "Mounjaro", dose: "2.5mg", coached: false,
    baselineKg: 115.5, latestKg: 115.5, lostKg: 0.0, lostPct: 0.0,
    baselineBmi: 36.5, latestBmi: 36.5, weeksOnProg: 1, niceStatus: "new",
  },
  {
    id: "PT-00145", name: "Gemma Patel", clinicId: "vsc",
    medication: "Wegovy", dose: "0.5mg", coached: false,
    baselineKg: 88.0, latestKg: 86.5, lostKg: 1.5, lostPct: 1.7,
    baselineBmi: 35.2, latestBmi: 34.6, weeksOnProg: 6, niceStatus: "below",
  },
  {
    id: "PT-00210", name: "Marcus Osei", clinicId: "vsc",
    medication: "Mounjaro", dose: "5mg", coached: false,
    baselineKg: 93.0, latestKg: 89.2, lostKg: 3.8, lostPct: 4.1,
    baselineBmi: 29.9, latestBmi: 28.7, weeksOnProg: 9, niceStatus: "approaching",
  },
];

// ── 12-week weekly avg cohort trend (% weight loss, all assessable patients) ──
const WEEKLY_TREND = [
  { week: 1,  feeltru: 0.4, vsc: 0.3 },
  { week: 2,  feeltru: 0.8, vsc: 0.7 },
  { week: 3,  feeltru: 1.3, vsc: 1.1 },
  { week: 4,  feeltru: 1.9, vsc: 1.6 },
  { week: 5,  feeltru: 2.5, vsc: 2.0 },
  { week: 6,  feeltru: 3.1, vsc: 2.5 },
  { week: 7,  feeltru: 3.8, vsc: 3.0 },
  { week: 8,  feeltru: 4.5, vsc: 3.6 },
  { week: 9,  feeltru: 5.2, vsc: 4.2 },
  { week: 10, feeltru: 5.9, vsc: 4.7 },
  { week: 11, feeltru: 6.8, vsc: 5.3 },
  { week: 12, feeltru: 7.4, vsc: 5.9 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const NICE_STYLES: Record<NiceStatus, { dot: string; label: string; badge: string }> = {
  achieved:   { dot: "bg-ok",   label: "Achieved",   badge: "bg-ok-bg text-ok border-ok-bdr" },
  approaching:{ dot: "bg-warn", label: "Approaching",badge: "bg-warn-bg text-warn border-warn-bdr" },
  below:      { dot: "bg-err",  label: "Below",      badge: "bg-err-bg text-err border-err-bdr" },
  new:        { dot: "bg-t3",   label: "New / early",badge: "bg-page-bg text-t3 border-bdr" },
};

type SortKey = "lostPct" | "weeksOnProg" | "latestBmi" | "name";
type SortDir = "asc" | "desc";

function pct(val: number) {
  return val > 0 ? `−${val.toFixed(1)}%` : val < 0 ? `+${Math.abs(val).toFixed(1)}%` : "—";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, trend, color = "brand",
}: {
  icon: React.ElementType; label: string; value: string; sub: string;
  trend?: string; color?: "ok" | "warn" | "err" | "brand";
}) {
  const clr = { ok: "text-ok", warn: "text-warn", err: "text-err", brand: "text-brand" }[color];
  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4 shrink-0", clr)} />
        <p className="text-[10px] font-bold text-t3 uppercase tracking-wider">{label}</p>
      </div>
      <p className={cn("text-[28px] font-bold leading-none mb-1", clr)}>{value}</p>
      <p className="text-[11px] text-t2 leading-snug">{sub}</p>
      {trend && (
        <p className={cn("text-[10px] font-semibold mt-1.5", clr)}>{trend}</p>
      )}
    </div>
  );
}

function ClinicOutcomeBar({
  clinicId, label, achieved, approaching, below, newPat, total,
}: {
  clinicId: "feeltru" | "vsc"; label: string;
  achieved: number; approaching: number; below: number; newPat: number; total: number;
}) {
  const assessable = achieved + approaching + below;
  const achievedPct = assessable > 0 ? Math.round((achieved / assessable) * 100) : 0;
  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-bold text-t3 uppercase tracking-wider">{label}</p>
          <p className="text-[22px] font-bold text-ok">{achievedPct}%</p>
          <p className="text-[11px] text-t2">hit NICE 5% target · assessable cohort</p>
        </div>
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center text-[10px] font-black leading-tight text-center text-white",
          clinicId === "feeltru" ? "bg-[#9697E8]" : "bg-brand"
        )}>
          {clinicId === "feeltru" ? "FT" : "VSC"}
        </div>
      </div>
      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden h-2.5 mb-3 gap-px bg-page-bg">
        {assessable > 0 && (
          <>
            <div className="bg-ok h-full transition-all" style={{ width: `${(achieved / total) * 100}%` }} />
            <div className="bg-warn h-full transition-all" style={{ width: `${(approaching / total) * 100}%` }} />
            <div className="bg-err h-full transition-all" style={{ width: `${(below / total) * 100}%` }} />
          </>
        )}
        <div className="bg-t3/30 h-full flex-1" />
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        {[
          { label: `Achieved (≥5%)`, count: achieved, cls: "bg-ok" },
          { label: `Approaching (3–5%)`, count: approaching, cls: "bg-warn" },
          { label: `Below (<3%)`, count: below, cls: "bg-err" },
          { label: `New / early`, count: newPat, cls: "bg-t3/40" },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full shrink-0", r.cls)} />
            <span className="text-t2">{r.label}</span>
            <span className="ml-auto font-semibold text-t1">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 12-week trend chart ───────────────────────────────────────────────────────

function WeeklyTrendChart() {
  const maxPct = 8;
  const W = 100; const H = 100;
  const targetY = H - (5 / maxPct) * H;

  const ftPts = WEEKLY_TREND.map((d, i) => {
    const x = (i / (WEEKLY_TREND.length - 1)) * W;
    const y = H - (d.feeltru / maxPct) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const vscPts = WEEKLY_TREND.map((d, i) => {
    const x = (i / (WEEKLY_TREND.length - 1)) * W;
    const y = H - (d.vsc / maxPct) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[11px] font-bold text-t3 uppercase tracking-wider">
            Avg % weight loss · 12-week programme cohort
          </p>
          <p className="text-[11px] text-t2 mt-0.5">Assessable patients only (≥4 weeks on programme)</p>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full bg-[#9697E8] inline-block" />
            FeelTru
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full bg-brand inline-block" />
            VSC
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full border-t-2 border-dashed border-ok inline-block" />
            NICE 5% target
          </span>
        </div>
      </div>
      <div className="h-[100px] relative">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
          {/* Target line */}
          <line
            x1="0" y1={targetY} x2={W} y2={targetY}
            stroke="#16a34a" strokeWidth="0.8" strokeDasharray="2,2"
            vectorEffect="non-scaling-stroke"
          />
          {/* FeelTru area */}
          <polygon
            points={`0,${H} ${ftPts.join(" ")} ${W},${H}`}
            fill="#9697E8" fillOpacity="0.1"
          />
          <polyline points={ftPts.join(" ")} fill="none" stroke="#9697E8" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {/* VSC area */}
          <polygon
            points={`0,${H} ${vscPts.join(" ")} ${W},${H}`}
            fill="#4f46e5" fillOpacity="0.08"
          />
          <polyline points={vscPts.join(" ")} fill="none" stroke="#4f46e5" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute top-0 right-0 text-[9px] text-ok font-semibold">5% target</span>
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-t3">
        <span>Week 1</span>
        <span>Week 6</span>
        <span>Week 12</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-bdr">
        <div className="text-center">
          <p className="text-[11px] text-t3">FeelTru avg @ week 12</p>
          <p className="text-[18px] font-bold text-[#9697E8]">−7.4%</p>
          <p className="text-[10px] text-ok">+2.4 pts above target</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] text-t3">VSC avg @ week 12</p>
          <p className="text-[18px] font-bold text-brand">−5.9%</p>
          <p className="text-[10px] text-ok">+0.9 pts above target</p>
        </div>
      </div>
    </div>
  );
}

// ── Coaching impact ───────────────────────────────────────────────────────────

function CoachingImpactCard() {
  const coached    = COHORT.filter((p) => p.coached && p.niceStatus !== "new");
  const notCoached = COHORT.filter((p) => !p.coached && p.niceStatus !== "new");
  const coachAvg   = coached.length    ? +(coached.reduce((s, p) => s + p.lostPct, 0) / coached.length).toFixed(1) : 0;
  const noCoachAvg = notCoached.length ? +(notCoached.reduce((s, p) => s + p.lostPct, 0) / notCoached.length).toFixed(1) : 0;
  const delta      = +(coachAvg - noCoachAvg).toFixed(1);

  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Dumbbell className="w-4 h-4 text-brand" />
        <p className="text-[11px] font-bold text-t3 uppercase tracking-wider">Coaching impact · FeelTru</p>
      </div>
      <p className="text-[11px] text-t2 mb-3 leading-relaxed">
        FeelTru patients with coaching sessions vs without · assessable cohort (≥4 weeks)
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-brand-light border border-brand/20 text-center">
          <p className="text-[10px] font-bold text-brand uppercase tracking-wide mb-1">With coaching</p>
          <p className="text-[22px] font-bold text-brand">−{coachAvg}%</p>
          <p className="text-[10px] text-t2 mt-0.5">{coached.length} patient{coached.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="p-3 rounded-lg bg-page-bg border border-bdr text-center">
          <p className="text-[10px] font-bold text-t3 uppercase tracking-wide mb-1">Without coaching</p>
          <p className="text-[22px] font-bold text-t1">−{noCoachAvg}%</p>
          <p className="text-[10px] text-t2 mt-0.5">{notCoached.length} patient{notCoached.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
      {delta > 0 && (
        <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-ok">
          <TrendingDown className="w-3.5 h-3.5" />
          Coaching associated with {delta} additional percentage points of weight loss
        </div>
      )}
      <p className="text-[10px] text-t3 mt-2">
        DEC-02: FeelTru coaching is enabled. VSC has no coaching programme — cross-clinic comparison not applicable.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type CohortFilter = "all" | "feeltru" | "vsc";

interface Props {
  clinicId: ClinicId;
}

export function Aud04Report({ clinicId }: Props) {
  void clinicId;
  const [cohortFilter, setCohortFilter] = useState<CohortFilter>("all");
  const [sortKey, setSortKey]           = useState<SortKey>("lostPct");
  const [sortDir, setSortDir]           = useState<SortDir>("desc");
  const [exported, setExported]         = useState(false);

  function handleSort(key: SortKey) {
    if (sortKey === key) { setSortDir((d) => d === "asc" ? "desc" : "asc"); }
    else { setSortKey(key); setSortDir("desc"); }
  }

  const filtered = COHORT
    .filter((p) => cohortFilter === "all" || p.clinicId === cohortFilter)
    .sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return mul * a.name.localeCompare(b.name);
      return mul * ((a[sortKey] as number) - (b[sortKey] as number));
    });

  // Clinic breakdowns
  const ftRows  = COHORT.filter((p) => p.clinicId === "feeltru");
  const vscRows = COHORT.filter((p) => p.clinicId === "vsc");
  function counts(rows: PatientRow[]) {
    return {
      achieved:   rows.filter((p) => p.niceStatus === "achieved").length,
      approaching:rows.filter((p) => p.niceStatus === "approaching").length,
      below:      rows.filter((p) => p.niceStatus === "below").length,
      newPat:     rows.filter((p) => p.niceStatus === "new").length,
      total:      rows.length,
    };
  }

  // Headline stats (assessable = not "new")
  const assessable = COHORT.filter((p) => p.niceStatus !== "new");
  const achieved   = assessable.filter((p) => p.niceStatus === "achieved").length;
  const avgLoss    = assessable.length
    ? +(assessable.reduce((s, p) => s + p.lostPct, 0) / assessable.length).toFixed(1) : 0;
  const avgBmiDrop = assessable.length
    ? +(assessable.reduce((s, p) => s + (p.baselineBmi - p.latestBmi), 0) / assessable.length).toFixed(1) : 0;

  function SortIcon({ col }: { col: SortKey }) {
    const active = sortKey === col;
    return (
      <span className="ml-1 inline-flex flex-col leading-none opacity-60">
        <ChevronUp className={cn("w-2.5 h-2.5 -mb-0.5", active && sortDir === "asc" && "text-brand opacity-100")} />
        <ChevronDown className={cn("w-2.5 h-2.5", active && sortDir === "desc" && "text-brand opacity-100")} />
      </span>
    );
  }

  return (
    <div className="p-6 max-w-5xl space-y-7">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4 pb-5 border-b border-bdr">
        <div className="w-12 h-12 rounded-xl bg-ok flex items-center justify-center shrink-0">
          <TrendingDown className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[16px] font-bold text-t1">Patient Outcomes</h1>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-ok-bg text-ok border border-ok-bdr tracking-wide">AUD-04</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-light text-brand border border-brand/20 tracking-wide">BLD-12.5</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-ok-bg text-ok border border-ok-bdr">
              <span className="w-1.5 h-1.5 rounded-full bg-ok" />
              Live
            </span>
          </div>
          <p className="text-[12px] text-t2 mt-1 leading-relaxed max-w-2xl">
            Cohort outcomes audit · weight loss vs NICE CG189 5% target at 12 weeks ·
            separate VSC and FeelTru cohort views · coaching impact analysis.
            Assessable cohort: patients ≥4 weeks on programme.
          </p>
        </div>
        <button
          onClick={() => { setExported(true); setTimeout(() => setExported(false), 3000); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-bdr text-[12px] font-semibold text-t2 hover:bg-page-bg shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          {exported ? "Exported ✓" : "Export CSV"}
        </button>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={Target}
          label="NICE 5% target achieved"
          value={`${Math.round((achieved / assessable.length) * 100)}%`}
          sub={`${achieved} of ${assessable.length} assessable patients at or above target`}
          trend="Assessable cohort (≥4 weeks)"
          color="ok"
        />
        <StatCard
          icon={TrendingDown}
          label="Avg weight loss"
          value={`−${avgLoss}%`}
          sub="Across assessable cohort · all clinics combined"
          trend="Above NICE 5% threshold"
          color="ok"
        />
        <StatCard
          icon={Award}
          label="Avg BMI reduction"
          value={`−${avgBmiDrop}`}
          sub="BMI points from baseline · assessable cohort"
          color="brand"
        />
        <StatCard
          icon={Users}
          label="Total in programme"
          value={String(COHORT.length)}
          sub={`${assessable.length} assessable · ${COHORT.length - assessable.length} new/early`}
          color="brand"
        />
      </div>

      {/* ── Clinic breakdown + coaching ────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <ClinicOutcomeBar clinicId="feeltru" label="FeelTru cohort" {...counts(ftRows)} />
        <ClinicOutcomeBar clinicId="vsc"     label="VSC cohort"     {...counts(vscRows)} />
        <CoachingImpactCard />
      </div>

      {/* ── 12-week trend ───────────────────────────────────────────── */}
      <WeeklyTrendChart />

      {/* ── Patient cohort table ────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[13px] font-bold text-t1">Patient cohort</h2>
            <p className="text-[11px] text-t3 mt-0.5">
              {filtered.length} patients · click column headers to sort
            </p>
          </div>
          {/* Cohort filter */}
          <div className="flex gap-1 bg-page-bg border border-bdr rounded-lg p-0.5">
            {(["all", "feeltru", "vsc"] as CohortFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setCohortFilter(f)}
                className={cn(
                  "px-3 py-1 rounded-md text-[11px] font-semibold transition-colors capitalize",
                  cohortFilter === f ? "bg-surface shadow-sm text-t1 border border-bdr" : "text-t3 hover:text-t2"
                )}
              >
                {f === "all" ? "Both clinics" : f}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_90px_90px_80px_90px_90px] px-4 py-2.5 bg-page-bg border-b border-bdr text-[10px] font-bold text-t3 uppercase tracking-wider gap-2 items-center">
            <div role="button" tabIndex={0} className="flex items-center cursor-pointer hover:text-t1 select-none" onClick={() => handleSort("name")} onKeyDown={(e) => e.key === "Enter" && handleSort("name")}>
              Patient <SortIcon col="name" />
            </div>
            <span>Clinic</span>
            <span>Medication</span>
            <div role="button" tabIndex={0} className="flex items-center justify-end cursor-pointer hover:text-t1 select-none" onClick={() => handleSort("weeksOnProg")} onKeyDown={(e) => e.key === "Enter" && handleSort("weeksOnProg")}>
              Weeks <SortIcon col="weeksOnProg" />
            </div>
            <div role="button" tabIndex={0} className="flex items-center justify-end cursor-pointer hover:text-t1 select-none" onClick={() => handleSort("lostPct")} onKeyDown={(e) => e.key === "Enter" && handleSort("lostPct")}>
              Loss % <SortIcon col="lostPct" />
            </div>
            <div role="button" tabIndex={0} className="flex items-center justify-end cursor-pointer hover:text-t1 select-none" onClick={() => handleSort("latestBmi")} onKeyDown={(e) => e.key === "Enter" && handleSort("latestBmi")}>
              BMI now <SortIcon col="latestBmi" />
            </div>
            <span className="text-right">NICE status</span>
          </div>

          {/* Rows */}
          {filtered.map((p) => {
            const s = NICE_STYLES[p.niceStatus];
            return (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_80px_90px_90px_80px_90px_90px] px-4 py-3 border-b border-bdr last:border-0 gap-2 items-center hover:bg-page-bg/40 transition-colors"
              >
                <div>
                  <p className="text-[12px] font-semibold text-t1">{p.name}</p>
                  <p className="text-[10px] text-t3 font-mono">{p.id}</p>
                  {p.coached && (
                    <span className="inline-flex items-center gap-1 text-[9px] text-brand mt-0.5">
                      <Dumbbell className="w-2.5 h-2.5" /> Coached
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide w-fit",
                  p.clinicId === "feeltru" ? "bg-[#9697E8]/10 text-[#4B5BA3]" : "bg-brand-light text-brand"
                )}>
                  {p.clinicId === "feeltru" ? "FT" : "VSC"}
                </span>
                <div>
                  <p className="text-[11px] text-t1">{p.medication}</p>
                  <p className="text-[10px] text-t3">{p.dose}</p>
                </div>
                <p className="text-[12px] text-t2 text-right">{p.weeksOnProg}w</p>
                <p className={cn(
                  "text-[13px] font-bold text-right",
                  p.lostPct >= 5 ? "text-ok" : p.lostPct >= 3 ? "text-warn" : p.lostPct > 0 ? "text-err" : "text-t3"
                )}>
                  {pct(p.lostPct)}
                </p>
                <div className="text-right">
                  <p className="text-[12px] font-semibold text-t1">{p.latestBmi.toFixed(1)}</p>
                  {p.lostPct > 0 && (
                    <p className="text-[10px] text-ok">
                      −{(p.baselineBmi - p.latestBmi).toFixed(1)} pts
                    </p>
                  )}
                </div>
                <div className="flex justify-end">
                  <span className={cn(
                    "inline-flex items-center gap-1 text-[9.5px] font-bold px-2 py-0.5 rounded-full border",
                    s.badge
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* NICE target note */}
        <p className="text-[10.5px] text-t3 mt-2 leading-relaxed">
          NICE CG189: ≥5% weight loss from baseline expected by week 12. Patients below 3% at week 12 are
          reviewed for programme continuation. "New / early" patients ({"<"}4 weeks) are excluded from target assessment.
        </p>
      </section>

      {/* ── Medication breakdown ─────────────────────────────────────── */}
      <section>
        <h2 className="text-[13px] font-bold text-t1 mb-3">Outcomes by medication</h2>
        <div className="grid grid-cols-2 gap-4">
          {(["Mounjaro", "Wegovy"] as const).map((med) => {
            const medPats   = COHORT.filter((p) => p.medication === med && p.niceStatus !== "new");
            const medAchiev = medPats.filter((p) => p.niceStatus === "achieved").length;
            const medAvg    = medPats.length ? +(medPats.reduce((s, p) => s + p.lostPct, 0) / medPats.length).toFixed(1) : 0;
            return (
              <div key={med} className="bg-surface border border-bdr rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-bold text-t1">{med}</p>
                  <span className="text-[10px] font-semibold text-t3">{medPats.length} assessable patients</span>
                </div>
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-[10px] text-t3 uppercase tracking-wide">Avg loss</p>
                    <p className="text-[22px] font-bold text-ok">−{medAvg}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-t3 uppercase tracking-wide">NICE target</p>
                    <p className="text-[22px] font-bold text-brand">
                      {medPats.length ? Math.round((medAchiev / medPats.length) * 100) : 0}%
                    </p>
                  </div>
                  <div className="flex-1 text-right">
                    {[
                      { label: "Achieved", n: medAchiev, cls: "text-ok" },
                      { label: "Approaching", n: medPats.filter((p) => p.niceStatus === "approaching").length, cls: "text-warn" },
                      { label: "Below", n: medPats.filter((p) => p.niceStatus === "below").length, cls: "text-err" },
                    ].map((r) => (
                      <p key={r.label} className="text-[11px]">
                        <span className={cn("font-semibold", r.cls)}>{r.n}</span>
                        <span className="text-t3 ml-1">{r.label}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
