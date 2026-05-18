"use client";

import { format, parseISO, differenceInCalendarDays } from "date-fns";
import {
  Phone,
  Video,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  ExternalLink,
} from "lucide-react";
import type { CoachingLog, Patient, ClinicId, CalendlyBooking } from "@/types";
import { CoachingLogEntryModal } from "@/components/coaching/CoachingLogEntryModal";
import { useCurrentUser } from "@/lib/context";
import { canCoachAccessPatient } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface Props {
  patient: Patient;
  clinicId: ClinicId;
  logs: CoachingLog[];
  bookings?: CalendlyBooking[];
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

export function CoachingLogTab({ patient, clinicId, logs, bookings = [] }: Props) {
  const CURRENT_USER = useCurrentUser();
  const isCoach = CURRENT_USER.roles.includes("Coach");
  const canLog = isCoach && canCoachAccessPatient(CURRENT_USER, patient);

  return (
    <div className="p-6 flex flex-col gap-4">

      {/* ── Upcoming Calendly bookings (BLD-CALENDLY-MIRROR-01) ───────────── */}
      {bookings.length > 0 && (
        <div className="bg-surface border-l-[3px] border-l-[#006bff] border border-bdr rounded-lg overflow-hidden">
          <div className="flex items-center px-4 py-3 border-b border-bdr bg-page-bg">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-semibold text-t1">📅 Upcoming Calendly bookings</span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-info-bg text-info border border-info-bdr tracking-wide uppercase">
                  {bookings.length} scheduled
                </span>
              </div>
              <p className="text-[11px] text-t2 mt-0.5">Mirrored from Calendly via webhook · BLD-CALENDLY-MIRROR-01</p>
            </div>
            <span className="text-[11px] font-semibold text-brand shrink-0 cursor-default">
              Webhook config ↗
            </span>
          </div>

          <div className="p-4 space-y-2.5">
            {bookings.map((b, i) => {
              const dt = parseISO(b.scheduled_at);
              const dtEnd = parseISO(b.end_at);
              const isFirst = i === 0;
              const daysAway = differenceInCalendarDays(dt, new Date("2026-05-13"));
              const bookedAt = parseISO(b.booked_at);

              return (
                <div
                  key={b.id}
                  className={cn(
                    "flex items-start gap-3.5 px-3.5 py-3 rounded-lg border",
                    isFirst
                      ? "bg-info-bg border-info-bdr"
                      : "bg-page-bg border-bdr"
                  )}
                >
                  {/* Date badge */}
                  <div className={cn(
                    "rounded-lg px-3 py-2 text-center shrink-0 text-white font-semibold text-[11px] leading-tight",
                    isFirst ? "bg-[#006bff]" : "bg-slate-400"
                  )}>
                    <div className="text-[18px] font-black leading-none">{format(dt, "d")}</div>
                    <div className="mt-0.5 uppercase tracking-wide">{format(dt, "MMM")}</div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-t1">{b.event_type}</p>
                    <p className="text-[11px] text-t2 mt-0.5">
                      {format(dt, "EEE d MMM")} · {format(dt, "HH:mm")}–{format(dtEnd, "HH:mm")} BST · {b.coach_name} (Coach)
                    </p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <span className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-surface",
                        isFirst ? "text-info border-info-bdr" : "text-t2 border-bdr"
                      )}>
                        Calendly event · {b.calendly_event_id}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-surface text-t2 border-bdr">
                        {b.booking_method === "patient_self_booked" ? "Patient self-booked" : "Coach booked"}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-surface text-t2 border-bdr">
                        Booked {format(bookedAt, "d MMM HH:mm")}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {b.join_url && (
                      <a
                        href={b.join_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-[#006bff] hover:underline inline-flex items-center gap-1"
                      >
                        ↗ Join Calendly link
                      </a>
                    )}
                    <span className="text-[10px] text-t3">{daysAway}d away</span>
                  </div>
                </div>
              );
            })}

            {/* Webhook footer */}
            <div className="pt-2.5 border-t border-dashed border-bdr text-[10.5px] text-t3 leading-relaxed">
              Bookings synced live via Calendly webhook events:{" "}
              {["invitee.created", "invitee.canceled", "invitee_no_show.created"].map((e) => (
                <code key={e} className="text-[10px] bg-page-bg border border-bdr rounded px-1 py-px font-mono mx-0.5">{e}</code>
              ))}
              . Cancellations and no-shows automatically update this list. Coach writes a log entry below after each completed session.
            </div>
          </div>
        </div>
      )}

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
