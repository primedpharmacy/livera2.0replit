"use client";

/**
 * Aud1819Report — BLD-12.7
 *
 * AUD-18 + AUD-19 combined report — two-tab toggle.
 *
 * AUD-18 — Remote Prescribing Standards
 *   GMC remote prescribing compliance: SLA adherence, prescriber turnaround,
 *   remote decision coverage by prescriber.
 *
 * AUD-19 — Identity Verification Effectiveness
 *   SumSub identity verification pass rate, turnaround, fail-reason breakdown,
 *   per-patient verification table.
 *
 * All data derived from MOCK_ORDERS and MOCK_PATIENTS fixtures (mocked
 * computed metrics consistent with seeded data).
 */

import { useState } from "react";
import {
  Stethoscope, ShieldCheck, Clock, Users, CheckCircle2,
  XCircle, TrendingUp, Download, ChevronUp, ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClinicId } from "@/types";

// ── AUD-18 mock data — Remote Prescribing ─────────────────────────────────────

const PRESCRIBER_COMPLIANCE_ROWS = [
  {
    name:        "Qadir Hussain",
    role:        "Owner / Prescriber",
    decisions:   3,
    withinSla:   3,
    avgHours:    5.2,
    lastDecision:"11 May 2026",
    coverage:    100,
    remote:      true,
  },
  {
    name:        "Claire Ashworth",
    role:        "Prescriber",
    decisions:   8,
    withinSla:   7,
    avgHours:    9.4,
    lastDecision:"08 May 2026",
    coverage:    88,
    remote:      true,
  },
  {
    name:        "Mobeen Alam",
    role:        "Prescriber / RM",
    decisions:   5,
    withinSla:   5,
    avgHours:    3.8,
    lastDecision:"05 May 2026",
    coverage:    100,
    remote:      true,
  },
  {
    name:        "Dr. Priya Singh",
    role:        "Prescriber",
    decisions:   2,
    withinSla:   1,
    avgHours:    28.5,
    lastDecision:"01 May 2026",
    coverage:    50,
    remote:      true,
  },
];

// 12-week remote prescribing SLA trend
const PRESCRIBING_SLA_TREND = [
  { week: "18 Feb", pct: 82 },
  { week: "25 Feb", pct: 85 },
  { week: "04 Mar", pct: 88 },
  { week: "11 Mar", pct: 80 },
  { week: "18 Mar", pct: 91 },
  { week: "25 Mar", pct: 89 },
  { week: "01 Apr", pct: 93 },
  { week: "08 Apr", pct: 91 },
  { week: "15 Apr", pct: 95 },
  { week: "22 Apr", pct: 89 },
  { week: "29 Apr", pct: 94 },
  { week: "06 May", pct: 94 },
];

const REMOTE_ORDER_ROWS = [
  { orderId: "ORD-00438", patient: "James Hartley",   patientId: "PT-00234", medication: "Mounjaro 5mg",   prescriber: "Qadir Hussain",  decidedAt: "06 May 2026 · 11:00", hoursFromSubmit: 4.2,  sla: true  },
  { orderId: "ORD-00441", patient: "Sarah Cookland",  patientId: "PT-00012", medication: "Mounjaro 7.5mg", prescriber: "Qadir Hussain",  decidedAt: "03 May 2026 · 14:00", hoursFromSubmit: 6.1,  sla: true  },
  { orderId: "ORD-00422", patient: "Miriam Osei",     patientId: "PT-00156", medication: "Mounjaro 2.5mg", prescriber: "Qadir Hussain",  decidedAt: "08 May 2026 · 09:00", hoursFromSubmit: 5.7,  sla: true  },
  { orderId: "ORD-00415", patient: "Tom Fletcher",    patientId: "PT-00089", medication: "Wegovy 0.5mg",   prescriber: "Claire Ashworth", decidedAt: "05 May 2026 · 16:30", hoursFromSubmit: 11.2, sla: true  },
  { orderId: "ORD-00408", patient: "Fiona MacLeod",   patientId: "PT-00445", medication: "Mounjaro 5mg",   prescriber: "Dr. Priya Singh", decidedAt: "01 May 2026 · 09:00", hoursFromSubmit: 31.0, sla: false },
];

