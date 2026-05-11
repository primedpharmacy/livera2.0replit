"use client";

import { format, parseISO } from "date-fns";
import { Brain, Lock, Calendar, Users, CheckCircle2, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Consultation, Patient, ClinicId } from "@/types";

interface Props {
  clinicId: ClinicId;
  coachingEnabled: boolean;
  upcomingSessions: Consultation[];
  pastSessions: Consultation[];
  patients: Patient[];
}

const PATIENT_NAMES: Record<string, string> = {};

function buildRoster(
  patients: Patient[],
  upcomingSessions: Consultation[],
  pastSessions: Consultation[]
) {
  const allSessions = [...upcomingSessions, ...pastSessions];
  const patientIds = [...new Set(allSessions.map((s) => s.patient_id))];
  const patientMap = Object.fromEntries(patients.map((p) => [p.id, p]));

  return patientIds.map((pid) => {
    const patient = patientMap[pid];
    const upcoming = upcomingSessions
      .filter((s) => s.patient_id === pid)
      .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))[0];
    const past = pastSessions
      .filter((s) => s.patient_id === pid)
      .sort((a, b) => b.scheduled_start.localeCompare(a.scheduled_start))[0];

    let statusLabel: string;
    let statusCls: string;
    if (upcoming) {
      statusLabel = "Upcoming";
      statusCls =
        "bg-info-bg text-info border-info-bdr";
    } else if (past) {
      statusLabel = "On track";
      statusCls = "bg-ok-bg text-ok border-ok-bdr";
    } else {
      statusLabel = "New";
      statusCls = "bg-slate-100 text-t3 border-bdr";
    }

    return { patient, upcoming, past, statusLabel, statusCls };
  });
}

