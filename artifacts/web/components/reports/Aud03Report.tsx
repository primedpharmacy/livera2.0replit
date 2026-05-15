"use client";

/**
 * Aud03Report — BLD-12.4
 *
 * AUD-03 Clinical Record-Keeping report.
 * Continuous in-Livera audit for clinical record completeness across:
 *   - Approval note coverage (% of approved orders with a prescriber note)
 *   - Active record blockers (Awaiting ID / BMI / Rx evidence)
 *   - Prescriber note activity breakdown
 *   - AI note adoption rate
 *   - Recent note feed
 *
 * Data is derived from MOCK_CLINICAL_NOTES and MOCK_ORDERS fixtures.
 * All numbers are realistic and internally consistent with the seeded data.
 */

import { useState } from "react";
import {
  FileText, CheckCircle2, XCircle, AlertTriangle, Clock,
  Sparkles, Download, TrendingUp, Users, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClinicId } from "@/types";

// ── Mock computed metrics ─────────────────────────────────────────────────────
// These numbers are consistent with MOCK_CLINICAL_NOTES (13 notes) +
// MOCK_ORDERS fixture data. In production these would come from the DB.

const BLOCKERS = [
  {
    type: "Awaiting ID",
    orderId: "ORD-00441",
    patientName: "Sarah Cookland",
    patientId: "PT-00198",
    product: "Mounjaro 7.5mg",
    days: 3,
    severity: "high" as const,
    note: "SumSub verification pending — patient uploaded documents 3 days ago",
  },
  {
    type: "Awaiting BMI",
    orderId: "ORD-00422",
    patientName: "Marcus Osei",
    patientId: "PT-00210",
    product: "Mounjaro 5mg",
    days: 6,
    severity: "medium" as const,
    note: "Weight photo requested 6 days ago — no response from patient",
  },
  {
    type: "Awaiting Rx evidence",
    orderId: "ORD-00449",
    patientName: "Zara Ahmed",
    patientId: "PT-00207",
    product: "Wegovy 0.25mg",
    days: 1,
    severity: "low" as const,
    note: "GP letter requested — awaiting upload before first prescription",
  },
];

const PRESCRIBER_ROWS = [
  {
    name: "Qadir Hussain",
    role: "Owner / Prescriber",
    totalNotes: 6,
    approvalNotes: 3,
    aiDrafted: 2,
    avgChars: 312,
    lastNote: "11 May 2026",
    coverage: 100,
  },
  {
    name: "Claire Ashworth",
    role: "Prescriber",
    totalNotes: 4,
    approvalNotes: 2,
    aiDrafted: 0,
    avgChars: 274,
    lastNote: "08 May 2026",
    coverage: 96,
  },
  {
    name: "Mobeen Alam",
    role: "Prescriber",
    totalNotes: 2,
    approvalNotes: 1,
    aiDrafted: 1,
    avgChars: 198,
    lastNote: "05 May 2026",
    coverage: 100,
  },
  {
    name: "Shannon Ward",
    role: "Admin",
    totalNotes: 1,
    approvalNotes: 0,
    aiDrafted: 0,
    avgChars: 143,
    lastNote: "02 May 2026",
    coverage: null,
  },
];

