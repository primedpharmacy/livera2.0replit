"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ExternalLink, Check, Search } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { KeyboardShortcutLegend } from "@/components/shared/KeyboardShortcutLegend";
import { formatRelativeTime } from "@/lib/format";
import { NOW } from "@/lib/api/constants";
import { cn } from "@/lib/utils";
import { dispatchQueueCountChange } from "@/lib/queue-counts";
import type { Complaint, ComplaintSeverity, Patient, Clinic, ClinicId } from "@/types";

// ── Constants ────────────────────────────────────────────────────────────────
const RESOLVE_WD  = 20; // CQC standard -- 20 working days
const MONDAY_BASE = "https://primedpharmacy-company.monday.com/boards";

// ── Helpers ──────────────────────────────────────────────────────────────────
function addWorkingDays(startIso: string, wdCount: number): Date {
  const d = new Date(startIso);
  let added = 0;
  while (added < wdCount) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

function calDaysDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function toTitle(body: string): string {
  if (body.length <= 78) return body;
  const cut = body.slice(0, 75);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "...";
}

const USER_MAP: Record<string, { name: string; initials: string; color: string }> = {
  user_qadir:  { name: "Qadir",  initials: "QH", color: "#6366f1" },
  user_mobeen: { name: "Mobeen", initials: "MA", color: "#0ea5e9" },
  user_claire: { name: "Claire", initials: "CM", color: "#10b981" },
};

const SEV_CLS: Record<string, string> = {
  informal: "bg-ok-bg text-ok border border-ok-bdr",
  formal:   "bg-warn-bg text-warn border border-warn-bdr",
  serious:  "bg-err-bg text-err border border-err-bdr",
};

// ── Filter types ─────────────────────────────────────────────────────────────
type FilterTab      = "open" | "breached" | "investigating" | "resolved" | "escalated" | "all";
type SeverityFilter = ComplaintSeverity | "all";
type CategoryFilter = string | "all";
type OwnerFilter    = string | "all";
type DateRange      = "12m" | "6m" | "all";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "open",          label: "Open"          },
  { key: "breached",      label: "Breached"      },
  { key: "investigating", label: "Investigating"  },
  { key: "resolved",      label: "Resolved"      },
  { key: "escalated",     label: "Escalated"     },
  { key: "all",           label: "All"           },
];

const OPEN_STATUSES = new Set(["received", "acknowledged", "investigating"]);

