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
import { MOCK_ORDERS, MOCK_PATIENTS } from "@/lib/api/mock";
import { USERS_REGISTRY } from "@/lib/users/registry";

// ── Derived metrics from MOCK_ORDERS / MOCK_PATIENTS ─────────────────────────
// Headline figures (decision counts, SumSub pass rate, per-patient ages) are
// recomputed from the seeded fixture arrays so any fixture change flows in.

const NOW_MS_1819 = Date.UTC(2026, 4, 13);  // 13 May 2026 — report "as-of" date
function patientAge(dob: string): number {
  const birth = Date.parse(dob);
  if (Number.isNaN(birth)) return 0;
  // Floor of years between dob and the report "as-of" date.
  return Math.max(0, Math.floor((NOW_MS_1819 - birth) / (365.25 * 86_400_000)));
}
function fmtUkDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
// Tiny deterministic hash → stable mock turnaround hours per patient,
// derived from the seed `sumsub_id` so the same fixture always yields
// the same value across renders.
function stableHours(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return +(0.5 + (h % 80) / 10).toFixed(1);  // 0.5h – 8.5h
}

// ── Derived AUD-18 (Remote Prescribing) data from MOCK_ORDERS ────────────────
const DERIVED_DECIDED_ORDERS = MOCK_ORDERS.filter(
  (o) => o.clinical_decision && o.clinical_decision.decided_at,
);
const DERIVED_DECISION_TOTAL = DERIVED_DECIDED_ORDERS.length;
const DERIVED_SLA_BREACHED = MOCK_ORDERS.filter(
  (o) => o.clinical_decision?.decided_at && o.sla_breach_at
    && Date.parse(o.clinical_decision.decided_at) > Date.parse(o.sla_breach_at),
).length;
const DERIVED_SLA_MET = Math.max(0, DERIVED_DECISION_TOTAL - DERIVED_SLA_BREACHED);
const DERIVED_SLA_PCT = DERIVED_DECISION_TOTAL > 0
  ? Math.round((DERIVED_SLA_MET / DERIVED_DECISION_TOTAL) * 100)
  : 100;
const DERIVED_VSC_DECISIONS     = DERIVED_DECIDED_ORDERS.filter((o) => o.clinic_id === "vsc").length;
const DERIVED_FEELTRU_DECISIONS = DERIVED_DECIDED_ORDERS.filter((o) => o.clinic_id === "feeltru").length;
const DERIVED_AVG_TURNAROUND_H = (() => {
  const withSubmit = DERIVED_DECIDED_ORDERS.filter((o) => o.created_at && o.clinical_decision?.decided_at);
  if (!withSubmit.length) return 0;
  const total = withSubmit.reduce((s, o) => {
    const dt = (Date.parse(o.clinical_decision!.decided_at!) - Date.parse(o.created_at)) / 3_600_000;
    return s + Math.max(0, dt);
  }, 0);
  return +(total / withSubmit.length).toFixed(1);
})();

// Map prescriber_user_id → display name from the central users registry.
function prescriberName(userId: string | null | undefined): string {
  if (!userId) return "Unknown";
  return USERS_REGISTRY[userId]?.full_name ?? userId;
}
function patientFullName(id: string): string {
  return MOCK_PATIENTS.find((p) => p.id === id)?.demographic.full_name ?? id;
}
function decisionTurnaroundHours(o: typeof MOCK_ORDERS[number]): number {
  if (!o.clinical_decision?.decided_at || !o.created_at) return 0;
  return +(Math.max(0, (Date.parse(o.clinical_decision.decided_at) - Date.parse(o.created_at)) / 3_600_000)).toFixed(1);
}
function decisionMetSla(o: typeof MOCK_ORDERS[number]): boolean {
  if (!o.clinical_decision?.decided_at) return false;
  if (!o.sla_breach_at) return true;
  return Date.parse(o.clinical_decision.decided_at) <= Date.parse(o.sla_breach_at);
}

// Recent-decisions table for AUD-18, derived from MOCK_ORDERS.
const DERIVED_REMOTE_ORDER_ROWS = DERIVED_DECIDED_ORDERS.map((o) => ({
  orderId:          o.id,
  patient:          patientFullName(o.patient_id),
  patientId:        o.patient_id,
  medication:       `${o.product.medication} ${o.product.dose}`,
  prescriber:       prescriberName(o.clinical_decision?.prescriber_user_id ?? null),
  decidedAt:        new Date(o.clinical_decision!.decided_at!).toLocaleString("en-GB", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit", timeZone: "UTC",
                    }).replace(",", " ·"),
  decidedAtIso:     o.clinical_decision!.decided_at!,
  hoursFromSubmit:  decisionTurnaroundHours(o),
  sla:              decisionMetSla(o),
}));