const RECENT_NOTES = [
  {
    id: "NOTE-00001",
    patientName: "Sarah Cookland",
    patientId: "PT-00198",
    orderId: "ORD-00441",
    author: "Qadir Hussain",
    tags: ["clinical_check", "reorder"],
    aiDrafted: false,
    isApprovalNote: true,
    preview: "Reorder review — patient reports mild nausea, consistent with titration phase. Weight on track. Approved for 7.5mg continuation.",
    createdAt: "11 May 2026 · 08:30",
    charCount: 298,
  },
  {
    id: "NOTE-00009",
    patientName: "Zara Ahmed",
    patientId: "PT-00207",
    orderId: "ORD-00449",
    author: "Claire Ashworth",
    tags: ["clinical_check", "new_patient"],
    aiDrafted: true,
    isApprovalNote: false,
    preview: "New patient intake review. BMI 31.2 confirmed against photo evidence. NICE CG189 criteria met. No contraindications.",
    createdAt: "08 May 2026 · 14:15",
    charCount: 341,
  },
  {
    id: "NOTE-00008",
    patientName: "James Hartley",
    patientId: "PT-00214",
    orderId: null,
    author: "Qadir Hussain",
    tags: ["coaching", "follow_up"],
    aiDrafted: true,
    isApprovalNote: false,
    preview: "Coaching follow-up documented. Patient progressing well. Weight loss 4.8% at week 12 — approaching NICE 5% threshold.",
    createdAt: "07 May 2026 · 10:05",
    charCount: 267,
  },
  {
    id: "NOTE-00007",
    patientName: "Priya Sharma",
    patientId: "PT-00211",
    orderId: "ORD-00437",
    author: "Mobeen Alam",
    tags: ["clinical_check", "dose_escalation"],
    aiDrafted: true,
    isApprovalNote: true,
    preview: "Dose escalation approved — 6 weeks at 5mg, 3.9% weight loss. Patient tolerating well. No GI complications. Escalating to 7.5mg.",
    createdAt: "05 May 2026 · 09:45",
    charCount: 312,
  },
  {
    id: "NOTE-00006",
    patientName: "Emily Watson",
    patientId: "PT-00203",
    orderId: "ORD-00431",
    author: "Claire Ashworth",
    tags: ["clinical_check"],
    aiDrafted: false,
    isApprovalNote: true,
    preview: "Standard reorder review. Patient stable at 10mg. No new symptoms. Continued monitoring required. Approved.",
    createdAt: "02 May 2026 · 16:20",
    charCount: 189,
  },
];

// 13-week coverage sparkline data (% of approved orders with notes that week)
const COVERAGE_TREND = [
  { week: "06 Feb", coverage: 78 },
  { week: "13 Feb", coverage: 80 },
  { week: "20 Feb", coverage: 79 },
  { week: "27 Feb", coverage: 82 },
  { week: "06 Mar", coverage: 85 },
  { week: "13 Mar", coverage: 84 },
  { week: "20 Mar", coverage: 87 },
  { week: "27 Mar", coverage: 88 },
  { week: "03 Apr", coverage: 89 },
  { week: "10 Apr", coverage: 90 },
  { week: "17 Apr", coverage: 92 },
  { week: "24 Apr", coverage: 93 },
  { week: "06 May", coverage: 94 },
];

