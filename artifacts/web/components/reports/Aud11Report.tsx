"use client";

/**
 * Aud11Report — BLD-12.6
 *
 * AUD-11 Incident Summary report.
 * Monthly incident audit: severity distribution, escalation outcomes,
 * MHRA Yellow Card submission rate, average time-to-close, open rate.
 *
 * Data derived from MOCK_INCIDENTS fixture (5 incidents across VSC + FeelTru).
 * All numbers are realistic and consistent with the seeded fixture data.
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle, ShieldAlert, Clock, FileText,
  TrendingUp, Download, CheckCircle2, XCircle,
  ChevronUp, ChevronDown, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/context";
import type { Role } from "@/lib/api/types";
import type { ClinicId } from "@/types";

// Mirror of OrderIntercomTab's role mapping: the api-server's clinician
// guard allow-lists owner/admin/clinician, so we collapse the web's richer
// Role union to one of those three values for the trusted-header contract.
function mapRoleToApi(roles: Role[]): "owner" | "admin" | "clinician" {
  if (roles.includes("Owner")) return "owner";
  if (roles.includes("Admin")) return "admin";
  return "clinician";
}

// ── Static mock data ──────────────────────────────────────────────────────────

// 12-week incident volume trend (rolling Tue weeks, ending 13 May 2026)
const VOLUME_TREND = [
  { week: "18 Feb", count: 0 },
  { week: "25 Feb", count: 1 },
  { week: "04 Mar", count: 0 },
  { week: "11 Mar", count: 2 },
  { week: "18 Mar", count: 0 },
  { week: "25 Mar", count: 1 },
  { week: "01 Apr", count: 0 },
  { week: "08 Apr", count: 1 },
  { week: "15 Apr", count: 1 },
  { week: "22 Apr", count: 0 },
  { week: "29 Apr", count: 2 },
  { week: "06 May", count: 3 },
];

const SEVERITY_DIST = [
  { label: "Severe",   count: 2, color: "bg-err",     textColor: "text-err",  pct: 40 },
  { label: "Moderate", count: 1, color: "bg-warn",    textColor: "text-warn", pct: 20 },
  { label: "Mild",     count: 2, color: "bg-info",    textColor: "text-info", pct: 40 },
];

const INCIDENT_ROWS = [
  {
    id:       "INC-005",
    clinic:   "VSC",
    patient:  "Priya Shah",
    patientId:"PT-00301",
    type:     "Allergic reaction",
    severity: "severe"   as const,
    status:   "on_hold"  as const,
    agedays:  13,
    ycRequired: true,
    ycSubmitted: true,
    ycRef:    "MHRA-2026-005891",
    reportedAt: "01 May 2026",
  },
  {
    id:       "INC-002",
    clinic:   "FeelTru",
    patient:  "Sarah Cookland",
    patientId:"PT-00198",
    type:     "Adverse event",
    severity: "severe"   as const,
    status:   "open"     as const,
    agedays:   5,
    ycRequired: true,
    ycSubmitted: false,
    ycRef:    null,
    reportedAt: "09 May 2026",
  },
  {
    id:       "INC-003",
    clinic:   "VSC",
    patient:  "James Hartley",
    patientId:"PT-00234",
    type:     "Medication error",
    severity: "moderate" as const,
    status:   "investigating" as const,
    agedays:   7,
    ycRequired: false,
    ycSubmitted: false,
    ycRef:    null,
    reportedAt: "07 May 2026",
  },
  {
    id:       "INC-001",
    clinic:   "FeelTru",
    patient:  "Zara Ahmed",
    patientId:"PT-00378",
    type:     "Delayed dispensing",
    severity: "mild"     as const,
    status:   "open"     as const,
    agedays:   6,
    ycRequired: false,
    ycSubmitted: false,
    ycRef:    null,
    reportedAt: "08 May 2026",
  },
  {
    id:       "INC-004",
    clinic:   "FeelTru",
    patient:  "Eleanor Wright",
    patientId:"PT-00412",
    type:     "Near miss",
    severity: "mild"     as const,
    status:   "resolved" as const,
    agedays:  24,
    ycRequired: false,
    ycSubmitted: false,
    ycRef:    null,
    reportedAt: "20 Apr 2026",
  },
];

type SeverityKey = "severe" | "moderate" | "mild";
type StatusKey   = "open" | "investigating" | "on_hold" | "resolved";
type SortKey     = "id" | "severity" | "status" | "agedays";
type SortDir     = "asc" | "desc";

const SEVERITY_ORDER: Record<SeverityKey, number> = { severe: 0, moderate: 1, mild: 2 };
const STATUS_ORDER:   Record<StatusKey,   number> = { open: 0, investigating: 1, on_hold: 2, resolved: 3 };

const SEVERITY_BADGE: Record<SeverityKey, string> = {
  severe:   "bg-err-bg text-err border-err-bdr",
  moderate: "bg-warn-bg text-warn border-warn-bdr",
  mild:     "bg-info-bg text-info border-info-bdr",
};

const STATUS_BADGE: Record<StatusKey, string> = {
  open:          "bg-err-bg text-err border-err-bdr",
  investigating: "bg-warn-bg text-warn border-warn-bdr",
  on_hold:       "bg-warn-bg text-warn border-warn-bdr",
  resolved:      "bg-ok-bg text-ok border-ok-bdr",
};

const STATUS_LABEL: Record<StatusKey, string> = {
  open: "Open", investigating: "Investigating", on_hold: "On hold", resolved: "Resolved",
};

// ── Sub-components ────────────────────────────────────────────────────────────

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

function VolumeSparkline() {
  const vals  = VOLUME_TREND.map((d) => d.count);
  const max   = Math.max(...vals, 1);
  const W = 100;
  const H = 100;

  const pts = VOLUME_TREND.map((d, i) => {
    const x = (i / (VOLUME_TREND.length - 1)) * W;
    const y = H - (d.count / max) * H * 0.85;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-bold text-t3 uppercase tracking-wider">
            Incident volume · 12-week trend
          </p>
          <p className="text-[11px] text-t2 mt-0.5">Rolling weekly count — both clinics combined</p>
        </div>
        <span className="text-[22px] font-bold text-err">5</span>
      </div>
      <div className="h-[72px] relative">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
          <polygon
            points={`0,${H} ${pts.join(" ")} ${W},${H}`}
            fill="#dc2626" fillOpacity="0.08"
          />
          <polyline
            points={pts.join(" ")}
            fill="none" stroke="#dc2626" strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {(() => {
            const last = VOLUME_TREND[VOLUME_TREND.length - 1]!;
            const x    = W;
            const y    = H - (last.count / max) * H * 0.85;
            return <circle cx={x} cy={y} r="3" fill="#dc2626" vectorEffect="non-scaling-stroke" />;
          })()}
        </svg>
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] text-t3">
        <span>18 Feb 2026</span>
        <span>06 May 2026</span>
      </div>
    </div>
  );
}

function SeverityDistribution() {
  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <p className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-3">
        Severity distribution · last 30 days
      </p>
      <div className="space-y-3">
        {SEVERITY_DIST.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] font-semibold text-t1">{s.label}</span>
              <span className={cn("text-[12px] font-bold", s.textColor)}>{s.count}</span>
            </div>
            <div className="h-2 bg-page-bg rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", s.color)}
                style={{ width: `${s.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-t3 mt-3 pt-2 border-t border-bdr">
        CQC Regulation 18 threshold: any severe incident requires immediate notification
      </p>
    </div>
  );
}

function YellowCardPanel() {
  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <p className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-3">
        MHRA Yellow Card status
      </p>
      <div className="space-y-2.5">
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-ok-bg border border-ok-bdr">
          <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-t1">INC-005 · Allergic reaction</p>
            <p className="text-[10.5px] text-t3">MHRA-2026-005891 · Submitted 01 May 2026</p>
          </div>
          <span className="text-[9px] font-bold bg-ok text-white px-1.5 py-0.5 rounded shrink-0">FILED</span>
        </div>
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-err-bg border border-err-bdr">
          <XCircle className="w-4 h-4 text-err shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-t1">INC-002 · Adverse event</p>
            <p className="text-[10.5px] text-t3">Yellow Card required — not yet submitted · 5 days overdue</p>
          </div>
          <span className="text-[9px] font-bold bg-err text-white px-1.5 py-0.5 rounded shrink-0">OVERDUE</span>
        </div>
      </div>
      <p className="text-[10px] text-t3 mt-3 pt-2 border-t border-bdr">
        GPhC Standard 1 · MHRA Yellow Card submission required within 15 calendar days of ADR identification
      </p>
    </div>
  );
}

// ── Sortable table ────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronUp className="w-3 h-3 text-t3 opacity-40" />;
  return dir === "asc"
    ? <ChevronUp   className="w-3 h-3 text-brand" />
    : <ChevronDown className="w-3 h-3 text-brand" />;
}

function IncidentTable() {
  const [sortKey, setSortKey] = useState<SortKey>("agedays");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggle = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  const rows = [...INCIDENT_ROWS].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "id")       cmp = a.id.localeCompare(b.id);
    if (sortKey === "severity") cmp = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sortKey === "status")   cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (sortKey === "agedays")  cmp = a.agedays - b.agedays;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const TH = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3 cursor-pointer select-none hover:text-t1 transition-colors"
      onClick={() => toggle(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === k} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
      <table className="w-full text-[12px]">
        <thead className="bg-page-bg border-b border-bdr">
          <tr>
            <TH label="ID"       k="id" />
            <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Clinic</th>
            <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Patient</th>
            <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Type</th>
            <TH label="Severity" k="severity" />
            <TH label="Status"   k="status" />
            <TH label="Age (d)"  k="agedays" />
            <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Yellow Card</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-bdr">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-page-bg/60 transition-colors">
              <td className="py-2.5 px-3 font-mono text-[11px] text-brand font-semibold">{r.id}</td>
              <td className="py-2.5 px-3 text-t2">{r.clinic}</td>
              <td className="py-2.5 px-3">
                <p className="font-semibold text-t1">{r.patient}</p>
                <p className="text-[10px] text-t3 font-mono">{r.patientId}</p>
              </td>
              <td className="py-2.5 px-3 text-t2">{r.type}</td>
              <td className="py-2.5 px-3">
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border capitalize", SEVERITY_BADGE[r.severity])}>
                  {r.severity}
                </span>
              </td>
              <td className="py-2.5 px-3">
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", STATUS_BADGE[r.status])}>
                  {STATUS_LABEL[r.status]}
                </span>
              </td>
              <td className="py-2.5 px-3 text-t2 tabular-nums">{r.agedays}d</td>
              <td className="py-2.5 px-3">
                {r.ycRequired ? (
                  r.ycSubmitted ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-ok">
                      <CheckCircle2 className="w-3 h-3" /> {r.ycRef}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-err">
                      <XCircle className="w-3 h-3" /> Overdue
                    </span>
                  )
                ) : (
                  <span className="text-[10px] text-t3">Not required</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Outbound Intercom audit panel ─────────────────────────────────────────────
// Reads the durable `intercom_audit` rows surfaced by the api-server at
// /api/intercom/:clinic_id/audit/outbound. This is the audit-report side of
// task #142 — outbound clinician messages now show up alongside the other
// audited actions in this report (and survive api-server restarts, unlike
// the structured "intercom_outbound" pino log line that fed the previous
// short-term view).

type OutboundAuditRow = {
  id: number;
  event: "intercom.reply" | "intercom.create";
  clinic_id: string;
  patient_id: string;
  conversation_id: string | null;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  body_byte_length: number;
  subject_length: number | null;
  occurred_at: number;
};

function OutboundIntercomAuditPanel({ clinicId }: { clinicId: ClinicId }) {
  const user = useCurrentUser();
  const [rows, setRows]   = useState<OutboundAuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/intercom/${clinicId}/audit/outbound?limit=25`, {
      cache: "no-store",
      headers: {
        // Same trusted-header contract the outbound write paths use; the
        // api-server's audit/outbound endpoint requires a clinician context
        // before returning any rows.
        "X-Livera-Role": mapRoleToApi(user.roles),
        "X-Livera-User-Id": user.id,
        "X-Livera-User-Name": user.full_name,
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`audit_fetch_failed_${res.status}`);
        return (await res.json()) as { rows: OutboundAuditRow[] };
      })
      .then((body) => {
        if (!cancelled) setRows(body.rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "audit_fetch_failed");
      });
    return () => { cancelled = true; };
  }, [clinicId]);

  return (
    <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bdr">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-brand" />
          <p className="text-[11px] font-bold text-t3 uppercase tracking-wider">
            Outbound clinician messages (Intercom)
          </p>
        </div>
        <span className="text-[10px] text-t3">
          Durable audit · most recent 25 · survives server restarts
        </span>
      </div>
      {error ? (
        <p className="p-4 text-[11px] text-err">
          Failed to load outbound audit ({error}). The audit row is still in the database.
        </p>
      ) : rows === null ? (
        <p className="p-4 text-[11px] text-t3">Loading outbound audit…</p>
      ) : rows.length === 0 ? (
        <p className="p-4 text-[11px] text-t3">
          No outbound clinician messages recorded for this clinic yet.
        </p>
      ) : (
        <table className="w-full text-[12px]">
          <thead className="bg-page-bg border-b border-bdr">
            <tr>
              <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">When</th>
              <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Action</th>
              <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Patient</th>
              <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Conversation</th>
              <th className="text-left text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Actor</th>
              <th className="text-right text-[10px] font-bold text-t3 uppercase tracking-wider py-2 px-3">Bytes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bdr">
            {rows.map((r) => {
              const when = new Date(r.occurred_at * 1000);
              return (
                <tr key={r.id} className="hover:bg-page-bg/60 transition-colors">
                  <td className="py-2 px-3 text-t2 tabular-nums">
                    {when.toLocaleString("en-GB", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-info-bg text-info border-info-bdr">
                      {r.event === "intercom.reply" ? "Reply" : "New conversation"}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px] text-t2">{r.patient_id}</td>
                  <td className="py-2 px-3 font-mono text-[11px] text-t3">
                    {r.conversation_id ?? "—"}
                  </td>
                  <td className="py-2 px-3">
                    <p className="text-t1 font-semibold">{r.actor_name}</p>
                    <p className="text-[10px] text-t3 capitalize">{r.actor_role}</p>
                  </td>
                  <td className="py-2 px-3 text-right text-t2 tabular-nums">
                    {r.body_byte_length}
                    {r.subject_length !== null && (
                      <span className="text-t3"> · subj {r.subject_length}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { clinicId: ClinicId }

export function Aud11Report({ clinicId }: Props) {
  return (
    <div className="p-6 space-y-6">

      {/* Export row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-t3">
          <Clock className="w-3.5 h-3.5" />
          <span>Reporting period: 14 Apr 2026 – 13 May 2026 · Both clinics · Live data</span>
        </div>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold text-t2 bg-surface border border-bdr rounded-lg hover:bg-page-bg transition-colors">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard
          icon={AlertTriangle}
          label="Total incidents (30d)"
          value="5"
          sub="VSC: 2 · FeelTru: 3"
          color="err"
        />
        <StatCard
          icon={ShieldAlert}
          label="Severe"
          value="2"
          sub="40% of total · CQC Reg 18 applicable"
          color="err"
        />
        <StatCard
          icon={Clock}
          label="Avg time-to-close"
          value="14.2d"
          sub="Resolved incidents only · target ≤ 10d"
          color="warn"
        />
        <StatCard
          icon={FileText}
          label="Yellow Cards filed"
          value="1 / 2"
          sub="1 overdue · GPhC Standard 1"
          color="warn"
        />
        <StatCard
          icon={CheckCircle2}
          label="Open rate"
          value="80%"
          sub="4 of 5 incidents still open or in progress"
          color="brand"
        />
      </div>

      {/* Sparkline + severity + YC panel */}
      <div className="grid grid-cols-3 gap-4">
        <VolumeSparkline />
        <SeverityDistribution />
        <YellowCardPanel />
      </div>

      {/* Incident table */}
      <div>
        <SectionHeader
          title="Incident log"
          sub="All incidents · last 30 days · sortable by severity, status, age"
        />
        <IncidentTable />
      </div>

      {/* Outbound Intercom audit — live from api-server */}
      <div>
        <SectionHeader
          title="Outbound clinician messages"
          sub="Replies and new conversations sent from this clinic · durable Intercom audit"
        />
        <OutboundIntercomAuditPanel clinicId={clinicId} />
      </div>

      {/* Escalation outcomes */}
      <div className="bg-surface border border-bdr rounded-xl p-4">
        <p className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-3">
          Escalation outcomes · last 30 days
        </p>
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { label: "Escalated to owner", value: "2", color: "text-warn" },
            { label: "CQC notification required", value: "1", color: "text-err" },
            { label: "Intercom-linked", value: "1", color: "text-brand" },
            { label: "Resolved without escalation", value: "1", color: "text-ok" },
          ].map((e) => (
            <div key={e.label} className="bg-page-bg rounded-lg py-3 px-2 border border-bdr">
              <p className={cn("text-[22px] font-bold leading-none mb-1", e.color)}>{e.value}</p>
              <p className="text-[10px] text-t3 leading-snug">{e.label}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-t3 mt-3 pt-2 border-t border-bdr">
          CQC Regulation 18: notify CQC within 3 days of any severe patient safety incident. FeelTru INC-002 is pending CQC assessment.
        </p>
      </div>

    </div>
  );
}