function isBreached(c: Complaint, now: Date): boolean {
  if (!OPEN_STATUSES.has(c.status)) return false;
  return addWorkingDays(c.received_at, RESOLVE_WD) < now;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  initialComplaints: Complaint[];
  patients: Patient[];
  clinicId: ClinicId;
  clinic: Clinic;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ComplaintsView({ initialComplaints, patients, clinicId, clinic }: Props) {
  const router = useRouter();
  const [complaints,      setComplaints]      = useState<Complaint[]>(initialComplaints);
  const [activeTab,       setActiveTab]       = useState<FilterTab>("open");
  const [activeSeverity,  setActiveSeverity]  = useState<SeverityFilter>("all");
  const [activeCategory,  setActiveCategory]  = useState<CategoryFilter>("all");
  const [activeOwner,     setActiveOwner]     = useState<OwnerFilter>("all");
  const [dateRange,       setDateRange]       = useState<DateRange>("12m");
  const [search,          setSearch]          = useState("");
  const [showFlow,        setShowFlow]        = useState(true);
  const [focusedIdx,      setFocusedIdx]      = useState(-1);

  const now   = useMemo(() => new Date(NOW), []);
  const ackWd = clinic.config.default_slas.complaint_ack_wd;

  const patientMap = useMemo(
    () => Object.fromEntries(patients.map((p) => [p.id, p])),
    [patients]
  );

  // ── KPI ───────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const thirtyDayMs  = 30 * 86_400_000;
    const openList     = complaints.filter((c) => OPEN_STATUSES.has(c.status));
    const breachedList = complaints.filter((c) => isBreached(c, now));
    const near         = openList.filter((c) => {
      const due      = addWorkingDays(c.received_at, RESOLVE_WD);
      const daysLeft = calDaysDiff(now, due);
      return daysLeft >= 0 && daysLeft <= 5;
    });
    const awaitingAck   = openList.filter((c) => !c.acknowledged_at);
    const resolvedMonth = complaints.filter((c) =>
      c.status === "resolved" &&
      now.getTime() - new Date(c.resolved_at ?? c.updated_at ?? c.created_at).getTime() < thirtyDayMs
    );
    const escalated = complaints.filter((c) => c.regulator_escalation !== null);
    return {
      total:         complaints.length,
      openCount:     openList.length,
      breachedCount: breachedList.length,
      nearCount:     near.length,
      awaitingAck:   awaitingAck.length,
      resolvedMonth: resolvedMonth.length,
      escalated:     escalated.length,
    };
  }, [complaints, now]);

  // ── Tab counts ────────────────────────────────────────────────────────────
  const tabCounts = useMemo((): Record<FilterTab, number> => ({
    all:           complaints.length,
    open:          complaints.filter((c) => OPEN_STATUSES.has(c.status)).length,
    breached:      complaints.filter((c) => isBreached(c, now)).length,
    investigating: complaints.filter((c) => c.status === "investigating").length,
    resolved:      complaints.filter((c) => c.status === "resolved").length,
    escalated:     complaints.filter((c) => c.regulator_escalation !== null).length,
  }), [complaints, now]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const rangeMs = dateRange === "12m" ? 365 * 86_400_000 : dateRange === "6m" ? 183 * 86_400_000 : Infinity;
    return complaints.filter((c) => {
      // date range
      if (rangeMs !== Infinity && now.getTime() - new Date(c.received_at).getTime() > rangeMs) return false;
      // tab
      if      (activeTab === "open")          { if (!OPEN_STATUSES.has(c.status)) return false; }
      else if (activeTab === "breached")      { if (!isBreached(c, now)) return false; }
      else if (activeTab === "investigating") { if (c.status !== "investigating") return false; }
      else if (activeTab === "resolved")      { if (c.status !== "resolved") return false; }
      else if (activeTab === "escalated")     { if (!c.regulator_escalation) return false; }
      // severity
      if (activeSeverity !== "all" && c.severity !== activeSeverity) return false;
      // category
      if (activeCategory !== "all" && c.category !== activeCategory) return false;
      // owner
      if (activeOwner !== "all" &&
          c.updated_by_user_id !== activeOwner &&
          c.created_by_user_id !== activeOwner) return false;
      // search
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!c.id.toLowerCase().includes(q) &&
            !c.complainant_name.toLowerCase().includes(q) &&
            !c.body.toLowerCase().includes(q) &&
            !c.category.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [complaints, activeTab, activeSeverity, activeCategory, activeOwner, dateRange, search, now]);

  // Reset focus when filtered list shrinks
  useEffect(() => {
    setFocusedIdx((i) => (i >= filtered.length ? -1 : i));
  }, [filtered.length]);

  // ── Keyboard navigation (↑/↓ focus row, Enter opens detail) ───────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (filtered.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(filtered.length - 1, i < 0 ? 0 : i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(0, i < 0 ? 0 : i - 1));
      } else if (e.key === "Enter") {
        if (focusedIdx >= 0 && focusedIdx < filtered.length) {
          e.preventDefault();
          router.push(`/${clinicId}/complaints/${filtered[focusedIdx].id}`);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, focusedIdx, router, clinicId]);

  const focusedId =
    focusedIdx >= 0 && focusedIdx < filtered.length ? filtered[focusedIdx].id : null;

  function handleResolve(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setComplaints((prev) => {
      let didResolve = false;
      const next = prev.map((c) => {
        if (c.id !== id) return c;
        if (["resolved", "closed"].includes(c.status)) return c;
        didResolve = true;
        return {
          ...c,
          status: "resolved" as const,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });
      if (didResolve) {
        dispatchQueueCountChange({ queue: "complaints", delta: -1 });
      }
      return next;
    });
  }

  const mondayBoardUrl = complaints[0]?.monday_board_id
    ? `${MONDAY_BASE}/${complaints[0].monday_board_id}`
    : "#";

  return (
    <div>
      {/* ── Top meta bar ────────────────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-bdr bg-surface flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#16a34a] bg-[#dcfce7] border border-[#bbf7d0] rounded-full px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse shrink-0" />
            Live from Monday board
          </span>
          <span className="text-[12px] text-t2">
            {kpi.total} total &middot; {kpi.openCount} open
            {kpi.breachedCount > 0 && (
              <span className="text-err font-semibold"> &middot; {kpi.breachedCount} SLA breached</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={mondayBoardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md border border-bdr bg-surface text-t1 hover:border-brand hover:text-brand transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Monday
          </a>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md border border-bdr bg-surface text-t1 hover:border-brand hover:text-brand transition-colors">
            Export &middot; last 12 months
          </button>
        </div>
      </div>

      {/* ── KPI tiles ───────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-bdr bg-surface grid grid-cols-5 gap-3">
        <KpiTile label="OPEN &middot; BREACHED"       value={kpi.breachedCount} sub="> 20 working days"     border="err"  numCls={kpi.breachedCount > 0 ? "text-err"  : undefined} />
        <KpiTile label="OPEN &middot; &lt;5 DAYS LEFT" value={kpi.nearCount}     sub="Approaching breach"   border="warn" numCls={kpi.nearCount > 0     ? "text-warn" : undefined} />
        <KpiTile label="AWAITING ACKNOWLEDGE"         value={kpi.awaitingAck}   sub={`${ackWd}-day SLA`} />
        <KpiTile label="RESOLVED &middot; LAST 30 DAYS" value={kpi.resolvedMonth} sub="Avg time-to-resolve: 9d" border="ok" numCls={kpi.resolvedMonth > 0 ? "text-ok" : undefined} />
        <KpiTile label="ESCALATED TO REGULATOR"       value={kpi.escalated}     sub="Last 12 months" />
      </div>

      {/* ── Filter tabs + search ─────────────────────────────────────────── */}
      <div className="px-6 py-2 border-b border-bdr bg-surface flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-0.5 flex-wrap">
          {FILTER_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-semibold rounded-full border transition-colors",
                  active
                    ? "bg-brand text-white border-brand"
                    : "bg-surface text-t2 border-bdr hover:border-brand hover:text-brand"
                )}
              >
                {tab.label}
                <span className={cn("text-[10px] font-bold tabular-nums", active ? "opacity-80" : "opacity-50")}>
                  {tabCounts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t3" />
            <input
              type="text"
              placeholder="Search patient, ID, summary..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 pr-3 py-1 text-[12px] border border-bdr rounded-md bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand w-48"
            />
          </div>
          <select
            value={activeSeverity}
            onChange={(e) => setActiveSeverity(e.target.value as SeverityFilter)}
            className="text-[12px] border border-bdr rounded-md px-2 py-1 bg-surface text-t1 focus:outline-none focus:border-brand"
          >
            <option value="all">Severity: Any</option>
            <option value="informal">Informal</option>
            <option value="formal">Formal</option>
            <option value="serious">Serious</option>
          </select>
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value as CategoryFilter)}
            className="text-[12px] border border-bdr rounded-md px-2 py-1 bg-surface text-t1 focus:outline-none focus:border-brand"
          >
            <option value="all">Category: Any</option>
            <option value="clinical">Clinical</option>
            <option value="service">Service</option>
            <option value="communication">Communication</option>
            <option value="waiting_times">Waiting Times</option>
            <option value="billing">Billing</option>
            <option value="other">Other</option>
          </select>
          <select
            value={activeOwner}
            onChange={(e) => setActiveOwner(e.target.value as OwnerFilter)}
            className="text-[12px] border border-bdr rounded-md px-2 py-1 bg-surface text-t1 focus:outline-none focus:border-brand"
          >
            <option value="all">Owner: Anyone</option>
            {Object.entries(USER_MAP).map(([key, u]) => (
              <option key={key} value={key}>{u.name}</option>
            ))}
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="text-[12px] border border-bdr rounded-md px-2 py-1 bg-surface text-t1 focus:outline-none focus:border-brand"
          >
            <option value="12m">Last 12 months</option>
            <option value="6m">Last 6 months</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      <div className="px-6 pt-4">
        {/* ── "How a complaint reaches this view" collapsible ─────────────── */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setShowFlow((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-t2 hover:text-brand transition-colors"
          >
            {showFlow
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />}
            How a complaint reaches this view
          </button>
          {showFlow && (
            <span className="text-[10px] text-t3">
              Backend: Intercom tag listener &rarr; Monday auto-create + Livera task
            </span>
          )}
        </div>

        {showFlow && (
          <div className="mb-4 border border-bdr rounded-lg bg-page-bg p-4 grid grid-cols-4 gap-3">
            {[
              { step: "1 \u00b7 PATIENT",            title: "Email or Intercom",                     body: "Patient raises a concern through any channel -- care@ inbox or in-app chat." },
              { step: "2 \u00b7 CLINICIAN / ADMIN",  title: "Tags `complaint` in Intercom",          body: "Single tag triggers the listener. Acknowledgement reply is sent in-thread within 3 days." },
              { step: "3 \u00b7 LIVERA",             title: "Auto-creates Monday row + Livera task", body: "Owner = whoever tagged. Task due in 20 working days. Patient flag added." },
              { step: "4 \u00b7 THIS VIEW",          title: "Dual-SLA tracking",                     body: "3-day acknowledge clock + 20-working-day resolve clock. Resolve writes back to Monday." },
            ].map(({ step, title, body }) => (
              <div key={step} className="bg-surface border border-bdr rounded-md p-3">
                <div className="text-[9px] font-bold text-t3 uppercase tracking-wider mb-1">{step}</div>
                <div className="text-[12px] font-semibold text-t1 mb-1">{title}</div>
                <div className="text-[11px] text-t2 leading-relaxed">{body}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Read-only view banner ────────────────────────────────────────── */}
        <div className="mb-4 flex items-start gap-2 bg-[#eff6ff] border border-[#bfdbfe] rounded-md px-3 py-2">
          <span className="text-[11px] font-bold text-[#2563eb] mt-px shrink-0 w-4 h-4 rounded-full bg-[#2563eb] text-white flex items-center justify-center text-[9px]">i</span>
          <p className="text-[11px] text-[#1d4ed8] leading-relaxed">
            <span className="font-semibold">Read-only view.</span>{" "}
            Investigation happens in the linked Intercom thread. Resolution updates write back to{" "}
            <a href={mondayBoardUrl} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
              Monday
            </a>{" "}
            &middot; all CQC evidencing lives there.
          </p>
        </div>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-t3 text-[13px]">No complaints match the current filters.</div>
        ) : (
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden mb-6">
            {/* Table title row */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-bdr bg-page-bg">
              <span className="text-[12px] font-semibold text-t1">Complaints register</span>
              <div className="flex items-center gap-3">
                <KeyboardShortcutLegend
                  shortcuts={[
                    { keys: ["↑", "↓"], label: "navigate" },
                    { keys: ["↵"],      label: "open" },
                  ]}
                />
                <span className="text-[11px] text-t3">
                  {filtered.length} complaint{filtered.length !== 1 ? "s" : ""}
                </span>
                <a
                  href={mondayBoardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-brand font-semibold hover:underline"
                >
                  View full board
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_155px_190px_115px_110px_160px_130px] px-4 py-2 border-b border-bdr">
              {["Complaint", "Patient", "SLA \u00b7 3D ACK / 20WD Resolve", "Status", "Owner", "Last activity", "Actions"].map((h) => (
                <span key={h} className="text-[10px] font-bold uppercase tracking-wider text-t3">{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-bdr">
              {filtered.map((c) => {
                const patient     = c.patient_id ? patientMap[c.patient_id] : null;
                const ackDue      = addWorkingDays(c.received_at, ackWd);
                const resolveDue  = addWorkingDays(c.received_at, RESOLVE_WD);
                const ackOverdue  = !c.acknowledged_at && now > ackDue;
                const isOpen      = OPEN_STATUSES.has(c.status);
                const resolveOver = isOpen && now > resolveDue ? calDaysDiff(resolveDue, now) : null;
                const resolveLeft = isOpen && !resolveOver ? calDaysDiff(now, resolveDue) : null;
                const owner       = USER_MAP[c.updated_by_user_id ?? c.created_by_user_id] ?? USER_MAP.user_qadir;
                const mondayUrl   = c.monday_item_id
                  ? `${MONDAY_BASE}/${c.monday_board_id}/pulses/${c.monday_item_id}`
                  : null;

                return (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/${clinicId}/complaints/${c.id}`)}
                    className={cn(
                      "grid grid-cols-[1fr_155px_190px_115px_110px_160px_130px] px-4 py-3 cursor-pointer transition-colors",
                      c.id === focusedId
                        ? "bg-brand-light hover:bg-brand-light ring-1 ring-inset ring-brand/40"
                        : resolveOver ? "bg-err-bg/30 hover:bg-err-bg/50" : "hover:bg-brand-light/40"
                    )}
                  >
                    {/* COMPLAINT */}
                    <div className="pr-3">
                      <span className="font-mono text-[11px] font-bold text-brand">{c.id}</span>
                      <p className="text-[12.5px] text-t1 font-medium leading-snug mt-0.5 mb-1.5">
                        {toTitle(c.body)}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <span className={cn(
                          "text-[9px] font-bold border rounded px-1.5 py-0.5 tracking-wider",
                          SEV_CLS[c.severity]
                        )}>
                          {c.severity.charAt(0).toUpperCase() + c.severity.slice(1)}
                        </span>
                        <span className="text-[9px] font-semibold border border-bdr rounded px-1.5 py-0.5 text-t2 capitalize bg-page-bg">
                          {c.category}
                        </span>
                        {c.regulator_escalation && (
                          <span className="text-[9px] font-bold border border-err-bdr rounded px-1.5 py-0.5 text-err bg-err-bg uppercase">
                            {c.regulator_escalation}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* PATIENT */}
                    <div className="flex items-start gap-2 pr-2">
                      <InitialsAvatar name={patient?.demographic.full_name ?? c.complainant_name} size={28} />
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-t1 leading-tight truncate">
                          {patient?.demographic.full_name ?? c.complainant_name}
                        </div>
                        {c.patient_id && (
                          <div className="text-[10px] font-mono text-t3 mt-0.5">{c.patient_id}</div>
                        )}
                      </div>
                    </div>

                    {/* SLA */}
                    <div className="text-[11px] pr-2 flex flex-col gap-1 justify-start pt-0.5">
                      {/* ACK row */}
                      <div className={cn(
                        "flex items-center gap-1",
                        c.acknowledged_at ? "text-ok" : ackOverdue ? "text-err font-semibold" : "text-t3"
                      )}>
                        {c.acknowledged_at ? (
                          <><Check className="w-3 h-3 shrink-0" /><span>ACK &middot; within {ackWd} days</span></>
                        ) : ackOverdue ? (
                          <span>ACK: OVERDUE</span>
                        ) : (
                          <span>ACK due: {ackWd}d</span>
                        )}
                      </div>
                      {/* RESOLVE row */}
                      {c.status === "resolved" || c.status === "closed" ? (
                        <div className="text-ok flex items-center gap-1">
                          <Check className="w-3 h-3 shrink-0" /><span>Resolved</span>
                        </div>
                      ) : resolveOver !== null ? (
                        <div className="text-err font-bold">Breached &middot; {resolveOver}d over</div>
                      ) : resolveLeft !== null ? (
                        <div className={cn("font-semibold", resolveLeft <= 5 ? "text-warn" : "text-t2")}>
                          {resolveLeft}d left
                        </div>
                      ) : null}
                    </div>

                    {/* STATUS */}
                    <div className="flex items-start pt-0.5">
                      <StatusBadge value={c.status} kind="complaint" />
                    </div>

                    {/* OWNER */}
                    <div className="flex items-start gap-1.5 pr-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5"
                        style={{ backgroundColor: owner.color }}
                      >
                        {owner.initials}
                      </div>
                      <span className="text-[12px] text-t1">{owner.name}</span>
                    </div>

                    {/* LAST ACTIVITY */}
                    <div className="text-[11px] leading-snug pr-2 pt-0.5">
                      {c.status === "received" && !c.acknowledged_at ? (
                        <>
                          <span className="text-t2">Awaiting acknowledgement</span>
                          <span className="text-t3 block mt-0.5">Received {formatRelativeTime(c.received_at)}</span>
                        </>
                      ) : c.status === "acknowledged" ? (
                        <>
                          <span className="text-t2">Acknowledged</span>
                          {c.acknowledged_at && <span className="text-t3 block mt-0.5">{formatRelativeTime(c.acknowledged_at)}</span>}
                        </>
                      ) : c.status === "investigating" ? (
                        <>
                          <span className="text-t2">Under investigation</span>
                          {c.updated_at && <span className="text-t3 block mt-0.5">Updated {formatRelativeTime(c.updated_at)}</span>}
                        </>
                      ) : c.status === "resolved" ? (
                        <>
                          <span className="text-ok font-semibold">Resolved</span>
                          {c.resolved_at && <span className="text-t3 block mt-0.5">{formatRelativeTime(c.resolved_at)}</span>}
                        </>
                      ) : (
                        <span className="text-t3">Closed</span>
                      )}
                    </div>

                    {/* ACTIONS */}
                    <div
                      className="flex items-start gap-1.5 flex-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {mondayUrl && (
                        <a
                          href={mondayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold border border-bdr rounded-md text-t1 hover:border-brand hover:text-brand transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Intercom
                        </a>
                      )}
                      {isOpen && (
                        <button
                          onClick={(e) => handleResolve(e, c.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md bg-[#16a34a] text-white hover:bg-[#15803d] transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── KPI tile ──────────────────────────────────────────────────────────────────
function KpiTile({
  label, value, sub, border, numCls,
}: {
  label: string;
  value: number;
  sub: string;
  border?: "err" | "warn" | "ok";
  numCls?: string;
}) {
  const borderCls =
    border === "err"  ? "border-err-bdr bg-err-bg/20"  :
    border === "warn" ? "border-warn-bdr bg-warn-bg/30" :
    border === "ok"   ? "border-ok-bdr bg-ok-bg/30"    :
    "border-bdr bg-page-bg";

  return (
    <div className={cn("rounded-lg border px-4 py-3", borderCls)}>
      <div
        className="text-[9.5px] font-bold uppercase tracking-wider mb-1 text-t3"
        dangerouslySetInnerHTML={{ __html: label }}
      />
      <div className={cn("text-[28px] font-bold tabular-nums leading-none", numCls ?? "text-t1")}>
        {value}
      </div>
      <div className="text-[10px] text-t3 mt-1 leading-tight">{sub}</div>
    </div>
  );
}

// ── Initials avatar ───────────────────────────────────────────────────────────
function InitialsAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  const COLORS = [
    "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
    "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
  ];
  const color = COLORS[name.charCodeAt(0) % COLORS.length];

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}
