"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Download, X } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { NOW } from "@/lib/api/constants";
import { cn } from "@/lib/utils";
import type { Incident, Patient, Clinic, ClinicId, IncidentType, IncidentSeverity } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  medication_error:   "Medication error",
  adverse_event:      "Adverse event",
  delayed_dispensing: "Delayed dispensing",
  wrong_dose:         "Wrong dose",
  allergic_reaction:  "Allergic reaction",
  near_miss:          "Near miss",
  other:              "Other",
};

const ORIGIN_LABELS: Record<string, string> = {
  intercom_tag:    "INTERCOM",
  manual:          "MANUAL",
  coach_escalation:"COACH",
  system_severe_se:"SYSTEM",
};
const ORIGIN_CLS: Record<string, string> = {
  intercom_tag:    "bg-[#eef2ff] text-[#4338ca] border-[#c7d2fe]",
  manual:          "bg-[#f9fafb] text-[#374151] border-[#d1d5db]",
  coach_escalation:"bg-[#f5f3ff] text-[#6d28d9] border-[#ddd6fe]",
  system_severe_se:"bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]",
};

const SEV_CLS: Record<string, string> = {
  mild:     "bg-ok-bg text-ok border border-ok-bdr",
  moderate: "bg-warn-bg text-warn border border-warn-bdr",
  severe:   "bg-err-bg text-err border border-err-bdr",
};

function incidentAge(reported_at: string, now: number): string {
  const diff = now - new Date(reported_at).getTime();
  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor(diff / 3_600_000);
  if (days >= 1) return `${days}d`;
  if (hours >= 1) return `${hours}h`;
  return "<1h";
}

// ── Filter types ──────────────────────────────────────────────────────────────
type FilterTab = "all" | "open" | "resolved" | "severe" | "moderate" | "mild";
type OriginFilter = "all" | "intercom_tag" | "manual" | "coach_escalation";
type RangeFilter  = "7d" | "30d" | "90d";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all",      label: "All"      },
  { key: "open",     label: "Open"     },
  { key: "resolved", label: "Resolved" },
  { key: "severe",   label: "Severe"   },
  { key: "moderate", label: "Moderate" },
  { key: "mild",     label: "Mild"     },
];

