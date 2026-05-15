"use client";

/**
 * KpiDashboardView — BLD-12.1 / BLD-12.2 / BLD-12.3 / BLD-12.4
 *
 * Operational metrics: order throughput, approval rates, SLA compliance, patient outcomes.
 * Range and clinic filters switch between static mock datasets.
 * Charts use pure SVG (trend line) and CSS conic-gradient (donut) — no chart library dependency.
 */

import { useState } from "react";
import { Download, FileDown, TrendingUp, TrendingDown, Minus } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Range = "7d" | "30d" | "90d" | "ytd";
type ClinicFilter = "both" | "vsc" | "feeltru";

interface Metrics {
  orders: number;        ordersDelta: string;
  approved: number;      approvedPct: number;  approvedDelta: string;
  avgTime: number;       avgTimeDelta: string;  avgTimeTarget: string;
  reorderRate: number;   reorderDelta: string;
  activePatients: number; activeDelta: string;
  vscOrders: number;     ftOrders: number;
}

// ── Static mock datasets ──────────────────────────────────────────────────────

const DATA: Record<Range, Metrics> = {
  "7d": {
    orders: 18, ordersDelta: "+12% vs prior",
    approved: 16, approvedPct: 89, approvedDelta: "+2 pts vs prior",
    avgTime: 3.1, avgTimeDelta: "-0.4h vs prior", avgTimeTarget: "SLA target 54h · 97% within",
    reorderRate: 71, reorderDelta: "+2 pts vs prior",
    activePatients: 312, activeDelta: "+18% vs prior",
    vscOrders: 13, ftOrders: 5,
  },
  "30d": {
    orders: 74, ordersDelta: "+19% vs prior",
    approved: 65, approvedPct: 88, approvedDelta: "+2 pts vs prior",
    avgTime: 3.3, avgTimeDelta: "-0.5h vs prior", avgTimeTarget: "SLA target 54h · 97% within",
    reorderRate: 69, reorderDelta: "+3 pts vs prior",
    activePatients: 312, activeDelta: "+18% vs prior",
    vscOrders: 52, ftOrders: 22,
  },
  "90d": {
    orders: 218, ordersDelta: "+24% vs prior",
    approved: 189, approvedPct: 87, approvedDelta: "+3 pts vs prior",
    avgTime: 3.4, avgTimeDelta: "-0.7h vs prior", avgTimeTarget: "SLA target 54h · 96% within",
    reorderRate: 68, reorderDelta: "+4 pts vs prior",
    activePatients: 312, activeDelta: "+18% vs prior",
    vscOrders: 174, ftOrders: 44,
  },
  "ytd": {
    orders: 341, ordersDelta: "+22% vs prior",
    approved: 297, approvedPct: 87, approvedDelta: "+3 pts vs prior",
    avgTime: 3.6, avgTimeDelta: "-0.5h vs prior", avgTimeTarget: "SLA target 54h · 95% within",
    reorderRate: 65, reorderDelta: "+5 pts vs prior",
    activePatients: 312, activeDelta: "+18% vs prior",
    vscOrders: 268, ftOrders: 73,
  },
};

const WINDOW_LABELS: Record<Range, string> = {
  "7d": "06 May 2026 → 13 May 2026",
  "30d": "14 Apr 2026 → 13 May 2026",
  "90d": "06 Feb 2026 → 06 May 2026",
  "ytd": "01 Jan 2026 → 06 May 2026",
};

// ── Trend chart data ──────────────────────────────────────────────────────────

const VSC_TREND = [14, 15, 15, 14, 17, 16, 17, 18, 19, 18, 17, 17, 18];
const FT_TREND  = [2,  3,  3,  4,  5,  5,  6,  7,  7,  8,  8,  9,  9];
const WEEK_LABELS = [
  "06 Feb", "", "20 Feb", "", "06 Mar", "", "20 Mar", "", "03 Apr", "", "17 Apr", "", "06 May",
];

const CHART_W = 800, CHART_H = 140, PAD_X = 8, PAD_Y = 12, MAX_Y = 22;

