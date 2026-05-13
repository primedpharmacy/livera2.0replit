"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, AlertTriangle, RefreshCw, AlertCircle,
  FileWarning, Building2, ExternalLink, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  updateIncidentStatus, submitYellowCard, notifyCQC,
  syncIncidentFromMonday, recordYellowCardDecision, CURRENT_USER
} from "@/lib/api/mock";
import { can } from "@/lib/permissions";
import type { Incident, Clinic, ClinicId } from "@/types";

interface Props {
  initialIncident: Incident;
  clinic: Clinic;
  clinicId: ClinicId;
}

interface Toast { message: string; type: "ok" | "err" }

const SEV_STYLES: Record<string, { banner: string; text: string }> = {
  mild: { banner: "bg-ok-bg border-ok-bdr", text: "text-ok" },
  moderate: { banner: "bg-warn-bg border-warn-bdr", text: "text-warn" },
  severe: { banner: "bg-err-bg border-err-bdr", text: "text-err" },
};

const TYPE_LABELS: Record<string, string> = {
  medication_error: "Medication error",
  adverse_event: "Adverse event",
  delayed_dispensing: "Delayed dispensing",
  wrong_dose: "Wrong dose",
  allergic_reaction: "Allergic reaction",
  near_miss: "Near miss",
  other: "Other",
};

const TRIGGER_LABELS: Record<string, string> = {
  system: "System",
  clinician: "Clinician",
  admin: "Admin",
  patient_report: "Patient report",
};

const YELLOW_CARD_TRIGGER_TYPES = new Set([
  'adverse_event', 'allergic_reaction'
]);