// Prescriber compliance, aggregated from MOCK_ORDERS by prescriber_user_id.
const DERIVED_PRESCRIBER_ROWS = (() => {
  const groups = new Map<string, typeof MOCK_ORDERS>();
  for (const o of DERIVED_DECIDED_ORDERS) {
    const pid = o.clinical_decision?.prescriber_user_id ?? "unknown";
    const arr = (groups.get(pid) ?? []) as typeof MOCK_ORDERS;
    arr.push(o);
    groups.set(pid, arr);
  }
  return Array.from(groups.entries()).map(([pid, orders]) => {
    const decisions = orders.length;
    const withinSla = orders.filter(decisionMetSla).length;
    const avgHours  = +(orders.reduce((s, o) => s + decisionTurnaroundHours(o), 0) / Math.max(1, decisions)).toFixed(1);
    const last      = orders
      .map((o) => o.clinical_decision!.decided_at!)
      .sort()
      .reverse()[0];
    const user      = USERS_REGISTRY[pid];
    return {
      name:         user?.full_name ?? pid,
      role:         (user?.roles as readonly string[] | undefined)?.includes("Owner") ? "Owner / Prescriber" : "Prescriber",
      decisions,
      withinSla,
      avgHours,
      coverage:     Math.round((withinSla / Math.max(1, decisions)) * 100),
      lastDecision: last ? new Date(last).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—",
      remote:       true,
    };
  });
})();

// ── Derived AUD-19 (Identity Verification) data from MOCK_PATIENTS ───────────
type IdentityStatus = "passed" | "review" | "failed";
type DerivedIdentityRow = {
  patientId:       string;
  patient:         string;
  sumsubId:        string;
  verifiedAt:      string;
  verifiedAtIso:   string | null;
  turnaroundHours: number;
  status:          IdentityStatus;
  failReason:      string | null;
  dob:             string;
};
const FAIL_REASON_TEXT: Record<"review" | "rejected", string> = {
  review:   "Document quality",
  rejected: "Identity mismatch",
};
const DERIVED_IDENTITY_ROWS: DerivedIdentityRow[] = MOCK_PATIENTS
  .filter((p) => p.verification?.sumsub_id)
  .map((p) => {
    const v = p.verification;
    let status: IdentityStatus = "passed";
    let failReason: string | null = null;
    if (v.sumsub_status === "review")        { status = "review"; failReason = FAIL_REASON_TEXT.review; }
    else if (v.sumsub_status === "rejected") { status = "failed"; failReason = FAIL_REASON_TEXT.rejected; }
    else if (!v.identity_verified_at)        { status = "review"; failReason = "Awaiting submission"; }
    return {
      patientId:       p.id,
      patient:         p.demographic.full_name,
      sumsubId:        v.sumsub_id,
      verifiedAt:      v.identity_verified_at ? fmtUkDate(v.identity_verified_at) : "—",
      verifiedAtIso:   v.identity_verified_at ?? null,
      turnaroundHours: stableHours(v.sumsub_id),
      status,
      failReason,
      dob:             p.demographic.dob,
    };
  });
const DERIVED_SUMSUB_TOTAL = DERIVED_IDENTITY_ROWS.length;
const DERIVED_VERIFIED     = DERIVED_IDENTITY_ROWS.filter((r) => r.status === "passed").length;
const DERIVED_REVIEW       = DERIVED_IDENTITY_ROWS.filter((r) => r.status === "review").length;
const DERIVED_REJECTED     = DERIVED_IDENTITY_ROWS.filter((r) => r.status === "failed").length;
const DERIVED_SUMSUB_PASS_PCT = DERIVED_SUMSUB_TOTAL > 0
  ? Math.round((DERIVED_VERIFIED / DERIVED_SUMSUB_TOTAL) * 100)
  : 0;
const DERIVED_AVG_VERIFY_HOURS = DERIVED_SUMSUB_TOTAL > 0
  ? +(DERIVED_IDENTITY_ROWS.reduce((s, r) => s + r.turnaroundHours, 0) / DERIVED_SUMSUB_TOTAL).toFixed(1)
  : 0;

// ── AUD-18 mock data — Remote Prescribing ─────────────────────────────────────

