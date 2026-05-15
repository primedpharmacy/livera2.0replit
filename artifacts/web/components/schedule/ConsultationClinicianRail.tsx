"use client";

import { Calendar, Clock, Video, Phone, ShieldCheck, MicOff, VideoOff } from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { TYPE_CONFIG, STATUS_CONFIG } from "./consultationConfig";
import { RailRow } from "./consultationPrimitives";
import type { Consultation, ClinicId } from "@/types";

interface Props {
  consultation: Consultation;
  clinician: { name: string; role: string; reg?: string };
  startDt: Date;
  duration: number;
  history: Consultation[];
  clinicId: ClinicId;
}

export function ConsultationClinicianRail({
  consultation,
  clinician,
  startDt,
  duration,
  history,
  clinicId,
}: Props) {
  const isVideo = consultation.modality === "video";

  return (
    <div className="w-72 flex flex-col gap-4 shrink-0">
      {/* Consultation details */}
      <div className="bg-surface rounded-xl border border-bdr p-4">
        <h3 className="text-sm font-semibold text-t1 mb-3">Consultation Details</h3>
        <div className="flex flex-col gap-2.5">
          <RailRow icon={Calendar} label="Date" value={format(startDt, "EEE d MMM yyyy")} />
          <RailRow
            icon={Clock}
            label="Time"
            value={`${format(startDt, "HH:mm")} – ${format(parseISO(consultation.scheduled_end), "HH:mm")} BST`}
          />
          <RailRow icon={Clock} label="Duration" value={`${duration} min`} />
          <RailRow
            icon={isVideo ? Video : Phone}
            label="Modality"
            value={consultation.modality.charAt(0).toUpperCase() + consultation.modality.slice(1)}
          />
          <div className="border-t border-bdr pt-2 mt-1">
            <p className="text-xs text-t2 mb-0.5">Clinician</p>
            <p className="text-sm font-medium text-t1">{clinician.name}</p>
            <p className="text-xs text-t2">{clinician.role}</p>
            {clinician.reg && <p className="text-xs text-t3">{clinician.reg}</p>}
          </div>
          <div className="border-t border-bdr pt-2">
            <p className="text-xs text-t2 mb-0.5">Provider</p>
            <p className="text-xs font-medium text-t1">{consultation.provider}</p>
            {consultation.provider_event_id && (
              <p className="text-xs text-t3 font-mono">{consultation.provider_event_id}</p>
            )}
          </div>
        </div>
      </div>

      {/* DEC-40 Compliance posture card */}
      <div className="bg-surface rounded-xl border border-bdr p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-semibold text-t1">DEC-40 Compliance</h3>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <VideoOff className="w-3.5 h-3.5 text-ok shrink-0" />
            <span className="text-xs text-t2">
              Recording <span className="font-semibold text-ok">disabled</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MicOff className="w-3.5 h-3.5 text-ok shrink-0" />
            <span className="text-xs text-t2">
              Transcription <span className="font-semibold text-ok">disabled</span>
            </span>
          </div>
          <div className="border-t border-bdr pt-2 mt-1">
            <p className="text-[10px] text-t3 font-medium mb-1">Legal basis</p>
            <p className="text-[11px] text-t2">UK GDPR Art&nbsp;9(2)(h)</p>
            <p className="text-[10px] text-t3">Health care &amp; treatment provision</p>
          </div>
          <div className="border-t border-bdr pt-2">
            <p className="text-[10px] text-t3 font-medium mb-1">Identity verification</p>
            <p className="text-[11px] text-t2">AUD-19 — mandatory pre-call</p>
            <p className="text-[10px] text-t3">Clinician gate: all checks required</p>
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-surface rounded-xl border border-bdr p-4">
          <h3 className="text-sm font-semibold text-t1 mb-3">Previous Consultations</h3>
          <div className="flex flex-col gap-2">
            {history.map((h) => {
              const hCfg    = TYPE_CONFIG[h.consultation_type];
              const hStatus = STATUS_CONFIG[h.status];
              return (
                <Link
                  key={h.id}
                  href={`/${clinicId}/schedule/${h.id}`}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-page-bg border border-transparent hover:border-bdr transition-colors"
                >
                  <div className={`w-1.5 h-full min-h-[32px] rounded-full ${hCfg.bg} border ${hCfg.border}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-t1 truncate">{hCfg.label}</p>
                    <p className="text-[10px] text-t2">{format(parseISO(h.scheduled_start), "d MMM yyyy")}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-px rounded border ${hStatus.bg} ${hStatus.text} ${hStatus.border}`}>
                    {hStatus.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