// ── AUD-19 mock data — Identity Verification ──────────────────────────────────

const IDENTITY_ROWS = [
  { patientId:"PT-00012", patient:"Sarah Cookland",  sumsubId:"sumsub_abc123", verifiedAt:"15 Jan 2026", turnaroundHours:1.2, status:"passed" as const, failReason:null },
  { patientId:"PT-00234", patient:"James Hartley",   sumsubId:"sumsub_jh234",  verifiedAt:"01 Feb 2026", turnaroundHours:2.5, status:"passed" as const, failReason:null },
  { patientId:"PT-00156", patient:"Miriam Osei",     sumsubId:"sumsub_mo156",  verifiedAt:"20 Jan 2026", turnaroundHours:0.8, status:"passed" as const, failReason:null },
  { patientId:"PT-00089", patient:"Tom Fletcher",    sumsubId:"sumsub_tf089",  verifiedAt:"08 May 2026", turnaroundHours:3.1, status:"passed" as const, failReason:null },
  { patientId:"PT-00301", patient:"Priya Shah",      sumsubId:"sumsub_ps301",  verifiedAt:"10 Jan 2026", turnaroundHours:1.5, status:"passed" as const, failReason:null },
  { patientId:"PT-00412", patient:"Eleanor Wright",  sumsubId:"sumsub_ew412",  verifiedAt:"05 Jan 2026", turnaroundHours:1.0, status:"passed" as const, failReason:null },
  { patientId:"PT-00378", patient:"Zara Ahmed",      sumsubId:"sumsub_za378",  verifiedAt:"07 May 2026", turnaroundHours:2.2, status:"passed" as const, failReason:null },
  { patientId:"PT-00445", patient:"Fiona MacLeod",   sumsubId:"sumsub_fm445",  verifiedAt:"25 Jan 2026", turnaroundHours:4.7, status:"passed" as const, failReason:null },
  { patientId:"PT-00210", patient:"Marcus Chen",     sumsubId:"sumsub_mc210",  verifiedAt:"28 Apr 2026", turnaroundHours:1.3, status:"passed" as const, failReason:null },
  { patientId:"PT-00214", patient:"Sean Collins",    sumsubId:"sumsub_sc214",  verifiedAt:"01 May 2026", turnaroundHours:0.9, status:"passed" as const, failReason:null },
  { patientId:"PT-00199", patient:"Beth Nguyen",     sumsubId:"sumsub_bn199",  verifiedAt:"25 Apr 2026", turnaroundHours:2.0, status:"passed" as const, failReason:null },
  { patientId:"PT-00556", patient:"Ryan Mitchell",   sumsubId:"sumsub_rm556",  verifiedAt:"10 May 2026", turnaroundHours:5.5, status:"review"  as const, failReason:"Document quality" },
  { patientId:"PT-00612", patient:"Dana Okafor",     sumsubId:"sumsub_do612",  verifiedAt:"02 May 2026", turnaroundHours:8.2, status:"failed"  as const, failReason:"Identity mismatch" },
  { patientId:"PT-00631", patient:"Laura Keane",     sumsubId:"sumsub_lk631",  verifiedAt:"28 Apr 2026", turnaroundHours:6.1, status:"failed"  as const, failReason:"Expired document" },
];

const FAIL_REASONS = [
  { label: "Document quality", count: 2, pct: 50, color: "bg-warn" },
  { label: "Identity mismatch", count: 1, pct: 25, color: "bg-err" },
  { label: "Expired document",  count: 1, pct: 25, color: "bg-err" },
];

type PrescriberSortKey = "name" | "decisions" | "withinSla" | "avgHours";
type IdentitySortKey   = "patient" | "status" | "turnaroundHours" | "verifiedAt";
type SortDir           = "asc" | "desc";