function makeLinePath(data: number[]): string {
  return data
    .map((v, i) => {
      const x = PAD_X + (i / (data.length - 1)) * (CHART_W - PAD_X * 2);
      const y = PAD_Y + (1 - v / MAX_Y) * (CHART_H - PAD_Y * 2);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function toChartY(v: number): number {
  return PAD_Y + (1 - v / MAX_Y) * (CHART_H - PAD_Y * 2);
}

function toChartX(i: number, len: number): number {
  return PAD_X + (i / (len - 1)) * (CHART_W - PAD_X * 2);
}

// ── Conversion funnel ─────────────────────────────────────────────────────────

const FUNNEL = [
  { label: "Order placed",           sub: "Patient submits via app",      count: 218, pct: 100 },
  { label: "Identity verified",      sub: "SumSub passed",                count: 211, pct: 97  },
  { label: "Reached Clinical Check", sub: "Awaiting prescriber review",   count: 205, pct: 97  },
  { label: "Approved",               sub: "Prescriber decision: yes",     count: 189, pct: 92  },
  { label: "Dispatched",             sub: "Primed fulfilled",              count: 187, pct: 90  },
];

// ── Delta badge ───────────────────────────────────────────────────────────────

function Delta({ text }: { text: string }) {
  const isUp    = text.startsWith("+");
  const isDown  = text.startsWith("-") || text.startsWith("↓");
  return (
    <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${isUp ? "text-ok" : isDown ? "text-err" : "text-t3"}`}>
      {isUp   ? <TrendingUp className="w-3 h-3" />   :
       isDown ? <TrendingDown className="w-3 h-3" /> :
                <Minus className="w-3 h-3" />}
      {text}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function KpiDashboardView() {
  const [range, setRange]   = useState<Range>("90d");
  const [clinic, setClinic] = useState<ClinicFilter>("both");

  const m = DATA[range];

  const totalsByClinic = clinic === "vsc"
    ? { orders: m.vscOrders, mounjaro: Math.round(m.vscOrders * 0.58), wegovy: Math.round(m.vscOrders * 0.42) }
    : clinic === "feeltru"
    ? { orders: m.ftOrders,  mounjaro: Math.round(m.ftOrders  * 0.72), wegovy: Math.round(m.ftOrders  * 0.28) }
    : { orders: m.approved,  mounjaro: Math.round(m.approved  * 0.61), wegovy: Math.round(m.approved  * 0.39) };

  const mounjPct = Math.round((totalsByClinic.mounjaro / totalsByClinic.orders) * 100);
  const wegovPct = 100 - mounjPct;

  return (
    <div className="p-6 space-y-6">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Range */}
        <div className="flex items-center bg-page-bg border border-bdr rounded-lg p-0.5 gap-0.5">
          {(["7d", "30d", "90d", "ytd"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
                range === r ? "bg-brand text-white" : "text-t2 hover:text-t1"
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Clinic */}
        <div className="flex items-center bg-page-bg border border-bdr rounded-lg p-0.5 gap-0.5">
          {(["both", "vsc", "feeltru"] as ClinicFilter[]).map((c) => (
            <button
              key={c}
              onClick={() => setClinic(c)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors capitalize ${
                clinic === c ? "bg-brand text-white" : "text-t2 hover:text-t1"
              }`}
            >
              {c === "both" ? "Both" : c === "vsc" ? "VSC" : "FeelTru"}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-t3 ml-2">
          Window: {WINDOW_LABELS[range]} · last refresh 14:38
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-bdr text-[12px] font-semibold text-t2 hover:bg-page-bg transition-colors">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-bdr text-[12px] font-semibold text-t2 hover:bg-page-bg transition-colors">
            <FileDown className="w-3.5 h-3.5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* ── 5 Metric cards ── */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard
          label="Orders placed"
          value={m.orders.toString()}
          sub={`VSC ${m.vscOrders} · FeelTru ${m.ftOrders}`}
          delta={m.ordersDelta}
        />
        <MetricCard
          label="Approved"
          value={m.approved.toString()}
          sub={`17 declined · 12 expired`}
          delta={m.approvedDelta}
          badge={`${m.approvedPct}%`}
        />
        <MetricCard
          label="Avg time to approval"
          value={`${m.avgTime} h`}
          sub={m.avgTimeTarget}
          delta={m.avgTimeDelta}
          deltaDown
        />
        <MetricCard
          label="Reorder rate"
          value={`${m.reorderRate}%`}
          sub="First-order patients reordering at week 4+"
          delta={m.reorderDelta}
        />
        <MetricCard
          label="Active patients"
          value={m.activePatients.toString()}
          sub="On treatment · across both clinics"
          delta={m.activeDelta}
        />
      </div>

      {/* ── Trend chart ── */}
      <div className="bg-surface border border-bdr rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[13px] font-bold text-t1">Orders placed · 13-week trend</span>
            <span className="text-[11px] text-t3 ml-3">Weekly · split by VSC vs FeelTru</span>
          </div>
          <span className="text-[11px] text-t3">Total this period: {m.orders} orders</span>
        </div>

        {/* Y-axis gridlines + SVG */}
        <div className="relative">
          {/* Y labels */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-t3 pr-2 pointer-events-none" style={{ width: 28 }}>
            {[20, 15, 10, 5].map((v) => (
              <span key={v} className="tabular-nums">{v}</span>
            ))}
          </div>

          <div className="ml-7">
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-36" preserveAspectRatio="none">
              {/* Grid lines */}
              {[5, 10, 15, 20].map((v) => (
                <line
                  key={v}
                  x1={0} x2={CHART_W}
                  y1={toChartY(v)} y2={toChartY(v)}
                  stroke="#e5e7eb" strokeWidth="1"
                />
              ))}
              {/* VSC line */}
              <path d={makeLinePath(VSC_TREND)} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {/* FeelTru line */}
              <path d={makeLinePath(FT_TREND)} fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Last data point dots */}
              <circle cx={toChartX(12, 13)} cy={toChartY(VSC_TREND[12])} r="4" fill="#4f46e5" />
              <circle cx={toChartX(12, 13)} cy={toChartY(FT_TREND[12])} r="4" fill="#a78bfa" />
            </svg>

            {/* X-axis labels */}
            <div className="flex justify-between mt-1 text-[10px] text-t3">
              {WEEK_LABELS.filter((_, i) => i % 2 === 0).map((l, i) => (
                <span key={i}>{l}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mt-3 text-[11px] text-t3">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-[#4f46e5] rounded inline-block" />
            VSC orders/week
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-[#a78bfa] rounded inline-block" />
            FeelTru orders/week
          </span>
          <span className="ml-auto italic">FeelTru ramping post-relaunch · VSC stable around 17/week</span>
        </div>
      </div>

      {/* ── Bottom row: Funnel + Treatment mix ── */}
      <div className="grid grid-cols-5 gap-4">

        {/* Conversion funnel */}
        <div className="col-span-3 bg-surface border border-bdr rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] font-bold text-t1">Order conversion funnel</span>
            <span className="text-[11px] text-t3">Last 90 days · % of stage above</span>
          </div>
          <div className="space-y-3">
            {FUNNEL.map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <div className="w-44 shrink-0">
                  <p className="text-[12px] font-semibold text-t1 leading-tight">{row.label}</p>
                  <p className="text-[10.5px] text-t3">{row.sub}</p>
                </div>
                <div className="flex-1 bg-page-bg rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all"
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[12px] font-bold text-t1 tabular-nums">{row.count}</span>
                <span className="w-10 text-right text-[12px] font-semibold text-brand tabular-nums">{row.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Treatment mix donut */}
        <div className="col-span-2 bg-surface border border-bdr rounded-xl p-5">
          <div className="mb-4">
            <span className="text-[13px] font-bold text-t1">Treatment mix</span>
            <span className="text-[11px] text-t3 ml-2">{totalsByClinic.orders} approved · {range}</span>
          </div>

          <div className="flex items-center gap-6">
            {/* Donut */}
            <div className="relative shrink-0" style={{ width: 130, height: 130 }}>
              <div
                className="w-full h-full rounded-full"
                style={{
                  background: `conic-gradient(#4f46e5 0% ${mounjPct}%, #c4b5fd ${mounjPct}% 100%)`,
                }}
              />
              <div className="absolute inset-[22px] rounded-full bg-surface flex flex-col items-center justify-center text-center">
                <span className="text-[18px] font-bold text-t1 leading-tight">{totalsByClinic.orders}</span>
                <span className="text-[9px] text-t3 uppercase tracking-wide leading-tight">Approved</span>
                <span className="text-[9px] text-t3 uppercase tracking-wide leading-tight">{range}</span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="w-3 h-3 rounded-sm bg-[#4f46e5] shrink-0" />
                  <span className="text-[12px] font-semibold text-t1">Mounjaro (Tirzepatide)</span>
                </div>
                <p className="text-[11px] text-t3 pl-5">
                  {totalsByClinic.mounjaro} · {mounjPct}%
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="w-3 h-3 rounded-sm bg-[#c4b5fd] shrink-0" />
                  <span className="text-[12px] font-semibold text-t1">Wegovy (Semaglutide)</span>
                </div>
                <p className="text-[11px] text-t3 pl-5">
                  {totalsByClinic.wegovy} · {wegovPct}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MetricCard ─────────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, delta, badge, deltaDown,
}: {
  label: string; value: string; sub: string; delta: string; badge?: string; deltaDown?: boolean;
}) {
  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <p className="text-[10.5px] font-bold text-t3 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[26px] font-bold text-t1 leading-none tabular-nums">{value}</span>
        {badge && (
          <span className="text-[13px] font-semibold text-t2 tabular-nums">· {badge}</span>
        )}
      </div>
      <p className="text-[10.5px] text-t3 leading-tight mb-2">{sub}</p>
      <Delta text={delta} />
    </div>
  );
}