export function CoachDashboardClient({
  clinicId,
  coachingEnabled,
  upcomingSessions,
  pastSessions,
  patients,
}: Props) {
  if (!coachingEnabled) {
    return (
      <>
        {/* Locked header */}
        <div className="flex items-center gap-4 px-6 py-4 bg-surface border-b border-bdr">
          <div className="w-[52px] h-[52px] rounded-xl bg-gradient-to-br from-t3 to-slate-400 shadow-sm flex items-center justify-center shrink-0">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-t1">Coach Dashboard</h1>
            <p className="text-sm text-t2">Coaching programme management</p>
          </div>
        </div>

        <div className="px-6 py-16 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Lock className="w-8 h-8 text-t3" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-t1 mb-1">
              Coaching not enabled
            </h2>
            <p className="text-sm text-t2 max-w-sm">
              The coaching programme is not active for this workspace. Contact
              Livera support to enable it for your clinic.
            </p>
          </div>
        </div>
      </>
    );
  }

  const roster = buildRoster(patients, upcomingSessions, pastSessions);
  const thisWeekEnd = "2026-05-17T23:59:59Z";
  const thisWeekSessions = upcomingSessions.filter(
    (s) => s.scheduled_start <= thisWeekEnd
  );

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 bg-surface border-b border-bdr">
        <div className="w-[52px] h-[52px] rounded-xl bg-gradient-to-br from-brand to-brand-dark shadow-sm flex items-center justify-center shrink-0">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-t1">Coach Dashboard</h1>
          <p className="text-sm text-t2">Coaching programme management</p>
        </div>
      </div>

      <div className="px-6 py-6 flex flex-col gap-6">
        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            icon={Users}
            label="Total roster"
            value={roster.length}
            variant="default"
          />
          <KpiCard
            icon={Calendar}
            label="This week"
            value={thisWeekSessions.length}
            variant={thisWeekSessions.length > 0 ? "brand" : "default"}
          />
          <KpiCard
            icon={CheckCircle2}
            label="Completed"
            value={pastSessions.length}
            variant="ok"
          />
          <KpiCard
            icon={Clock}
            label="Overdue"
            value={0}
            variant="default"
          />
        </div>

        <div className="grid grid-cols-5 gap-6 items-start">
          {/* Patient roster */}
          <div className="col-span-3 bg-surface rounded-xl border border-bdr overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-bdr">
              <h2 className="text-sm font-semibold text-t1">Patient roster</h2>
              <span className="text-xs text-t2">{roster.length} patients</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-page-bg border-b border-bdr">
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-t2 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-t2 uppercase tracking-wider">
                    Last session
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-t2 uppercase tracking-wider">
                    Next session
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold text-t2 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {roster.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-t3"
                    >
                      No patients in coaching roster yet
                    </td>
                  </tr>
                ) : (
                  roster.map(({ patient, upcoming, past, statusLabel, statusCls }) => (
                    <tr
                      key={patient?.id ?? "unknown"}
                      className="border-b border-bdr last:border-0 hover:bg-page-bg transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-t1">
                          {patient?.demographic.full_name ?? "—"}
                        </p>
                        <p className="text-xs text-t3 font-mono">
                          {patient?.id ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-t2 text-sm">
                        {past
                          ? format(parseISO(past.scheduled_start), "d MMM yyyy")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-t2 text-sm">
                        {upcoming ? (
                          <Link
                            href={`/${clinicId}/schedule/${upcoming.id}`}
                            className="text-brand hover:underline"
                          >
                            {format(
                              parseISO(upcoming.scheduled_start),
                              "EEE d MMM, HH:mm"
                            )}
                          </Link>
                        ) : (
                          <span className="text-t3">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-bold px-2 py-px rounded-full border ${statusCls}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {patient && (
                          <Link
                            href={`/${clinicId}/patients/${patient.id}`}
                            className="flex items-center gap-0.5 text-xs text-brand hover:underline"
                          >
                            Profile
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Upcoming sessions */}
          <div className="col-span-2 flex flex-col gap-4">
            <div className="bg-surface rounded-xl border border-bdr overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-bdr">
                <h2 className="text-sm font-semibold text-t1">
                  Upcoming sessions
                </h2>
                <span className="text-xs font-bold text-brand bg-brand-light px-2 py-px rounded-full">
                  {upcomingSessions.length}
                </span>
              </div>

              {upcomingSessions.length === 0 ? (
                <p className="px-4 py-6 text-sm text-t3 text-center">
                  No upcoming sessions
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-bdr">
                  {upcomingSessions.map((s) => {
                    const patient = patients.find(
                      (p) => p.id === s.patient_id
                    );
                    return (
                      <Link
                        key={s.id}
                        href={`/${clinicId}/schedule/${s.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-page-bg transition-colors"
                      >
                        <div className="w-1 self-stretch rounded-full bg-coach shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-t1 truncate">
                            {patient?.demographic.full_name ?? s.patient_id}
                          </p>
                          <p className="text-xs text-t2">
                            {format(
                              parseISO(s.scheduled_start),
                              "EEE d MMM · HH:mm"
                            )}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-t3 shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Past sessions */}
            {pastSessions.length > 0 && (
              <div className="bg-surface rounded-xl border border-bdr overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-bdr">
                  <h2 className="text-sm font-semibold text-t1">
                    Recent completed
                  </h2>
                </div>
                <div className="flex flex-col divide-y divide-bdr">
                  {pastSessions.slice(0, 3).map((s) => {
                    const patient = patients.find(
                      (p) => p.id === s.patient_id
                    );
                    return (
                      <Link
                        key={s.id}
                        href={`/${clinicId}/schedule/${s.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-page-bg transition-colors"
                      >
                        <div className="w-1 self-stretch rounded-full bg-t3 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-t1 truncate">
                            {patient?.demographic.full_name ?? s.patient_id}
                          </p>
                          <p className="text-xs text-t2">
                            {format(
                              parseISO(s.scheduled_start),
                              "EEE d MMM · HH:mm"
                            )}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-ok bg-ok-bg border border-ok-bdr px-1.5 py-px rounded shrink-0">
                          Done
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  variant: "default" | "brand" | "ok" | "warn";
}) {
  const variantCls = {
    default: "text-t1 bg-surface border-bdr",
    brand: "text-brand bg-brand-light border-brand/20",
    ok: "text-ok bg-ok-bg border-ok-bdr",
    warn: "text-warn bg-warn-bg border-warn-bdr",
  }[variant];

  return (
    <div className={`rounded-xl border p-4 ${variantCls}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 opacity-70" />
        <span className="text-xs font-medium opacity-70">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