export function IncidentDetailClient({ initialIncident, clinic, clinicId }: Props) {
  const [incident, setIncident] = useState<Incident>(initialIncident);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // BLD-YC-01 — Yellow Card panel local state
  const [ycLocalDecision, setYcLocalDecision] = useState<'filed' | 'not_applicable' | null>(null);
  const [ycRef, setYcRef] = useState('');
  const [ycSaving, setYcSaving] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const canManage = can(CURRENT_USER, "write", "incidents");
  const sevStyle = SEV_STYLES[incident.severity] ?? SEV_STYLES.moderate;
  const triageText = clinic.config.incident_triage_text[incident.severity];
  const isSharedBoard = incident.monday_board_id === "18402056019";
  const isTerminal = incident.status === "resolved" || incident.status === "closed";

  // BLD-YC-01 — panel shows for severe incidents or allergy/adverse event types
  const showYellowCardPanel =
    incident.yellow_card_required ||
    incident.severity === 'severe' ||
    YELLOW_CARD_TRIGGER_TYPES.has(incident.incident_type);

  // Prescriber identity for Yellow Card attribution
  const ycPrescriberNmc = CURRENT_USER.professional_registrations?.find(
    (r) => r.body === 'NMC' || r.body === 'GPhC'
  )?.reg_number ?? null;

  async function handleStatusUpdate(status: Incident["status"]) {
    setIsActing(true);
    try {
      const updated = await updateIncidentStatus(clinicId, incident.id, status);
      setIncident(updated);
      setToast({ message: `Status updated to ${status.replace("_", " ")}`, type: "ok" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed", type: "err" });
    } finally {
      setIsActing(false);
    }
  }

  async function handleYcSave() {
    if (!ycLocalDecision) return;
    if (ycLocalDecision === 'filed' && !ycRef.trim()) return;
    setYcSaving(true);
    try {
      const updated = await recordYellowCardDecision(
        clinicId,
        incident.id,
        ycLocalDecision,
        ycLocalDecision === 'filed' ? ycRef.trim() : undefined
      );
      setIncident(updated);
      setToast({
        message: ycLocalDecision === 'filed'
          ? `Yellow Card filed — ref ${updated.yellow_card_reference}`
          : 'Recorded: Yellow Card not applicable for this incident',
        type: "ok"
      });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to save decision", type: "err" });
    } finally {
      setYcSaving(false);
    }
  }

  async function handleNotifyCQC() {
    setIsActing(true);
    try {
      const updated = await notifyCQC(clinicId, incident.id);
      setIncident(updated);
      setToast({ message: "CQC notified", type: "ok" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed", type: "err" });
    } finally {
      setIsActing(false);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      const updated = await syncIncidentFromMonday(clinicId, incident.id);
      setIncident(updated);
      setToast({ message: "Synced from Monday.com", type: "ok" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Sync failed", type: "err" });
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="relative">
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg text-white",
          toast.type === "ok" ? "bg-ok" : "bg-err"
        )}>
          {toast.message}
        </div>
      )}

      {/* Top bar */}
      <div className="border-b border-bdr px-6 py-3 flex items-center gap-3 bg-surface">
        <Link href={`/${clinicId}/incidents`} className="text-t3 hover:text-t1 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <AlertTriangle className="w-4 h-4 text-brand shrink-0" />
          <span className="font-mono text-[13px] font-bold text-t1">{incident.id}</span>
          <StatusBadge value={incident.status} kind="incident" />
        </div>
        {incident.sync_status !== "in_sync" && (
          <Button size="sm" variant="outline" onClick={handleSync} disabled={isSyncing} className="h-7 text-[12px] gap-1.5">
            <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
            Resync
          </Button>
        )}
      </div>

      {/* Severity banner */}
      <div className={cn("mx-6 mt-4 border rounded-lg px-4 py-3", sevStyle.banner)}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={cn("w-4 h-4 shrink-0 mt-0.5", sevStyle.text)} />
          <div>
            <p className={cn("text-[13px] font-semibold", sevStyle.text)}>
              {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)} severity
              {" — "}{TYPE_LABELS[incident.incident_type] ?? incident.incident_type}
            </p>
            <p className="text-[12px] text-t2 mt-0.5">{triageText}</p>
          </div>
        </div>
      </div>

      {incident.sync_status !== "in_sync" && (
        <div className="mx-6 mt-3 flex items-start gap-3 bg-warn-bg border border-warn-bdr rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
          <p className="text-[13px] text-warn">
            Monday.com record is out of sync. Click Resync to pull the latest data.
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 px-6 py-4">
        <div className="col-span-2 space-y-4">

          {/* Description */}
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Description</h3>
            <p className="text-[13px] text-t1 leading-relaxed whitespace-pre-wrap">{incident.description}</p>
          </div>

          {/* BLD-YC-01 — MHRA Yellow Card panel */}
          {showYellowCardPanel && (
            <div className={cn(
              "border rounded-lg p-4",
              incident.yellow_card_decision === 'filed'
                ? "bg-ok-bg border-ok-bdr"
                : incident.yellow_card_decision === 'not_applicable'
                ? "bg-surface border-bdr"
                : "bg-warn-bg border-warn-bdr"
            )}>
              {/* Panel header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileWarning className={cn(
                    "w-4 h-4",
                    incident.yellow_card_decision === 'filed' ? "text-ok"
                    : incident.yellow_card_decision === 'not_applicable' ? "text-t3"
                    : "text-warn"
                  )} />
                  <h3 className="text-[12px] font-bold text-t1">MHRA Yellow Card</h3>
                </div>
                <span className={cn(
                  "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                  incident.yellow_card_decision === 'filed'
                    ? "bg-ok/10 text-ok"
                    : incident.yellow_card_decision === 'not_applicable'
                    ? "bg-t3/10 text-t2"
                    : "bg-warn/10 text-warn"
                )}>
                  {incident.yellow_card_decision === 'filed'
                    ? 'Filed'
                    : incident.yellow_card_decision === 'not_applicable'
                    ? 'Not applicable'
                    : 'Decision required'}
                </span>
              </div>

              <p className="text-[12px] text-t2 mb-4">
                This incident is flagged for MHRA Yellow Card assessment due to its severity or type.
                The responsible prescriber must record a decision below.
              </p>

              {/* Filed — read-only state */}
              {incident.yellow_card_decision === 'filed' && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-ok shrink-0" />
                    <span className="text-[12px] text-t2">Reference:</span>
                    <span className="font-mono text-[12px] text-t1 font-semibold">
                      {incident.yellow_card_reference ?? '—'}
                    </span>
                    <a
                      href="https://yellowcard.mhra.gov.uk/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
                    >
                      MHRA portal <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[11px] text-t3">
                    Filed by {CURRENT_USER.full_name}
                    {ycPrescriberNmc ? ` · ${ycPrescriberNmc}` : ''}
                  </p>
                </div>
              )}

              {/* Not applicable — read-only state */}
              {incident.yellow_card_decision === 'not_applicable' && (
                <p className="text-[12px] text-t2">
                  Confirmed not applicable. Clinical judgement: Yellow Card not required for this incident.
                </p>
              )}

              {/* Decision required — interactive */}
              {incident.yellow_card_decision === null && (
                canManage ? (
                  <div className="space-y-3">
                    {/* Option: Filed */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name={`yc_decision_${incident.id}`}
                        value="filed"
                        checked={ycLocalDecision === 'filed'}
                        onChange={() => setYcLocalDecision('filed')}
                        className="mt-0.5 accent-warn"
                      />
                      <div>
                        <p className="text-[12px] font-medium text-t1 group-hover:text-brand transition-colors">
                          Filed with MHRA
                        </p>
                        <p className="text-[11px] text-t2">
                          A Yellow Card report has been submitted via the MHRA portal
                        </p>
                      </div>
                    </label>

                    {/* Reference input — visible when 'filed' selected */}
                    {ycLocalDecision === 'filed' && (
                      <div className="ml-6 space-y-2">
                        <div>
                          <label className="block text-[11px] text-t3 mb-1">Yellow Card reference number</label>
                          <input
                            type="text"
                            placeholder="e.g. MHRA-2026-012345"
                            value={ycRef}
                            onChange={(e) => setYcRef(e.target.value)}
                            className="w-full text-[12px] border border-bdr rounded-md px-2.5 py-1.5 bg-surface font-mono focus:outline-none focus:ring-1 focus:ring-brand"
                            autoFocus
                          />
                        </div>
                        <a
                          href="https://yellowcard.mhra.gov.uk/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] text-brand hover:underline"
                        >
                          Open MHRA Yellow Card portal <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Option: Not applicable */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name={`yc_decision_${incident.id}`}
                        value="not_applicable"
                        checked={ycLocalDecision === 'not_applicable'}
                        onChange={() => setYcLocalDecision('not_applicable')}
                        className="mt-0.5 accent-warn"
                      />
                      <div>
                        <p className="text-[12px] font-medium text-t1 group-hover:text-brand transition-colors">
                          Not applicable
                        </p>
                        <p className="text-[11px] text-t2">
                          Clinical judgement: Yellow Card not required for this incident
                        </p>
                      </div>
                    </label>

                    {/* Prescriber identity + confirm */}
                    <div className="flex items-center justify-between pt-2 border-t border-bdr/60 mt-1">
                      <p className="text-[11px] text-t3">
                        Recording as: {CURRENT_USER.full_name}
                        {ycPrescriberNmc ? ` · ${ycPrescriberNmc}` : ''}
                      </p>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={handleYcSave}
                        disabled={
                          ycSaving ||
                          !ycLocalDecision ||
                          (ycLocalDecision === 'filed' && !ycRef.trim())
                        }
                        className="h-7 text-[12px]"
                      >
                        {ycSaving ? 'Saving…' : 'Confirm decision'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px] text-t2">Awaiting prescriber decision.</p>
                )
              )}
            </div>
          )}

          {/* CQC notification */}
          {incident.cqc_notification_required && (
            <div className={cn(
              "border rounded-lg p-4",
              incident.cqc_notified_at ? "bg-ok-bg border-ok-bdr" : "bg-err-bg border-err-bdr"
            )}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className={cn("w-4 h-4", incident.cqc_notified_at ? "text-ok" : "text-err")} />
                  <h3 className="text-[12px] font-bold text-t1">CQC Notification (Regulation 18)</h3>
                </div>
                <span className={cn("text-[11px] font-semibold", incident.cqc_notified_at ? "text-ok" : "text-err")}>
                  {incident.cqc_notified_at ? "Notified" : "Required"}
                </span>
              </div>
              {incident.cqc_notified_at ? (
                <p className="text-[12px] text-t2">CQC notified: {formatDateTime(incident.cqc_notified_at)}</p>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-[12px] text-t2">CQC must be notified under Regulation 18.</p>
                  {canManage && (
                    <Button size="sm" variant="outline" onClick={handleNotifyCQC} disabled={isActing} className="h-7 text-[12px]">
                      Notify CQC
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Resolution notes */}
          {incident.resolution_notes && (
            <div className="bg-surface border border-bdr rounded-lg p-4">
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-2">Resolution notes</h3>
              <p className="text-[13px] text-t1 leading-relaxed whitespace-pre-wrap">{incident.resolution_notes}</p>
            </div>
          )}

          {/* Status update actions */}
          {canManage && !isTerminal && (
            <div className="bg-surface border border-bdr rounded-lg p-4">
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Update status</h3>
              <div className="flex gap-2 flex-wrap">
                {(["investigating", "on_hold", "resolved", "closed"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate(s)}
                    disabled={isActing || incident.status === s}
                    className="h-7 text-[12px] capitalize"
                  >
                    Mark {s.replace("_", " ")}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Incident details</h3>
            <dl className="space-y-2">
              {([
                ["Type", TYPE_LABELS[incident.incident_type] ?? incident.incident_type],
                ["Triggered by", TRIGGER_LABELS[incident.triggered_by] ?? incident.triggered_by],
                ["Reported", formatDateTime(incident.reported_at)],
                ["Patient ID", incident.patient_id ?? "—"],
                ["Order", incident.order_id ?? "—"],
                ["Consultation", incident.consultation_id ?? "—"],
                ["Escalated to", incident.escalated_to_user_id ?? "—"],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex flex-col text-[12px] gap-0.5">
                  <dt className="text-t3">{k}</dt>
                  <dd className="text-t1 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={cn(
            "border rounded-lg p-4",
            incident.sync_status === "in_sync" ? "bg-ok-bg border-ok-bdr" : "bg-warn-bg border-warn-bdr"
          )}>
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-1">Monday.com</h3>
            <p className={cn(
              "text-[12px] font-semibold mb-1",
              incident.sync_status === "in_sync" ? "text-ok" : "text-warn"
            )}>
              {incident.sync_status === "in_sync" ? "In sync" : "Out of sync"}
            </p>
            <p className="text-[11px] text-t3">Board: {incident.monday_board_id}</p>
            {incident.monday_item_id && (
              <p className="text-[11px] text-t3">Item: {incident.monday_item_id}</p>
            )}
            {isSharedBoard && (
              <p className="text-[10px] text-warn mt-1.5 font-medium">DEC-29: VSC and FeelTru share this board</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