// Prescriber compliance now comes from DERIVED_PRESCRIBER_ROWS (computed
// from MOCK_ORDERS at the top of the file).
const PRESCRIBER_COMPLIANCE_ROWS = DERIVED_PRESCRIBER_ROWS;

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

// Recent remote-decision rows now come from DERIVED_REMOTE_ORDER_ROWS
// (computed from MOCK_ORDERS at the top of the file).
const REMOTE_ORDER_ROWS = DERIVED_REMOTE_ORDER_ROWS;

// ── AUD-19 mock data — Identity Verification ──────────────────────────────────

// Table source for AUD-19: derived directly from MOCK_PATIENTS above.
const IDENTITY_ROWS = DERIVED_IDENTITY_ROWS;

// Fail / review reason counts derived from the identity rows. Reason text
// comes from FAIL_REASON_TEXT (review vs. rejected) plus an explicit bucket
// for patients still awaiting submission.
const FAIL_REASONS = (() => {
  const buckets = new Map<string, { count: number; color: string }>();
  const palette: Record<string, string> = {
    "Document quality":   "bg-warn",
    "Identity mismatch":  "bg-err",
    "Awaiting submission":"bg-info",
  };
  for (const r of DERIVED_IDENTITY_ROWS) {
    if (!r.failReason) continue;
    const cur = buckets.get(r.failReason) ?? { count: 0, color: palette[r.failReason] ?? "bg-err" };
    cur.count += 1;
    buckets.set(r.failReason, cur);
  }
  const total = Array.from(buckets.values()).reduce((s, b) => s + b.count, 0) || 1;
  return Array.from(buckets.entries()).map(([label, b]) => ({
    label,
    count: b.count,
    pct:   Math.round((b.count / total) * 100),
    color: b.color,
  }));
})();

type PrescriberSortKey = "name" | "decisions" | "withinSla" | "avgHours";
type IdentitySortKey   = "patient" | "age" | "status" | "turnaroundHours" | "verifiedAt";
type RemoteOrderSortKey = "orderId" | "patient" | "prescriber" | "decidedAt" | "hoursFromSubmit" | "sla";
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
        <span className={cn("text-[22px] font-bold", DERIVED_SLA_PCT >= 90 ? "text-ok" : "text-warn")}>
          {DERIVED_SLA_PCT}%
        </span>
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

function SlaMetMissedBar() {
  const total  = REMOTE_ORDER_ROWS.length;
  const met    = REMOTE_ORDER_ROWS.filter((r) => r.sla).length;
  const missed = total - met;
  const metPct    = Math.round((met    / Math.max(1, total)) * 100);
  const missedPct = 100 - metPct;
  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-bold text-t3 uppercase tracking-wider">SLA met vs. missed</p>
          <p className="text-[11px] text-t2 mt-0.5">Decisions completed within 24h working-day SLA</p>
        </div>
        <span className="text-[22px] font-bold text-ok">
          {met}<span className="text-t3 text-[14px] font-normal">/{total}</span>
        </span>
      </div>
      <div className="flex h-6 w-full overflow-hidden rounded-md border border-bdr" role="img"
           aria-label={`SLA met ${met} of ${total}, missed ${missed}`}>
        <div className="bg-ok h-full flex items-center justify-center text-[10px] font-bold text-white"
             style={{ width: `${metPct}%` }}>
          {metPct >= 12 ? `Met ${metPct}%` : ""}
        </div>
        <div className="bg-err h-full flex items-center justify-center text-[10px] font-bold text-white"
             style={{ width: `${missedPct}%` }}>
          {missedPct >= 12 ? `Missed ${missedPct}%` : ""}
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 text-[10.5px] text-t2">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-ok inline-block" /> Met: {met}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-err inline-block" /> Missed: {missed}
        </span>
      </div>
    </div>
  );
}

