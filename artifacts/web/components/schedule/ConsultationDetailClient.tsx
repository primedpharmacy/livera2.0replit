"use client";

import { useState } from "react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { Video, ExternalLink } from "lucide-react";
import type { Consultation, Patient, Order, ClinicId } from "@/types";
import { TYPE_CONFIG, STATUS_CONFIG, CLINICIAN_INFO, getPhaseIndex } from "./consultationConfig";
import { ConsultationPhaseTracker } from "./ConsultationPhaseTracker";
import { ConsultationIdentityChecklist, type IdCheckKey } from "./ConsultationIdentityChecklist";
import { ConsultationMeetCard } from "./ConsultationMeetCard";
import { ConsultationPatientContext } from "./ConsultationPatientContext";
import { ConsultationClinicianRail } from "./ConsultationClinicianRail";
import { ConsultationPostCallActions } from "./ConsultationPostCallActions";

interface Props {
  consultation: Consultation;
  patient: Patient;
  order: Order | null;
  history: Consultation[];
  clinicId: ClinicId;
}

export function ConsultationDetailClient({
  consultation,
  patient,
  order,
  history,
  clinicId,
}: Props) {
  const phaseIndex  = getPhaseIndex(consultation.status);
  const isVideo     = consultation.modality === "video";
  const isCompleted = consultation.status === "completed";

  const [idChecks, setIdChecks] = useState<Record<IdCheckKey, boolean>>({
    name: false, dob: false, visual: false, location: false,
  });

  const requiredChecks: IdCheckKey[] = isVideo
    ? ["name", "dob", "visual", "location"]
    : ["name", "dob", "location"];

  const allChecked = requiredChecks.every((k) => idChecks[k]);

  function toggle(key: IdCheckKey) {
    setIdChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const typeCfg   = TYPE_CONFIG[consultation.consultation_type];
  const statusCfg = STATUS_CONFIG[consultation.status];
  const clinician = CLINICIAN_INFO[consultation.clinician_id] ?? { name: consultation.clinician_id, role: "Unknown" };
  const duration  = differenceInMinutes(parseISO(consultation.scheduled_end), parseISO(consultation.scheduled_start));
  const startDt   = parseISO(consultation.scheduled_start);
  const dateLabel = format(startDt, "EEEE d MMMM yyyy");
  const timeLabel = `${format(startDt, "HH:mm")} – ${format(parseISO(consultation.scheduled_end), "HH:mm")} BST`;
  const qr        = order?.questionnaire_responses as Record<string, unknown> | undefined;

  return (
    <div>
      {/* ── Header strip ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-6 py-4 bg-surface border-b border-bdr">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-px rounded-full border ${typeCfg.bg} ${typeCfg.border} ${typeCfg.text}`}>
              {typeCfg.label}
            </span>
            <span className={`text-xs font-bold px-2 py-px rounded-full border ${statusCfg.bg} ${statusCfg.border} ${statusCfg.text}`}>
              {statusCfg.label}
            </span>
            <span className="text-xs text-t3">{consultation.id}</span>
          </div>
          <h1 className="text-xl font-semibold text-t1">{patient.demographic.full_name}</h1>
          <p className="text-sm text-t2">{dateLabel} · {timeLabel} · {duration} min</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isVideo && consultation.join_url_clinician && allChecked && (
            <a
              href={consultation.join_url_clinician}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ok text-white text-sm font-semibold hover:bg-ok/90 transition-colors"
            >
              <Video className="w-4 h-4" />
              Join Google Meet
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          )}
        </div>
      </div>

      {/* ── Phase tracker ─────────────────────────────────────────────────── */}
      <ConsultationPhaseTracker status={consultation.status} />

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex gap-6 px-6 py-6 items-start">
        {/* Left column */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <ConsultationPatientContext
            patient={patient}
            clinicId={clinicId}
            order={order}
            qr={qr}
          />

          <ConsultationIdentityChecklist
            isVideo={isVideo}
            idChecks={idChecks}
            allChecked={allChecked}
            toggle={toggle}
          />

          {isVideo && consultation.join_url_clinician && (
            <ConsultationMeetCard
              joinUrl={consultation.join_url_clinician}
              allChecked={allChecked}
            />
          )}

          <ConsultationPostCallActions isCompleted={isCompleted} />
        </div>

        {/* Right rail */}
        <ConsultationClinicianRail
          consultation={consultation}
          clinician={clinician}
          startDt={startDt}
          duration={duration}
          history={history}
          clinicId={clinicId}
        />
      </div>
    </div>
  );
}