const RANGE_DAYS: Record<RangeFilter, number> = { "7d": 7, "30d": 30, "90d": 90 };

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  initialIncidents: Incident[];
  patients: Patient[];
  clinicId: ClinicId;
  clinic: Clinic;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function IncidentsView({ initialIncidents, patients, clinicId }: Props) {
  const router = useRouter();

  // local state (allows "Create incident" to add rows without server round-trip)
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [activeTab,    setActiveTab]    = useState<FilterTab>("all");
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [rangeFilter,  setRangeFilter]  = useState<RangeFilter>("30d");
  const [showCreate,   setShowCreate]   = useState(false);

  const now        = new Date(NOW).getTime();
  const patientMap = useMemo(
    () => Object.fromEntries(patients.map((p) => [p.id, p])),
    [patients]
  );

  // ── KPI computations ───────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const thirtyDayMs = 30 * 86_400_000;
    const severe   = incidents.filter((i) => i.severity === "severe");
    const moderate = incidents.filter((i) => i.severity === "moderate");
    const mild     = incidents.filter((i) => i.severity === "mild");
    const resolvedMonth = incidents.filter(
      (i) => i.status === "resolved" && now - new Date(i.created_at).getTime() < thirtyDayMs
    );
    const autoMonday = incidents.filter((i) => i.severity === "severe" && i.monday_item_id !== null);

    const latestSevere = [...severe].sort((a, b) => b.reported_at.localeCompare(a.reported_at))[0];
    const latestSevereName = latestSevere?.patient_id
      ? (patientMap[latestSevere.patient_id]?.demographic.full_name ?? latestSevere.patient_id)
      : null;

    const mondayPct = severe.length > 0
      ? Math.round((autoMonday.length / severe.length) * 100)
      : 0;

    const openCount = incidents.filter((i) => i.status === "open").length;

    return {
      openCount,
      severeCount:   severe.length,
      latestSevereName,
      moderateCount: moderate.length,
      mildCount:     mild.length,
      resolvedMonth: resolvedMonth.length,
      autoMonday:    autoMonday.length,
      mondayPct,
    };
  }, [incidents, now, patientMap]);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const rangeCutoff = now - RANGE_DAYS[rangeFilter] * 86_400_000;
    return incidents.filter((i) => {
      // date range
      if (new Date(i.reported_at).getTime() < rangeCutoff) return false;
      // origin
      if (originFilter !== "all" && i.incident_origin !== originFilter) return false;
      // tab (status or severity)
      if (activeTab === "all")      return true;
      if (activeTab === "open")     return i.status === "open";
      if (activeTab === "resolved") return i.status === "resolved";
      if (activeTab === "severe")   return i.severity === "severe";
      if (activeTab === "moderate") return i.severity === "moderate";
      if (activeTab === "mild")     return i.severity === "mild";
      return true;
    });
  }, [incidents, activeTab, originFilter, rangeFilter, now]);

  // Tab counts
  const tabCounts: Record<FilterTab, number> = useMemo(() => ({
    all:      incidents.length,
    open:     incidents.filter((i) => i.status === "open").length,
    resolved: incidents.filter((i) => i.status === "resolved").length,
    severe:   incidents.filter((i) => i.severity === "severe").length,
    moderate: incidents.filter((i) => i.severity === "moderate").length,
    mild:     incidents.filter((i) => i.severity === "mild").length,
  }), [incidents]);

  return (
    <div>
      {/* ── Sub-header + KPI tiles ─────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-bdr bg-surface">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-[13px] font-semibold text-t2">
              {kpi.openCount} open &middot;{" "}
              <span className="text-t3 font-normal">{kpi.resolvedMonth} resolved this month</span>
            </p>
            <p className="text-[11px] text-t3 mt-0.5">
              Patient safety, clinical, and operational incidents.
              Severe incidents auto-write to Monday safety board.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {}}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md border border-bdr bg-surface text-t1 hover:border-brand hover:text-brand transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md bg-brand text-white hover:bg-brand/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create incident
            </button>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-5 gap-3">
          <KpiTile
            label="Severe"
            value={kpi.severeCount}
            sub={kpi.latestSevereName ? `Latest: ${kpi.latestSevereName}` : "None recorded"}
            accent="err"
          />
          <KpiTile
            label="Moderate"
            value={kpi.moderateCount}
            sub="In progress"
            accent={kpi.moderateCount > 0 ? "warn" : undefined}
          />
          <KpiTile
            label="Mild / Informational"
            value={kpi.mildCount}
            sub="Logged for record"
          />
          <KpiTile
            label="Resolved this month"
            value={kpi.resolvedMonth}
            sub="Avg time to resolve: 3.2 days"
            accent={kpi.resolvedMonth > 0 ? "ok" : undefined}
          />
          <KpiTile
            label="Auto-written to Monday"
            value={kpi.autoMonday}
            sub={`Of ${kpi.severeCount} severe (${kpi.mondayPct}%)`}
          />
        </div>
      </div>

      {/* ── Filter tabs + dropdowns ────────────────────────────────────────── */}
      <div className="px-6 py-2.5 border-b border-bdr bg-surface flex items-center justify-between gap-3 flex-wrap">
        {/* Status / severity tabs */}
        <div className="flex items-center gap-0.5">
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

        {/* Dropdown filters */}
        <div className="flex items-center gap-2">
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as OriginFilter)}
            className="text-[12px] border border-bdr rounded-md px-2 py-1 bg-surface text-t1 focus:outline-none focus:border-brand"
          >
            <option value="all">Origin: All</option>
            <option value="intercom_tag">Intercom</option>
            <option value="manual">Manual</option>
            <option value="coach_escalation">Coach escalation</option>
          </select>
          <select
            value={rangeFilter}
            onChange={(e) => setRangeFilter(e.target.value as RangeFilter)}
            className="text-[12px] border border-bdr rounded-md px-2 py-1 bg-surface text-t1 focus:outline-none focus:border-brand"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4">
        {filtered.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="No incidents found" description="Try adjusting the filters." />
        ) : (
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[160px_1fr_170px_100px_110px_56px] bg-page-bg px-4 py-2.5 border-b border-bdr">
              {["ID", "Title & Links", "Patient", "Severity", "Status", "Age"].map((h) => (
                <span key={h} className="text-[10px] font-bold uppercase tracking-wider text-t3">{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-bdr">
              {filtered.map((incident) => {
                const patient = incident.patient_id ? patientMap[incident.patient_id] : null;
                const age     = incidentAge(incident.reported_at, now);
                const isUrgent = incident.severity === "severe" && incident.status === "open";

                return (
                  <div
                    key={incident.id}
                    onClick={() => router.push(`/${clinicId}/incidents/${incident.id}`)}
                    className={cn(
                      "grid grid-cols-[160px_1fr_170px_100px_110px_56px] px-4 py-3 cursor-pointer transition-colors",
                      isUrgent ? "bg-err-bg/30 hover:bg-err-bg/50" : "hover:bg-brand-light/40"
                    )}
                  >
                    {/* ID + origin */}
                    <div className="flex flex-col gap-1.5 pr-2">
                      <span className="font-mono text-[12px] font-bold text-brand leading-none">
                        {incident.id}
                      </span>
                      <span className={cn(
                        "self-start text-[9px] font-bold border rounded px-1.5 py-0.5 tracking-wider",
                        ORIGIN_CLS[incident.incident_origin] ?? ORIGIN_CLS.manual
                      )}>
                        {ORIGIN_LABELS[incident.incident_origin] ?? incident.incident_origin.toUpperCase()}
                      </span>
                      {/* Action flags */}
                      <div className="flex flex-wrap gap-1">
                        {incident.yellow_card_required && !incident.yellow_card_submitted && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-warn-bg text-warn border border-warn-bdr">YC pending</span>
                        )}
                        {incident.cqc_notification_required && !incident.cqc_notified_at && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-err-bg text-err border border-err-bdr">CQC</span>
                        )}
                      </div>
                    </div>

                    {/* Title + links */}
                    <div className="pr-4">
                      <p className="text-[12.5px] text-t1 line-clamp-2 leading-snug">
                        {incident.description}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {incident.order_id && (
                          <span
                            onClick={(e) => { e.stopPropagation(); router.push(`/${clinicId}/orders/${incident.order_id}`); }}
                            className="text-[11px] text-brand hover:underline cursor-pointer"
                          >
                            {incident.order_id}
                          </span>
                        )}
                        {incident.intercom_thread_url && (
                          <a
                            href={incident.intercom_thread_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-brand hover:underline"
                          >
                            Intercom thread
                          </a>
                        )}
                        {incident.patient_id && (
                          <span
                            onClick={(e) => { e.stopPropagation(); router.push(`/${clinicId}/patients/${incident.patient_id}`); }}
                            className="text-[11px] text-t3 hover:text-brand hover:underline cursor-pointer font-mono"
                          >
                            {incident.patient_id}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Patient */}
                    <div className="flex flex-col justify-center">
                      {patient ? (
                        <>
                          <span className="text-[12px] font-medium text-t1 leading-tight">
                            {patient.demographic.full_name}
                          </span>
                          <span className="text-[10px] text-t3 uppercase mt-0.5">{incident.clinic_id}</span>
                        </>
                      ) : (
                        <span className="text-[12px] text-t3 italic">Unknown</span>
                      )}
                    </div>

                    {/* Severity */}
                    <div className="flex items-center">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap",
                        SEV_CLS[incident.severity]
                      )}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
                        {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex items-center">
                      <StatusBadge value={incident.status} kind="incident" />
                    </div>

                    {/* Age */}
                    <div className="flex items-center">
                      <span className={cn(
                        "text-[12px] tabular-nums",
                        isUrgent ? "text-err font-semibold" : "text-t2"
                      )}>
                        {age}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Create incident modal ──────────────────────────────────────────── */}
      {showCreate && (
        <CreateIncidentModal
          clinicId={clinicId}
          onClose={() => setShowCreate(false)}
          onSave={(incident) => {
            setIncidents((prev) => [incident, ...prev]);
            setShowCreate(false);
          }}
          nextId={`INC-${String(incidents.length + 10).padStart(3, "0")}`}
        />
      )}
    </div>
  );
}

// ── KPI tile ──────────────────────────────────────────────────────────────────
function KpiTile({
  label, value, sub, accent,
}: {
  label: string;
  value: number;
  sub: string;
  accent?: "err" | "warn" | "ok";
}) {
  const numCls =
    accent === "err"  ? "text-err"  :
    accent === "warn" ? "text-warn" :
    accent === "ok"   ? "text-ok"   : "text-t1";

  return (
    <div className="rounded-lg border border-bdr bg-page-bg px-4 py-3">
      <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-1", accent ? numCls : "text-t3")}>
        {label}
      </div>
      <div className={cn("text-[28px] font-bold tabular-nums leading-none", numCls)}>
        {value}
      </div>
      <div className="text-[10px] text-t3 mt-1 leading-tight">{sub}</div>
    </div>
  );
}

// ── Create incident modal ─────────────────────────────────────────────────────
function CreateIncidentModal({
  clinicId, onClose, onSave, nextId,
}: {
  clinicId: ClinicId;
  onClose: () => void;
  onSave: (i: Incident) => void;
  nextId: string;
}) {
  const [incidentType, setIncidentType] = useState<IncidentType>("adverse_event");
  const [severity,     setSeverity]     = useState<IncidentSeverity>("mild");
  const [description,  setDescription]  = useState("");
  const [patientId,    setPatientId]    = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;

    const newIncident: Incident = {
      id: nextId,
      clinic_id: clinicId,
      patient_id: patientId.trim() || null,
      order_id: null,
      consultation_id: null,
      incident_type: incidentType,
      severity,
      description: description.trim(),
      status: "open",
      triggered_by: "clinician",
      reported_at: new Date().toISOString(),
      monday_board_id: "18402056019",
      monday_item_id: null,
      yellow_card_required: severity === "severe",
      yellow_card_submitted: false,
      yellow_card_reference: null,
      yellow_card_decision: null,
      cqc_notification_required: severity === "severe",
      cqc_notified_at: null,
      escalated_to_user_id: null,
      resolution_notes: null,
      sync_status: "out_of_sync",
      created_at: new Date().toISOString(),
      intercom_thread_url: null,
      incident_origin: "manual",
    };
    onSave(newIncident);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-surface rounded-xl shadow-2xl border border-bdr mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bdr">
          <h2 className="text-[15px] font-bold text-t1">Create incident</h2>
          <button onClick={onClose} className="text-t3 hover:text-t1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-t3 uppercase tracking-wider block mb-1">
                Type
              </label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                className="w-full text-[13px] border border-bdr rounded-md px-2.5 py-1.5 bg-page-bg text-t1 focus:outline-none focus:border-brand"
              >
                <option value="adverse_event">Adverse event</option>
                <option value="medication_error">Medication error</option>
                <option value="delayed_dispensing">Delayed dispensing</option>
                <option value="wrong_dose">Wrong dose</option>
                <option value="allergic_reaction">Allergic reaction</option>
                <option value="near_miss">Near miss</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-t3 uppercase tracking-wider block mb-1">
                Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                className="w-full text-[13px] border border-bdr rounded-md px-2.5 py-1.5 bg-page-bg text-t1 focus:outline-none focus:border-brand"
              >
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-t3 uppercase tracking-wider block mb-1">
              Patient ID (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. PT-00198"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full text-[13px] border border-bdr rounded-md px-2.5 py-1.5 bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-t3 uppercase tracking-wider block mb-1">
              Description *
            </label>
            <textarea
              rows={4}
              placeholder="Describe what happened, any immediate actions taken, and clinical context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full text-[13px] border border-bdr rounded-md px-2.5 py-1.5 bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand resize-none"
            />
          </div>

          {severity === "severe" && (
            <p className="text-[11px] text-err font-medium bg-err-bg border border-err-bdr rounded-md px-3 py-2">
              Severe incidents auto-write to the Monday safety board and may require a Yellow Card + CQC notification.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-[12px] font-semibold border border-bdr rounded-md text-t2 hover:text-t1 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!description.trim()}
              className="px-4 py-1.5 text-[12px] font-semibold rounded-md bg-brand text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Log incident
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
