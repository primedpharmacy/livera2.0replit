"use client";

import { useState, useEffect, useRef } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import Link from "next/link";
import { listConsultations, listPatients } from "@/lib/api/mock";
import type { Consultation, ClinicId } from "@/types";

const TYPE_CONFIG: Record<
  Consultation["consultation_type"],
  { label: string; bg: string; border: string; text: string; dot: string }
> = {
  clinical_consult: {
    label: "Clinical consult",
    bg: "bg-clinical-bg",
    border: "border-clinical-bdr",
    text: "text-clinical",
    dot: "bg-clinical",
  },
  coaching: {
    label: "Coaching",
    bg: "bg-coach-bg",
    border: "border-coach-bdr",
    text: "text-coach",
    dot: "bg-coach",
  },
  welcome_call: {
    label: "Welcome call",
    bg: "bg-welcome-bg",
    border: "border-welcome-bdr",
    text: "text-welcome",
    dot: "bg-welcome",
  },
  follow_up: {
    label: "Follow-up",
    bg: "bg-info-bg",
    border: "border-info-bdr",
    text: "text-info",
    dot: "bg-info",
  },
};

const STATUS_DOT: Record<Consultation["status"], string> = {
  scheduled: "bg-ok",
  in_progress: "bg-warn",
  completed: "bg-t3",
  no_show: "bg-err",
  cancelled: "bg-err",
  rescheduled: "bg-warn",
};

const CLINICIAN_LABELS: Record<string, string> = {
  user_claire: "Claire M.",
  user_olwyn: "Olwyn P.",
  user_qadir: "Qadir H.",
  user_admin: "Admin",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface ScheduleViewProps {
  clinicId: ClinicId;
  initialMonday: string;
  initialConsultations?: Consultation[];
  initialPatientNames?: Record<string, string>;
}

function getWeekDates(mondayStr: string) {
  const monday = parseISO(mondayStr);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

function offsetMonday(mondayStr: string, weeks: number) {
  return format(addDays(parseISO(mondayStr), weeks * 7), "yyyy-MM-dd");
}

export function ScheduleView({ clinicId, initialMonday, initialConsultations, initialPatientNames }: ScheduleViewProps) {
  const [currentMonday, setCurrentMonday] = useState(initialMonday);
  const [consultations, setConsultations] = useState<Consultation[]>(initialConsultations ?? []);
  const [patientNames, setPatientNames] = useState<Record<string, string>>(initialPatientNames ?? {});
  const [loading, setLoading] = useState(false);
  const isInitialLoad = useRef(initialConsultations !== undefined);

  const weekDates = getWeekDates(currentMonday);
  const from = `${currentMonday}T00:00:00Z`;
  const to =
    format(addDays(parseISO(currentMonday), 6), "yyyy-MM-dd") + "T23:59:59Z";

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    setLoading(true);
    Promise.all([
      listConsultations(clinicId, { from, to }),
      listPatients(clinicId),
    ])
      .then(([cons, patients]) => {
        setConsultations(cons);
        const map: Record<string, string> = {};
        patients.forEach((p) => {
          map[p.id] = p.demographic.full_name;
        });
        setPatientNames(map);
      })
      .catch((err) => console.error('[ScheduleView] load error:', err))
      .finally(() => setLoading(false));
  }, [clinicId, currentMonday]); // eslint-disable-line react-hooks/exhaustive-deps

  function consultationsForDay(date: Date) {
    const dateStr = format(date, "yyyy-MM-dd");
    return consultations
      .filter((c) => c.scheduled_start.startsWith(dateStr))
      .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
  }

  const totalThisWeek = consultations.length;

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      {/* Week navigator */}
      <div className="flex items-center justify-between bg-surface border border-bdr rounded-xl px-4 py-3">
        <button
          onClick={() => setCurrentMonday(offsetMonday(currentMonday, -1))}
          className="p-2 rounded-lg hover:bg-page-bg border border-transparent hover:border-bdr transition-colors"
          aria-label="Previous week"
        >
          <ChevronLeft className="w-4 h-4 text-t2" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand" />
            <span className="text-sm font-semibold text-t1">
              Week of {format(parseISO(currentMonday), "d MMMM yyyy")}
            </span>
          </div>
          <span className="text-xs text-t2 bg-slate-100 px-2 py-px rounded-full">
            {totalThisWeek} session{totalThisWeek !== 1 ? "s" : ""}
          </span>
        </div>

        <button
          onClick={() => setCurrentMonday(offsetMonday(currentMonday, 1))}
          className="p-2 rounded-lg hover:bg-page-bg border border-transparent hover:border-bdr transition-colors"
          aria-label="Next week"
        >
          <ChevronRight className="w-4 h-4 text-t2" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4">
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            <span className="text-xs text-t2">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Week grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((d) => (
            <div
              key={d}
              className="rounded-xl border border-bdr bg-surface p-3 animate-pulse min-h-[160px]"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2 min-h-[400px]">
          {weekDates.map((date, i) => {
            const dayConsultations = consultationsForDay(date);
            const dateStr = format(date, "yyyy-MM-dd");
            const isToday = dateStr === "2026-05-11";

            return (
              <div
                key={i}
                className={`rounded-xl border bg-surface p-3 flex flex-col gap-2 ${
                  isToday ? "border-brand" : "border-bdr"
                }`}
              >
                {/* Day header */}
                <div
                  className={`flex flex-col items-center pb-2 border-b ${
                    isToday ? "border-brand/30" : "border-bdr"
                  }`}
                >
                  <span className="text-[10px] font-bold text-t3 uppercase tracking-widest">
                    {DAYS[i]}
                  </span>
                  <span
                    className={`text-xl font-bold leading-tight ${
                      isToday ? "text-brand" : "text-t1"
                    }`}
                  >
                    {format(date, "d")}
                  </span>
                  {isToday && (
                    <span className="text-[9px] font-bold text-brand uppercase tracking-wide mt-0.5">
                      Today
                    </span>
                  )}
                </div>

                {/* Events */}
                <div className="flex flex-col gap-1.5 flex-1">
                  {dayConsultations.length === 0 && (
                    <p className="text-[11px] text-t3 text-center py-4">—</p>
                  )}
                  {dayConsultations.map((c) => {
                    const cfg = TYPE_CONFIG[c.consultation_type];
                    const time = format(parseISO(c.scheduled_start), "HH:mm");
                    const patientName =
                      patientNames[c.patient_id] ?? c.patient_id;

                    return (
                      <Link
                        key={c.id}
                        href={`/${clinicId}/schedule/${c.id}`}
                        className={`block rounded-lg border px-2 py-1.5 ${cfg.bg} ${cfg.border} hover:opacity-80 transition-opacity group`}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.status]}`}
                          />
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wide ${cfg.text}`}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-t1 truncate">
                          {time}
                        </p>
                        <p className="text-[11px] text-t1 truncate font-medium leading-tight mt-px">
                          {patientName}
                        </p>
                        <p className="text-[10px] text-t2 truncate">
                          {CLINICIAN_LABELS[c.clinician_id] ?? c.clinician_id}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