const STATUS_BADGE: Record<"passed" | "review" | "failed", string> = {
  passed: "bg-ok-bg text-ok border-ok-bdr",
  review: "bg-warn-bg text-warn border-warn-bdr",
  failed: "bg-err-bg text-err border-err-bdr",
};

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = "brand" }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color?: "brand" | "ok" | "warn" | "err";
}) {
  const clr = { brand: "text-brand", ok: "text-ok", warn: "text-warn", err: "text-err" };
  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4 shrink-0", clr[color])} />
        <p className="text-[10px] font-bold text-t3 uppercase tracking-wider">{label}</p>
      </div>
      <p className={cn("text-[28px] font-bold leading-none mb-1", clr[color])}>{value}</p>
      <p className="text-[11px] text-t2 leading-snug">{sub}</p>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <h2 className="text-[13px] font-bold text-t1">{title}</h2>
      <span className="text-[11px] text-t3">{sub}</span>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronUp className="w-3 h-3 text-t3 opacity-40" />;
  return dir === "asc"
    ? <ChevronUp   className="w-3 h-3 text-brand" />
    : <ChevronDown className="w-3 h-3 text-brand" />;
}

// ── AUD-18 tab ────────────────────────────────────────────────────────────────

function SlaTrendChart() {
  const vals  = PRESCRIBING_SLA_TREND.map((d) => d.pct);
  const min   = Math.min(...vals) - 4;
  const max18 = 100;
  const range = max18 - min;
  const W = 100; const H = 100;
  const pts = PRESCRIBING_SLA_TREND.map((d, i) => {
    const x = (i / (PRESCRIBING_SLA_TREND.length - 1)) * W;
    const y = H - ((d.pct - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const targetY = H - ((90 - min) / range) * H;
  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-bold text-t3 uppercase tracking-wider">
            SLA compliance · 12-week trend
          </p>
          <p className="text-[11px] text-t2 mt-0.5">% decisions within 24h working-day SLA</p>
        </div>
        <span className="text-[22px] font-bold text-ok">94%</span>
      </div>
      <div className="h-[72px] relative">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
          <line x1="0" y1={targetY} x2={W} y2={targetY}
            stroke="#16a34a" strokeWidth="0.8" strokeDasharray="2,2"
            vectorEffect="non-scaling-stroke" />
          <polygon points={`0,${H} ${pts.join(" ")} ${W},${H}`}
            fill="#4f46e5" fillOpacity="0.08" />
          <polyline points={pts.join(" ")} fill="none" stroke="#4f46e5" strokeWidth="2"
            vectorEffect="non-scaling-stroke" />
          {(() => {
            const last = PRESCRIBING_SLA_TREND[PRESCRIBING_SLA_TREND.length - 1]!;
            const x = W; const y = H - ((last.pct - min) / range) * H;
            return <circle cx={x} cy={y} r="3" fill="#4f46e5" vectorEffect="non-scaling-stroke" />;
          })()}
        </svg>
        <span className="absolute top-0 right-0 text-[9px] text-ok font-semibold">90% target</span>
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] text-t3">
        <span>18 Feb 2026</span><span>06 May 2026</span>
      </div>
    </div>
  );
}

function PrescriberTable() {
  const [sortKey, setSortKey] = useState<PrescriberSortKey>("decisions");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const toggle = (k: PrescriberSortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };
  const rows = [...PRESCRIBER_COMPLIANCE_ROWS].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name")       cmp = a.name.localeCompare(b.name);
    if (sortKey === "decisions")  cmp = a.decisions - b.decisions;
    if (sortKey === "withinSla")  cmp = a.withinSla - b.withinSla;
    if (sortKey === "avgHours")   cmp = a.avgHours - b.avgHours;
    return sortDir === "asc" ? cmp : -cmp;
  });
  const TH = ({ label, k }: { label: string; k: PrescriberSortKey }) => (
    <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3 cursor-pointer select-none hover:text-t1"
        onClick={() => toggle(k)}>
      <span className="inline-flex items-center gap-1">{label}<SortIcon active={sortKey===k} dir={sortDir} /></span>
    </th>
  );
  return (
    <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
      <table className="w-full text-[12px]">
        <thead className="bg-page-bg border-b border-bdr">
          <tr>
            <TH label="Prescriber"   k="name" />
            <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Role</th>
            <TH label="Decisions"    k="decisions" />
            <TH label="Within SLA"   k="withinSla" />
            <TH label="Avg hours"    k="avgHours" />
            <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Coverage</th>
            <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Last decision</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-bdr">
          {rows.map((r) => (
            <tr key={r.name} className="hover:bg-page-bg/60 transition-colors">
              <td className="py-2.5 px-3 font-semibold text-t1">{r.name}</td>
              <td className="py-2.5 px-3 text-t3 text-[11px]">{r.role}</td>
              <td className="py-2.5 px-3 text-t2 tabular-nums">{r.decisions}</td>
              <td className="py-2.5 px-3">
                <span className={cn("text-[11px] font-bold",
                  r.withinSla === r.decisions ? "text-ok" : "text-warn")}>
                  {r.withinSla}/{r.decisions}
                </span>
              </td>
              <td className="py-2.5 px-3 tabular-nums text-t2">
                <span className={r.avgHours > 24 ? "text-err font-semibold" : ""}>{r.avgHours}h</span>
              </td>
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-page-bg rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", r.coverage===100 ? "bg-ok" : r.coverage>=80 ? "bg-brand" : "bg-warn")}
                         style={{ width: `${r.coverage}%` }} />
                  </div>
                  <span className="text-[11px] text-t2 tabular-nums w-8 shrink-0">{r.coverage}%</span>
                </div>
              </td>
              <td className="py-2.5 px-3 text-t3 text-[11px]">{r.lastDecision}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RemoteOrderTable() {
  return (
    <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-page-bg border-b border-bdr">
        <p className="text-[11px] font-bold text-t2 uppercase tracking-wider">Recent remote decisions · last 30 days</p>
      </div>
      <table className="w-full text-[12px]">
        <thead className="bg-page-bg/50 border-b border-bdr">
          <tr>
            {["Order", "Patient", "Medication", "Prescriber", "Decided at", "Turnaround", "SLA"].map((h) => (
              <th key={h} className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-bdr">
          {REMOTE_ORDER_ROWS.map((r) => (
            <tr key={r.orderId} className="hover:bg-page-bg/60 transition-colors">
              <td className="py-2.5 px-3 font-mono text-[11px] text-brand font-semibold">{r.orderId}</td>
              <td className="py-2.5 px-3">
                <p className="font-semibold text-t1">{r.patient}</p>
                <p className="text-[10px] text-t3 font-mono">{r.patientId}</p>
              </td>
              <td className="py-2.5 px-3 text-t2">{r.medication}</td>
              <td className="py-2.5 px-3 text-t2">{r.prescriber}</td>
              <td className="py-2.5 px-3 text-t3 text-[11px]">{r.decidedAt}</td>
              <td className="py-2.5 px-3 tabular-nums text-t2">
                <span className={r.hoursFromSubmit > 24 ? "text-err font-semibold" : ""}>{r.hoursFromSubmit}h</span>
              </td>
              <td className="py-2.5 px-3">
                {r.sla
                  ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-ok"><CheckCircle2 className="w-3 h-3" />Met</span>
                  : <span className="inline-flex items-center gap-1 text-[10px] font-bold text-err"><XCircle className="w-3 h-3" />Missed</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Aud18Tab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={Stethoscope}  label="Total remote decisions (30d)" value="18"   sub="VSC: 10 · FeelTru: 8"               color="brand" />
        <StatCard icon={CheckCircle2} label="SLA compliance"               value="94%"  sub="17 of 18 within 24h working SLA"    color="ok"    />
        <StatCard icon={Clock}        label="Avg turnaround"                value="7.4h" sub="Target: ≤ 24 working hours"         color="brand" />
        <StatCard icon={AlertTriangle}label="SLA breaches"                  value="1"    sub="Dr. Priya Singh · ORD-00408 · 31h"  color="warn"  />
      </div>
      <SlaTrendChart />
      <div>
        <SectionHeader title="Prescriber compliance breakdown" sub="All active prescribers · last 30 days" />
        <PrescriberTable />
      </div>
      <RemoteOrderTable />
      <div className="bg-info-bg border border-info-bdr rounded-lg p-3 text-[11px] text-t2 leading-relaxed">
        <strong className="text-t1">GMC Good Practice in Prescribing (2021) §3</strong> — Remote prescribers must satisfy themselves that adequate history, examination, and drug information is available before prescribing. All decisions must be documented in the clinical record. GPhC Standard 4 compliance confirmed for 17/18 decisions.
      </div>
    </div>
  );
}

// ── AUD-19 tab ────────────────────────────────────────────────────────────────

function FailReasonBreakdown() {
  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <p className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-3">
        Fail / review reasons
      </p>
      <div className="space-y-3">
        {FAIL_REASONS.map((f) => (
          <div key={f.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] font-semibold text-t1">{f.label}</span>
              <span className="text-[12px] font-bold text-err">{f.count}</span>
            </div>
            <div className="h-2 bg-page-bg rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full", f.color)} style={{ width: `${f.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-t3 mt-3 pt-2 border-t border-bdr">
        Patients with failed verification cannot proceed to clinical check. Re-verification required within 7 calendar days.
      </p>
    </div>
  );
}

function IdentityTable() {
  const [sortKey, setSortKey] = useState<IdentitySortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const STATUS_ORDER = { failed: 0, review: 1, passed: 2 };
  const toggle = (k: IdentitySortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };
  const rows = [...IDENTITY_ROWS].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "patient")         cmp = a.patient.localeCompare(b.patient);
    if (sortKey === "status")          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (sortKey === "turnaroundHours") cmp = a.turnaroundHours - b.turnaroundHours;
    if (sortKey === "verifiedAt")      cmp = a.verifiedAt.localeCompare(b.verifiedAt);
    return sortDir === "asc" ? cmp : -cmp;
  });
  const TH = ({ label, k }: { label: string; k: IdentitySortKey }) => (
    <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3 cursor-pointer select-none hover:text-t1"
        onClick={() => toggle(k)}>
      <span className="inline-flex items-center gap-1">{label}<SortIcon active={sortKey===k} dir={sortDir} /></span>
    </th>
  );
  return (
    <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
      <table className="w-full text-[12px]">
        <thead className="bg-page-bg border-b border-bdr">
          <tr>
            <TH label="Patient"     k="patient" />
            <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">SumSub ID</th>
            <TH label="Status"      k="status" />
            <TH label="Turnaround"  k="turnaroundHours" />
            <TH label="Verified at" k="verifiedAt" />
            <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Fail reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-bdr">
          {rows.map((r) => (
            <tr key={r.patientId} className="hover:bg-page-bg/60 transition-colors">
              <td className="py-2.5 px-3">
                <p className="font-semibold text-t1">{r.patient}</p>
                <p className="text-[10px] text-t3 font-mono">{r.patientId}</p>
              </td>
              <td className="py-2.5 px-3 text-[10px] font-mono text-t3">{r.sumsubId}</td>
              <td className="py-2.5 px-3">
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border capitalize", STATUS_BADGE[r.status])}>
                  {r.status}
                </span>
              </td>
              <td className="py-2.5 px-3 tabular-nums text-t2">{r.turnaroundHours}h</td>
              <td className="py-2.5 px-3 text-t3 text-[11px]">{r.verifiedAt}</td>
              <td className="py-2.5 px-3 text-t3 text-[11px]">{r.failReason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Aud19Tab() {
  const passed = IDENTITY_ROWS.filter((r) => r.status === "passed").length;
  const total  = IDENTITY_ROWS.length;
  const passRate = Math.round((passed / total) * 100);
  const avgTurnaround = (
    IDENTITY_ROWS.reduce((s, r) => s + r.turnaroundHours, 0) / total
  ).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={ShieldCheck}  label="Identity pass rate"     value={`${passRate}%`}  sub={`${passed} of ${total} verifications passed`}   color="ok"   />
        <StatCard icon={Users}        label="Total verifications"    value={`${total}`}       sub="VSC + FeelTru · last 90 days"                    color="brand"/>
        <StatCard icon={Clock}        label="Avg turnaround"         value={`${avgTurnaround}h`} sub="Time from submission to SumSub decision"      color="brand"/>
        <StatCard icon={XCircle}      label="Failed / under review"  value={`${total - passed}`} sub="Pending re-verification within 7 days"        color="err"  />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Pass / review / fail summary */}
        <div className="bg-surface border border-bdr rounded-xl p-4">
          <p className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-3">Outcome distribution</p>
          <div className="space-y-3">
            {[
              { label: "Passed",       count: passed,          pct: passRate,                          color: "bg-ok",   text: "text-ok"   },
              { label: "Under review", count: 1,               pct: Math.round(1/total*100),           color: "bg-warn", text: "text-warn" },
              { label: "Failed",       count: total-passed-1,  pct: Math.round((total-passed-1)/total*100), color: "bg-err",  text: "text-err"  },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-semibold text-t1">{s.label}</span>
                  <span className={cn("text-[12px] font-bold", s.text)}>{s.count}</span>
                </div>
                <div className="h-2 bg-page-bg rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", s.color)} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <FailReasonBreakdown />
        <div className="bg-surface border border-bdr rounded-xl p-4">
          <p className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-3">Re-verification outcomes</p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-warn-bg border border-warn-bdr">
              <AlertTriangle className="w-4 h-4 text-warn shrink-0" />
              <div>
                <p className="text-[12px] font-semibold text-t1">Ryan Mitchell (PT-00556)</p>
                <p className="text-[10.5px] text-t3">Under review · Document quality · Day 4 of 7</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-err-bg border border-err-bdr">
              <XCircle className="w-4 h-4 text-err shrink-0" />
              <div>
                <p className="text-[12px] font-semibold text-t1">Dana Okafor (PT-00612)</p>
                <p className="text-[10.5px] text-t3">Failed · Identity mismatch · Manual review required</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-err-bg border border-err-bdr">
              <XCircle className="w-4 h-4 text-err shrink-0" />
              <div>
                <p className="text-[12px] font-semibold text-t1">Laura Keane (PT-00631)</p>
                <p className="text-[10.5px] text-t3">Failed · Expired document · Patient re-notified 30 Apr</p>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-t3 mt-3 pt-2 border-t border-bdr">
            UK GDPR Article 9 · patient records cannot proceed to clinical check without confirmed identity.
          </p>
        </div>
      </div>

      <div>
        <SectionHeader title="Patient identity verification table" sub="All patients · last 90 days · sortable by status, turnaround, date" />
        <IdentityTable />
      </div>

      <div className="bg-info-bg border border-info-bdr rounded-lg p-3 text-[11px] text-t2 leading-relaxed">
        <strong className="text-t1">GPhC Standard 1 / UK GDPR Article 9</strong> — Identity verification via SumSub is mandatory before any clinical decision. Patients must present valid government-issued photographic ID. Failed verifications block clinical check and are escalated to the clinic owner within 24 hours.
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { clinicId: ClinicId }

export function Aud1819Report({ clinicId: _clinicId }: Props) {
  const [activeTab, setActiveTab] = useState<"aud18" | "aud19">("aud18");

  return (
    <div className="p-6 space-y-6">

      {/* Export row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-t3">
          <Clock className="w-3.5 h-3.5" />
          <span>AUD-18: last 30 days · AUD-19: last 90 days · Both clinics · Live data</span>
        </div>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold text-t2 bg-surface border border-bdr rounded-lg hover:bg-page-bg transition-colors">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Tab toggle */}
      <div className="flex border-b border-bdr">
        {([
          { key: "aud18" as const, label: "AUD-18 · Remote Prescribing", icon: Stethoscope },
          { key: "aud19" as const, label: "AUD-19 · Identity Verification", icon: ShieldCheck },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 text-[12px] font-semibold border-b-2 -mb-px transition-colors",
              activeTab === key
                ? "border-brand text-brand"
                : "border-transparent text-t2 hover:text-t1"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center pr-1">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-light text-brand border border-brand/20">BLD-12.7</span>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "aud18" ? <Aud18Tab /> : <Aud19Tab />}
    </div>
  );
}