function RemoteOrderTable() {
  const [sortKey, setSortKey] = useState<RemoteOrderSortKey>("decidedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const toggle = (k: RemoteOrderSortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };
  const rows = [...REMOTE_ORDER_ROWS].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "orderId")         cmp = a.orderId.localeCompare(b.orderId);
    if (sortKey === "patient")         cmp = a.patient.localeCompare(b.patient);
    if (sortKey === "prescriber")      cmp = a.prescriber.localeCompare(b.prescriber);
    if (sortKey === "decidedAt")       cmp = Date.parse(a.decidedAtIso) - Date.parse(b.decidedAtIso);
    if (sortKey === "hoursFromSubmit") cmp = a.hoursFromSubmit - b.hoursFromSubmit;
    if (sortKey === "sla")             cmp = Number(a.sla) - Number(b.sla);
    return sortDir === "asc" ? cmp : -cmp;
  });
  const TH = ({ label, k }: { label: string; k: RemoteOrderSortKey }) => (
    <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3 cursor-pointer select-none hover:text-t1"
        onClick={() => toggle(k)}>
      <span className="inline-flex items-center gap-1">{label}<SortIcon active={sortKey===k} dir={sortDir} /></span>
    </th>
  );
  return (
    <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-page-bg border-b border-bdr">
        <p className="text-[11px] font-bold text-t2 uppercase tracking-wider">Recent remote decisions · last 30 days · click headers to sort</p>
      </div>
      <table className="w-full text-[12px]">
        <thead className="bg-page-bg/50 border-b border-bdr">
          <tr>
            <TH label="Order"      k="orderId" />
            <TH label="Patient"    k="patient" />
            <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Medication</th>
            <TH label="Prescriber" k="prescriber" />
            <TH label="Decided at" k="decidedAt" />
            <TH label="Turnaround" k="hoursFromSubmit" />
            <TH label="SLA"        k="sla" />
          </tr>
        </thead>
        <tbody className="divide-y divide-bdr">
          {rows.map((r) => (
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
        <StatCard
          icon={Stethoscope}
          label="Total remote decisions (30d)"
          value={String(DERIVED_DECISION_TOTAL)}
          sub={`VSC: ${DERIVED_VSC_DECISIONS} \u00b7 FeelTru: ${DERIVED_FEELTRU_DECISIONS}`}
          color="brand"
        />
        <StatCard
          icon={CheckCircle2}
          label="SLA compliance"
          value={`${DERIVED_SLA_PCT}%`}
          sub={`${DERIVED_SLA_MET} of ${DERIVED_DECISION_TOTAL} within 24h working SLA`}
          color={DERIVED_SLA_PCT >= 90 ? "ok" : "warn"}
        />
        <StatCard
          icon={Clock}
          label="Avg turnaround"
          value={`${DERIVED_AVG_TURNAROUND_H}h`}
          sub={"Target: \u2264 24 working hours"}
          color={DERIVED_AVG_TURNAROUND_H > 24 ? "err" : "brand"}
        />
        <StatCard
          icon={AlertTriangle}
          label="SLA breaches"
          value={String(DERIVED_SLA_BREACHED)}
          sub={DERIVED_SLA_BREACHED === 0
            ? "No breaches in the seeded decision pool"
            : `${DERIVED_SLA_BREACHED} decision(s) recorded after sla_breach_at`}
          color={DERIVED_SLA_BREACHED === 0 ? "ok" : "warn"}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <SlaTrendChart />
        <SlaMetMissedBar />
      </div>
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

function ReVerificationPanel() {
  // Patients still needing follow-up: anything not "passed" in the derived
  // identity rows (failed / under review). Sourced from MOCK_PATIENTS so the
  // panel always matches the IdentityTable below it.
  const outstanding = DERIVED_IDENTITY_ROWS
    .filter((r) => r.status !== "passed")
    .slice(0, 6);
  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <p className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-3">Re-verification outcomes</p>
      <div className="space-y-2.5">
        {outstanding.length === 0 && (
          <p className="text-[11px] text-t3 italic">
            No outstanding identity cases — all patients in the fixture set passed SumSub.
          </p>
        )}
        {outstanding.map((r) => {
          const isFail = r.status === "failed";
          return (
            <div
              key={r.patientId}
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg border",
                isFail ? "bg-err-bg border-err-bdr" : "bg-warn-bg border-warn-bdr",
              )}
            >
              {isFail
                ? <XCircle       className="w-4 h-4 text-err shrink-0" />
                : <AlertTriangle className="w-4 h-4 text-warn shrink-0" />}
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-t1 truncate">{r.patient} ({r.patientId})</p>
                <p className="text-[10.5px] text-t3 truncate">
                  {isFail ? "Failed" : "Under review"} · {r.failReason ?? "Awaiting decision"} · last update {r.verifiedAt}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-t3 mt-3 pt-2 border-t border-bdr">
        UK GDPR Article 9 · patient records cannot proceed to clinical check without confirmed identity.
      </p>
    </div>
  );
}

function FailReasonBreakdown() {
  // CSS conic-gradient doughnut — no charting library, deterministic output.
  const total = FAIL_REASONS.reduce((s, f) => s + f.count, 0) || 1;
  const SWATCH: Record<string, string> = {
    "bg-warn": "#f59e0b",
    "bg-err":  "#dc2626",
    "bg-info": "#3b82f6",
  };
  let cursor = 0;
  const stops = FAIL_REASONS.map((f) => {
    const start = cursor;
    const end   = cursor + (f.count / total) * 360;
    cursor = end;
    return `${SWATCH[f.color] ?? "#94a3b8"} ${start}deg ${end}deg`;
  }).join(", ");
  const gradient = `conic-gradient(${stops})`;
  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <p className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-3">
        Fail / review reasons
      </p>
      <div className="flex items-center gap-4">
        <div
          className="relative shrink-0 rounded-full"
          style={{ width: 96, height: 96, background: gradient }}
          role="img"
          aria-label={`Doughnut chart of ${total} fail or review outcomes by reason`}
        >
          <div
            className="absolute inset-0 m-auto rounded-full bg-surface flex flex-col items-center justify-center"
            style={{ width: 56, height: 56 }}
          >
            <span className="text-[16px] font-bold text-t1 leading-none">{total}</span>
            <span className="text-[9px] text-t3 uppercase tracking-wider">cases</span>
          </div>
        </div>
        <ul className="flex-1 space-y-1.5">
          {FAIL_REASONS.map((f) => (
            <li key={f.label} className="flex items-center justify-between text-[11.5px]">
              <span className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm inline-block"
                      style={{ background: SWATCH[f.color] ?? "#94a3b8" }} />
                <span className="text-t1 font-semibold">{f.label}</span>
              </span>
              <span className="text-t2 tabular-nums">
                {f.count} <span className="text-t3">({f.pct}%)</span>
              </span>
            </li>
          ))}
        </ul>
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
  // Patient age comes from MOCK_PATIENTS.dob captured on DERIVED_IDENTITY_ROWS.
  const enriched = IDENTITY_ROWS.map((r) => ({ ...r, age: patientAge(r.dob) }));
  const rows = [...enriched].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "patient")         cmp = a.patient.localeCompare(b.patient);
    if (sortKey === "age")             cmp = a.age - b.age;
    if (sortKey === "status")          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (sortKey === "turnaroundHours") cmp = a.turnaroundHours - b.turnaroundHours;
    if (sortKey === "verifiedAt")      cmp = (a.verifiedAtIso ? Date.parse(a.verifiedAtIso) : 0) - (b.verifiedAtIso ? Date.parse(b.verifiedAtIso) : 0);
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
            <TH label="Age"         k="age" />
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
              <td className="py-2.5 px-3 tabular-nums text-t2">{r.age}</td>
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
  const passed   = DERIVED_VERIFIED;
  const review   = DERIVED_REVIEW;
  const failed   = DERIVED_REJECTED;
  const total    = DERIVED_SUMSUB_TOTAL;
  const passRate = DERIVED_SUMSUB_PASS_PCT;
  const avgTurnaround = DERIVED_AVG_VERIFY_HOURS.toFixed(1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={ShieldCheck}  label="Identity pass rate"     value={`${passRate}%`}  sub={`${passed} of ${total} verifications passed`}   color={passRate >= 90 ? "ok" : "warn"} />
        <StatCard icon={Users}        label="Total verifications"    value={`${total}`}       sub="VSC + FeelTru · derived from MOCK_PATIENTS"     color="brand"/>
        <StatCard icon={Clock}        label="Avg turnaround"         value={`${avgTurnaround}h`} sub="Time from submission to SumSub decision"      color="brand"/>
        <StatCard icon={XCircle}      label="Failed / under review"  value={`${failed + review}`} sub={`${failed} failed \u00b7 ${review} under review`} color={failed + review > 0 ? "err" : "ok"} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Pass / review / fail summary */}
        <div className="bg-surface border border-bdr rounded-xl p-4">
          <p className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-3">Outcome distribution</p>
          <div className="space-y-3">
            {[
              { label: "Passed",       count: passed, pct: total > 0 ? Math.round((passed / total) * 100) : 0, color: "bg-ok",   text: "text-ok"   },
              { label: "Under review", count: review, pct: total > 0 ? Math.round((review / total) * 100) : 0, color: "bg-warn", text: "text-warn" },
              { label: "Failed",       count: failed, pct: total > 0 ? Math.round((failed / total) * 100) : 0, color: "bg-err",  text: "text-err"  },
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
        <ReVerificationPanel />

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
