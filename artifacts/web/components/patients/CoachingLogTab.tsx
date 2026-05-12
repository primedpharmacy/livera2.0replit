import { format, parseISO } from "date-fns";
import {
  Phone,
  Video,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
} from "lucide-react";
import type { CoachingLog, Patient, ClinicId } from "@/types";
import { CoachingLogEntryModal } from "@/components/coaching/CoachingLogEntryModal";
import { CURRENT_USER } from "@/lib/api/mock";
import { canCoachAccessPatient } from "@/lib/permissions";

interface Props {
  patient: Patient;
  clinicId: ClinicId;
  logs: CoachingLog[];
}

const MODALITY_ICON = {
  phone: Phone,
  video: Video,
  chat: MessageSquare,
};

const STATUS_CONFIG = {
  completed: { icon: CheckCircle2, cls: "text-ok", label: "Completed" },
  no_show:   { icon: XCircle,      cls: "text-warn", label: "No show" },
  cancelled: { icon: XCircle,      cls: "text-t3",   label: "Cancelled" },
  scheduled: { icon: Clock,        cls: "text-info",  label: "Scheduled" },
};

const ENTRY_TYPE_LABEL: Record<string, string> = {
  initial_call: "Initial call",
  check_in:     "Check-in",
  escalation:   "Escalation",
  note:         "Note",
};

const ENTRY_TYPE_BADGE: Record<string, string> = {
  initial_call: "bg-info-bg text-info border-info-bdr",
  check_in:     "bg-ok-bg text-ok border-ok-bdr",
  escalation:   "bg-err-bg text-err border-err-bdr",
  note:         "bg-slate-100 text-t2 border-bdr",
};

export function CoachingLogTab({ patient, clinicId, logs }: Props) {
  const isCoach = CURRENT_USER.roles.includes("Coach");
  const canLog = isCoach && canCoachAccessPatient(CURRENT_USER, patient);

  return (
    <div className="p-6 flex flex-col gap-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-t1">Coaching log</h2>
          <p className="text-xs text-t2 mt-0.5">
            {logs.length} {logs.length === 1 ? "entry" : "entries"} recorded
          </p>
        </div>
        {canLog && (
          <CoachingLogEntryModal
            clinicId={clinicId}
            patientId={patient.id}
            patientName={patient.demographic.full_name}
          />
        )}
      </div>

      {/* Log entries */}
      {logs.length === 0 ? (
        <div className="py-12 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
            <FileText className="w-6 h-6 text-t3" />
          </div>
          <div>
            <p className="text-sm font-medium text-t1">No coaching log entries yet</p>
            <p className="text-xs text-t2 mt-1">
              {canLog
                ? "Use the button above to add the first entry."
                : "Coaching log entries will appear here once the coach has made contact."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((log) => {
            const StatusIcon = STATUS_CONFIG[log.status]?.icon ?? Clock;
            const statusCls  = STATUS_CONFIG[log.status]?.cls ?? "text-t3";
            const statusLabel = STATUS_CONFIG[log.status]?.label ?? log.status;
            const ModalityIcon = log.modality ? MODALITY_ICON[log.modality] : null;
            const typeBadgeCls = ENTRY_TYPE_BADGE[log.entry_type] ?? "bg-slate-100 text-t2 border-bdr";

            return (
              <div
                key={log.id}
                className="bg-surface border border-bdr rounded-lg overflow-hidden"
              >
                {/* Log header */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-page-bg border-b border-bdr flex-wrap">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded border ${typeBadgeCls}`}
                  >
                    {ENTRY_TYPE_LABEL[log.entry_type] ?? log.entry_type}
                  </span>

                  <span className="text-[12px] font-semibold text-t1">
                    {format(parseISO(log.entry_date), "EEE d MMM yyyy · HH:mm")}
                  </span>

                  {log.scheduled_date && (
                    <span className="text-[11px] text-t3">
                      (scheduled {format(parseISO(log.scheduled_date), "d MMM · HH:mm")})
                    </span>
                  )}

                  <span className="ml-auto flex items-center gap-1.5 text-[11px]">
                    <StatusIcon className={`w-3.5 h-3.5 ${statusCls}`} />
                    <span className={statusCls}>{statusLabel}</span>
                  </span>

                  {ModalityIcon && (
                    <span className="flex items-center gap-1 text-[11px] text-t3">
                      <ModalityIcon className="w-3.5 h-3.5" />
                      {log.modality}
                    </span>
                  )}

                  {log.duration_minutes !== null && (
                    <span className="text-[11px] text-t3">{log.duration_minutes} min</span>
                  )}

                  {log.clinical_escalation_flag_id && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-err bg-err-bg border border-err-bdr px-1.5 py-px rounded">
                      <AlertTriangle className="w-3 h-3" />
                      Flag raised
                    </span>
                  )}
                </div>

                {/* Summary */}
                <div className="px-4 py-3 space-y-2">
                  <p className="text-[13px] text-t1 leading-relaxed">{log.summary}</p>

                  {log.next_action && (
                    <div className="mt-2 pt-2 border-t border-bdr">
                      <p className="text-[11px] font-bold text-t3 uppercase tracking-wide mb-1">
                        Next action
                      </p>
                      <p className="text-[12px] text-t2">{log.next_action}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