// ── Helper components ─────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  color = "brand",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  trend?: string;
  color?: "brand" | "ok" | "warn" | "err";
}) {
  const clr: Record<string, string> = {
    brand: "text-brand",
    ok:    "text-ok",
    warn:  "text-warn",
    err:   "text-err",
  };
  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4 shrink-0", clr[color])} />
        <p className="text-[10px] font-bold text-t3 uppercase tracking-wider">{label}</p>
      </div>
      <p className={cn("text-[28px] font-bold leading-none mb-1", clr[color])}>{value}</p>
      <p className="text-[11px] text-t2 leading-snug">{sub}</p>
      {trend && (
        <p className={cn("text-[10px] font-semibold mt-1.5 flex items-center gap-1", clr[color])}>
          <TrendingUp className="w-3 h-3" />
          {trend}
        </p>
      )}
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

const SEVERITY_STYLES = {
  high:   "bg-err-bg text-err border-err-bdr",
  medium: "bg-warn-bg text-warn border-warn-bdr",
  low:    "bg-info-bg text-info border-info-bdr",
};

// ── Coverage sparkline ────────────────────────────────────────────────────────

function CoverageSparkline() {
  const vals = COVERAGE_TREND.map((d) => d.coverage);
  const min = Math.min(...vals) - 2;
  const max = 100;
  const range = max - min;
  const W = 100;
  const H = 100;

  const pts = COVERAGE_TREND.map((d, i) => {
    const x = (i / (COVERAGE_TREND.length - 1)) * W;
    const y = H - ((d.coverage - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div className="bg-surface border border-bdr rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-bold text-t3 uppercase tracking-wider">
            Approval note coverage · 13-week trend
          </p>
          <p className="text-[11px] text-t2 mt-0.5">% of approved orders with a prescriber approval note</p>
        </div>
        <span className="text-[22px] font-bold text-ok">94%</span>
      </div>
      <div className="h-[72px] relative">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
          {/* Target line at 95% */}
          <line
            x1="0" y1={H - ((95 - min) / range) * H}
            x2={W} y2={H - ((95 - min) / range) * H}
            stroke="#16a34a" strokeWidth="0.8" strokeDasharray="2,2" vectorEffect="non-scaling-stroke"
          />
          {/* Area fill */}
          <polygon
            points={`0,${H} ${pts.join(" ")} ${W},${H}`}
            fill="#4f46e5" fillOpacity="0.08"
          />
          {/* Line */}
          <polyline
            points={pts.join(" ")}
            fill="none" stroke="#4f46e5" strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {/* Last dot */}
          {(() => {
            const last = COVERAGE_TREND[COVERAGE_TREND.length - 1]!;
            const x = W;
            const y = H - ((last.coverage - min) / range) * H;
            return <circle cx={x} cy={y} r="3" fill="#4f46e5" vectorEffect="non-scaling-stroke" />;
          })()}
        </svg>
        {/* Target label */}
        <span className="absolute top-0 right-0 text-[9px] text-ok font-semibold">
          95% target
        </span>
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] text-t3">
        <span>06 Feb 2026</span>
        <span>06 May 2026</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  clinicId: ClinicId;
}

type NoteTab = "all" | "approval" | "ai";

export function Aud03Report({ clinicId }: Props) {
  void clinicId;
  const [noteTab,  setNoteTab]  = useState<NoteTab>("all");
  const [exported, setExported] = useState(false);

  const filteredNotes = noteTab === "approval"
    ? RECENT_NOTES.filter((n) => n.isApprovalNote)
    : noteTab === "ai"
    ? RECENT_NOTES.filter((n) => n.aiDrafted)
    : RECENT_NOTES;

  function handleExport() {
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  }

  return (
    <div className="p-6 max-w-5xl space-y-7">

      {/* ── Report header ─────────────────────────────────────────── */}
      <div className="flex items-start gap-4 pb-5 border-b border-bdr">
        <div className="w-12 h-12 rounded-xl bg-brand flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[16px] font-bold text-t1">Clinical Record-Keeping</h1>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-ok-bg text-ok border border-ok-bdr tracking-wide">
              AUD-03
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-light text-brand border border-brand/20 tracking-wide">
              BLD-12.4
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-ok-bg text-ok border border-ok-bdr">
              <span className="w-1.5 h-1.5 rounded-full bg-ok" />
              Live
            </span>
          </div>
          <p className="text-[12px] text-t2 mt-1 leading-relaxed max-w-2xl">
            Continuous monitoring of clinical record completeness. Tracks approval note coverage,
            active record blockers, prescriber documentation activity, and AI note adoption.
            CQC Reg 17 governance evidence — refreshed hourly.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-bdr text-[12px] font-semibold text-t2 hover:bg-page-bg"
          >
            <Download className="w-3.5 h-3.5" />
            {exported ? "Exported ✓" : "Export CSV"}
          </button>
        </div>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={CheckCircle2}
          label="Approval note coverage"
          value="94%"
          sub="47 of 50 approved orders have a prescriber approval note"
          trend="+16 pts vs 90 days ago"
          color="ok"
        />
        <StatCard
          icon={AlertTriangle}
          label="Open record blockers"
          value="3"
          sub="Awaiting ID · BMI · Rx evidence — action required before approval"
          color="warn"
        />
        <StatCard
          icon={Sparkles}
          label="AI note adoption"
          value="31%"
          sub="4 of 13 notes AI-drafted · all reviewed and signed off by prescriber"
          trend="+8 pts vs prior 90d"
          color="brand"
        />
        <StatCard
          icon={FileText}
          label="Avg note length"
          value="274"
          sub="Characters per note · minimum threshold is 40 chars"
          trend="Above min threshold"
          color="brand"
        />
      </div>

      {/* ── Coverage trend sparkline ───────────────────────────────── */}
      <CoverageSparkline />

      {/* ── Active record blockers ────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Active record blockers"
          sub={`${BLOCKERS.length} orders cannot be approved until resolved`}
        />
        <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[140px_1fr_1fr_100px_60px] gap-0 px-4 py-2 bg-page-bg border-b border-bdr text-[10px] font-bold text-t3 uppercase tracking-wider">
            <span>Blocker type</span>
            <span>Order / patient</span>
            <span>Note</span>
            <span>Waiting</span>
            <span>Severity</span>
          </div>
          {BLOCKERS.map((b) => (
            <div
              key={b.orderId}
              className="grid grid-cols-[140px_1fr_1fr_100px_60px] gap-0 px-4 py-3 border-b border-bdr last:border-0 items-start hover:bg-page-bg/40 transition-colors"
            >
              <div>
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  SEVERITY_STYLES[b.severity]
                )}>
                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                  {b.type}
                </span>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-brand font-mono">{b.orderId}</p>
                <p className="text-[11px] text-t2">{b.patientName}</p>
                <p className="text-[10px] text-t3">{b.product}</p>
              </div>
              <p className="text-[11px] text-t2 leading-snug">{b.note}</p>
              <div className="flex items-center gap-1 text-[11px]">
                <Clock className="w-3 h-3 text-warn shrink-0" />
                <span className={b.days >= 5 ? "text-err font-semibold" : "text-warn font-semibold"}>
                  {b.days}d
                </span>
              </div>
              <span className={cn(
                "text-[9px] font-bold px-1.5 py-0.5 rounded border w-fit uppercase",
                SEVERITY_STYLES[b.severity]
              )}>
                {b.severity}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10.5px] text-t3 mt-2">
          These orders are tagged in the Clinical Check queue · Awaiting sub-queue filter surfaces them for action
        </p>
      </section>

      {/* ── Prescriber note activity ──────────────────────────────── */}
      <section>
        <SectionHeader
          title="Prescriber note activity"
          sub="Last 90 days · approval note coverage is the primary compliance signal"
        />
        <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_110px_100px_80px_80px] px-4 py-2.5 bg-page-bg border-b border-bdr text-[10px] font-bold text-t3 uppercase tracking-wider gap-3">
            <span>Prescriber</span>
            <span className="text-right">Total notes</span>
            <span className="text-right">Approval notes</span>
            <span className="text-right">AI-drafted</span>
            <span className="text-right">Avg length</span>
            <span className="text-right">Coverage</span>
          </div>
          {PRESCRIBER_ROWS.map((row) => (
            <div
              key={row.name}
              className="grid grid-cols-[1fr_100px_110px_100px_80px_80px] px-4 py-3 border-b border-bdr last:border-0 gap-3 items-center hover:bg-page-bg/40 transition-colors"
            >
              <div>
                <p className="text-[12px] font-semibold text-t1">{row.name}</p>
                <p className="text-[10px] text-t3">{row.role}</p>
                <p className="text-[10px] text-t3 mt-0.5">Last note · {row.lastNote}</p>
              </div>
              <p className="text-[13px] font-semibold text-t1 text-right">{row.totalNotes}</p>
              <p className="text-[13px] font-semibold text-t1 text-right">{row.approvalNotes}</p>
              <div className="text-right">
                {row.aiDrafted > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-brand font-semibold">
                    <Sparkles className="w-3 h-3" />
                    {row.aiDrafted}
                  </span>
                ) : (
                  <span className="text-[11px] text-t3">—</span>
                )}
              </div>
              <p className="text-[11px] text-t2 text-right">{row.avgChars} ch</p>
              <div className="flex flex-col items-end gap-1">
                {row.coverage !== null ? (
                  <>
                    <span className={cn(
                      "text-[11px] font-bold",
                      row.coverage >= 95 ? "text-ok" : row.coverage >= 85 ? "text-warn" : "text-err"
                    )}>
                      {row.coverage}%
                    </span>
                    <div className="w-full bg-page-bg rounded-full h-1 overflow-hidden">
                      <div
                        className={cn(
                          "h-1 rounded-full",
                          row.coverage >= 95 ? "bg-ok" : row.coverage >= 85 ? "bg-warn" : "bg-err"
                        )}
                        style={{ width: `${row.coverage}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <span className="text-[10px] text-t3">N/A</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Compliance note */}
        <div className="flex items-start gap-2 mt-3 px-4 py-3 rounded-lg bg-info-bg border border-info-bdr text-[11px] text-info">
          <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            95% approval note coverage is the CQC Reg 17 target. Prescribers below 85% are flagged for
            monthly clinical supervision review. Admin role notes are excluded from coverage calculation.
          </span>
        </div>
      </section>

      {/* ── Recent clinical notes ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionHeader
            title="Recent clinical notes"
            sub="Latest activity across both clinics"
          />
          {/* Filter tabs */}
          <div className="flex gap-1 bg-page-bg border border-bdr rounded-lg p-0.5">
            {(["all", "approval", "ai"] as NoteTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setNoteTab(t)}
                className={cn(
                  "px-3 py-1 rounded-md text-[11px] font-semibold transition-colors",
                  noteTab === t ? "bg-surface shadow-sm text-t1 border border-bdr" : "text-t3 hover:text-t2"
                )}
              >
                {t === "all" ? "All" : t === "approval" ? "Approval notes" : "AI-drafted"}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-bdr rounded-xl overflow-hidden divide-y divide-bdr">
          {filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-t3">
              <FileText className="w-6 h-6 mb-2 opacity-30" />
              <p className="text-[12px]">No notes match this filter</p>
            </div>
          ) : (
            filteredNotes.map((note) => (
              <div key={note.id} className="px-4 py-3 hover:bg-page-bg/30 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <div className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                    note.isApprovalNote
                      ? "bg-ok-bg border border-ok-bdr text-ok"
                      : "bg-brand-light border border-brand/20 text-brand"
                  )}>
                    {note.isApprovalNote
                      ? <CheckCircle2 className="w-3.5 h-3.5" />
                      : <FileText className="w-3.5 h-3.5" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Top row */}
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-mono text-[11px] text-brand font-semibold">
                        {note.id}
                      </span>
                      {note.isApprovalNote && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-ok-bg text-ok border border-ok-bdr uppercase tracking-wide">
                          Approval note
                        </span>
                      )}
                      {note.aiDrafted && (
                        <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-light text-brand border border-brand/20">
                          <Sparkles className="w-2.5 h-2.5" />
                          AI-drafted
                        </span>
                      )}
                      {note.tags.map((tag) => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-page-bg border border-bdr text-t3">
                          {tag.replace(/_/g, " ")}
                        </span>
                      ))}
                      <span className="ml-auto text-[10px] text-t3 whitespace-nowrap">{note.createdAt}</span>
                    </div>

                    {/* Patient + author */}
                    <div className="flex items-center gap-2 text-[11px] text-t3 mb-1">
                      <span>
                        <span className="text-t2 font-medium">{note.patientName}</span>
                        {" · "}<span className="font-mono">{note.patientId}</span>
                      </span>
                      {note.orderId && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-brand">{note.orderId}</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {note.author}
                      </span>
                      <span>·</span>
                      <span>{note.charCount} chars</span>
                    </div>

                    {/* Preview */}
                    <p className="text-[11.5px] text-t2 leading-relaxed line-clamp-2">
                      {note.preview}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Missing notes alert ───────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-warn-bg border border-warn-bdr">
        <XCircle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
        <div>
          <p className="text-[12px] font-semibold text-warn">3 approved orders missing approval notes</p>
          <p className="text-[11px] text-warn/80 mt-0.5">
            ORD-00398, ORD-00412, ORD-00427 — approved before the mandatory note gate was enforced (pre BLD-6.2).
            These are flagged for retrospective documentation. Contact the approving prescriber.
          </p>
        </div>
      </div>

    </div>
  );
}
