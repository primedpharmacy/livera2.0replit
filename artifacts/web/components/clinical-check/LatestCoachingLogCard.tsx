import { format, parseISO } from "date-fns";
import Link from "next/link";
import { BookOpen, Phone, Video, MessageSquare, AlertTriangle } from "lucide-react";
import type { CoachingLog, ClinicId } from "@/types";

interface Props {
  patientId: string;
  patientName: string;
  clinicId: ClinicId;
  logs: CoachingLog[];
}

const MODALITY_ICON = {
  phone: Phone,
  video: Video,
  chat: MessageSquare,
};

const ENTRY_TYPE_LABEL: Record<string, string> = {
  initial_call: "Initial call",
  check_in:     "Check-in",
  escalation:   "Escalation",
  note:         "Note",
};

const ENTRY_TYPE_CLS: Record<string, string> = {
  initial_call: "bg-info-bg text-info border-info-bdr",
  check_in:     "bg-ok-bg text-ok border-ok-bdr",
  escalation:   "bg-err-bg text-err border-err-bdr",
  note:         "bg-slate-100 text-t2 border-bdr",
};

export function LatestCoachingLogCard({ patientId, patientName, clinicId, logs }: Props) {
  if (logs.length === 0) return null;

  const recent = logs.slice(0, 2);

  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-page-bg border-b border-bdr">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-coach" />
          <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider">
            Coaching context
          </h3>
          <span className="text-[10px] font-bold text-coach bg-coach-bg border border-coach-bdr px-1.5 py-px rounded">
            {patientName}
          </span>
        </div>
        <Link
          href={`/${clinicId}/patients/${patientId}?tab=coaching`}
          className="text-[11px] text-brand hover:underline"
        >
          View full log →
        </Link>
      </div>

      <div className="divide-y divide-bdr">
        {recent.map((log) => {
          const ModalityIcon = log.modality ? MODALITY_ICON[log.modality] : null;
          const typeCls = ENTRY_TYPE_CLS[log.entry_type] ?? "bg-slate-100 text-t2 border-bdr";
          const SUMMARY_LIMIT = 150;
          const truncated = log.summary.length > SUMMARY_LIMIT;
          const summary = truncated
            ? log.summary.slice(0, SUMMARY_LIMIT) + "…"
            : log.summary;

          return (
            <div key={log.id} className="px-4 py-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-bold px-1.5 py-px rounded border ${typeCls}`}
                >
                  {ENTRY_TYPE_LABEL[log.entry_type] ?? log.entry_type}
                </span>
                <span className="text-[11px] font-medium text-t1">
                  {format(parseISO(log.entry_date), "EEE d MMM yyyy · HH:mm")}
                </span>
                {ModalityIcon && (
                  <span className="flex items-center gap-1 text-[11px] text-t3">
                    <ModalityIcon className="w-3 h-3" />
                    {log.modality}
                  </span>
                )}
                {log.duration_minutes !== null && (
                  <span className="text-[11px] text-t3">{log.duration_minutes} min</span>
                )}
                {log.clinical_escalation_flag_id && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-err">
                    <AlertTriangle className="w-3 h-3" />
                    Flag raised
                  </span>
                )}
              </div>
              <p className="text-[12px] text-t2 leading-relaxed">
                {summary}
                {truncated && (
                  <Link
                    href={`/${clinicId}/patients/${patientId}?tab=coaching`}
                    className="text-brand hover:underline ml-1"
                  >
                    Read more
                  </Link>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
