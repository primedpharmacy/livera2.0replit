"use client";

import { useState } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import {
  Brain, Calendar, Users, CheckCircle2, TrendingUp,
  ChevronRight, X, Activity, AlertTriangle, Video, Phone,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Consultation, Patient, ClinicId, CoachingLog, Order } from "@/types";

const NOW = new Date("2026-05-12T08:00:00Z");

interface Props {
  clinicId: ClinicId;
  coachingEnabled: boolean;
  upcomingSessions: Consultation[];
  pastSessions: Consultation[];
  thisWeekSessions: Consultation[];
  patients: Patient[];
  coachingLogs: CoachingLog[];
  orders: Order[];
}

type PipelineStage = "intake" | "early" | "active" | "plateau" | "graduation";

interface MemberRow {
  patient: Patient;
  stage: PipelineStage;
  logs: CoachingLog[];
  latestLog: CoachingLog | undefined;
  nextSession: Consultation | undefined;
  avgMood: number | null;
  weightLostPct: number;
  daysOnProgramme: number;
  adherence: string | null;
  hasEscalation: boolean;
}

function stageLabel(s: PipelineStage) {
  return { intake: "Intake", early: "Early progress", active: "Active", plateau: "Plateau", graduation: "Graduation-ready" }[s];
}
function stageBadge(s: PipelineStage) {
  return {
    intake:     "bg-info-bg text-info border-info-bdr",
    early:      "bg-brand-light text-brand border-brand/20",
    active:     "bg-ok-bg text-ok border-ok-bdr",
    plateau:    "bg-warn-bg text-warn border-warn-bdr",
    graduation: "bg-coach-bg text-coach border-coach-bdr",
  }[s];
}

function deriveStage(member: Omit<MemberRow, "stage">): PipelineStage {
  if (member.logs.length === 0) return "intake";
  if (member.weightLostPct >= 10) return "graduation";
  if (member.avgMood !== null && member.avgMood <= 2) return "plateau";
  if (member.hasEscalation) return "plateau";
  if (member.logs.length >= 3) return "active";
  return "early";
}

function buildMembers(
  patients: Patient[],
  logs: CoachingLog[],
  upcomingSessions: Consultation[],
  pastSessions: Consultation[],
): MemberRow[] {
  const allSessions = [...upcomingSessions, ...pastSessions];
  const coachPatientIds = [...new Set(
    [...logs.map((l) => l.patient_id), ...allSessions.map((s) => s.patient_id)]
  )];

  return coachPatientIds.map((pid) => {
    const patient = patients.find((p) => p.id === pid)!;
    if (!patient) return null;

    const memberLogs = logs
      .filter((l) => l.patient_id === pid)
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date));

    const latestLog = memberLogs[0];
    const nextSession = upcomingSessions.find((s) => s.patient_id === pid);
    const moodNums = memberLogs
      .map((l) => Number(l.structured_observations?.mood))
      .filter((n) => !isNaN(n) && n > 0);
    const avgMood = moodNums.length > 0
      ? Math.round((moodNums.reduce((a, b) => a + b, 0) / moodNums.length) * 10) / 10
      : null;
    const weightLostPct = +((
      (patient.baseline.baseline_weight_kg - patient.latest.weight_kg) /
      patient.baseline.baseline_weight_kg
    ) * 100).toFixed(1);
    const daysOnProgramme = differenceInDays(NOW, parseISO(patient.created_at));
    const adherence = latestLog?.structured_observations?.adherence ?? null;
    const hasEscalation = memberLogs.some((l) => l.clinical_escalation_flag_id !== null);

    const partial: Omit<MemberRow, "stage"> = {
      patient, logs: memberLogs, latestLog, nextSession,
      avgMood, weightLostPct, daysOnProgramme, adherence, hasEscalation,
    };
    return { ...partial, stage: deriveStage(partial) };
  }).filter(Boolean) as MemberRow[];
}

function MoodBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-t3 text-[11px]">—</span>;
  const pct = (score / 5) * 100;
  const color = score >= 4 ? "bg-ok" : score >= 3 ? "bg-warn" : "bg-err";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-bdr rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-t2 tabular-nums">{score}/5</span>
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function MemberDrawer({ member, clinicId, onClose }: { member: MemberRow; clinicId: string; onClose: () => void }) {
  const { patient, logs, nextSession, avgMood, weightLostPct, daysOnProgramme, adherence, stage } = member;
  const d = patient.demographic;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-[420px] h-full bg-surface shadow-2xl border-l border-bdr flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-bdr bg-coach-bg">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-coach to-purple-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {initials(d.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-t1 text-sm truncate">{d.full_name}</div>
            <div className="text-[11px] text-t3 font-mono">{patient.id}</div>
          </div>
          <span className={cn("text-[10px] font-bold px-2 py-px rounded-full border", stageBadge(stage))}>
            {stageLabel(stage)}
          </span>
          <button onClick={onClose} className="ml-1 text-t3 hover:text-t1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Progress metrics */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Days on programme", value: `${daysOnProgramme}d` },
              { label: "Weight lost", value: `${weightLostPct}%`, color: weightLostPct >= 5 ? "text-ok" : "text-warn" },
              { label: "Avg mood", value: avgMood ? `${avgMood}/5` : "—", color: avgMood && avgMood >= 4 ? "text-ok" : avgMood && avgMood <= 2 ? "text-err" : undefined },
              { label: "Total sessions", value: `${logs.length}` },
            ].map((m) => (
              <div key={m.label} className="bg-page-bg border border-bdr rounded-lg px-3 py-2.5">
                <div className="text-[10px] text-t3 uppercase tracking-wider font-bold mb-1">{m.label}</div>
                <div className={cn("text-xl font-bold text-t1", m.color)}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Adherence + NICE */}
          <div className="flex gap-2 flex-wrap">
            {adherence && (
              <span className={cn(
                "text-[11px] font-semibold px-2.5 py-1 rounded-full border",
                adherence === "excellent" ? "bg-ok-bg text-ok border-ok-bdr" :
                adherence === "good" ? "bg-info-bg text-info border-info-bdr" :
                adherence === "fair" ? "bg-warn-bg text-warn border-warn-bdr" :
                "bg-err-bg text-err border-err-bdr"
              )}>
                Adherence: {adherence}
              </span>
            )}
            <span className={cn(
              "text-[11px] font-semibold px-2.5 py-1 rounded-full border",
              weightLostPct >= 5 ? "bg-ok-bg text-ok border-ok-bdr" : "bg-warn-bg text-warn border-warn-bdr"
            )}>
              NICE ≥5%: {weightLostPct >= 5 ? "✓ met" : "not yet"}
            </span>
          </div>

          {/* Next session */}
          {nextSession && (
            <div className="bg-coach-bg border border-coach-bdr rounded-xl px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-coach mb-2">Next session</div>
              <div className="flex items-center gap-2">
                {nextSession.modality === "video" ? (
                  <Video className="w-4 h-4 text-coach" />
                ) : (
                  <Phone className="w-4 h-4 text-coach" />
                )}
                <div>
                  <div className="text-[13px] font-semibold text-t1">
                    {format(parseISO(nextSession.scheduled_start), "EEEE d MMM · HH:mm")}
                  </div>
                  <div className="text-[11px] text-t3 capitalize">{nextSession.modality} · {nextSession.provider}</div>
                </div>
              </div>
              {nextSession.join_url_clinician && (
                <a
                  href={nextSession.join_url_clinician}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 flex items-center justify-center gap-1.5 w-full py-1.5 bg-coach text-white text-[12px] font-semibold rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Video className="w-3.5 h-3.5" />
                  Join session
                </a>
              )}
            </div>
          )}

          {/* Coaching log history */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2">Session log ({logs.length})</div>
            {logs.length === 0 ? (
              <div className="text-[12px] text-t3 text-center py-4">No sessions yet</div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="bg-page-bg border border-bdr rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] text-t2">
                        {format(parseISO(log.entry_date), "d MMM yyyy · HH:mm")}
                      </span>
                      {log.structured_observations?.mood && (
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-px rounded-full",
                          Number(log.structured_observations.mood) >= 4 ? "bg-ok-bg text-ok" :
                          Number(log.structured_observations.mood) <= 2 ? "bg-err-bg text-err" :
                          "bg-warn-bg text-warn"
                        )}>
                          mood {log.structured_observations.mood}/5
                        </span>
                      )}
                      {log.duration_minutes && (
                        <span className="ml-auto text-[11px] text-t3">{log.duration_minutes}min</span>
                      )}
                    </div>
                    <p className="text-[11px] text-t1 leading-relaxed">{log.summary}</p>
                    {log.next_action && (
                      <p className="text-[11px] text-coach font-medium mt-1.5">→ {log.next_action}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Link to full profile */}
          <Link
            href={`/${clinicId}/patients/${patient.id}`}
            className="flex items-center justify-center gap-2 w-full py-2 text-[12px] font-semibold text-brand border border-brand/20 rounded-lg hover:bg-brand-light transition-colors"
          >
            View full patient profile <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function CoachDashboardClient({
  clinicId, coachingEnabled, upcomingSessions, pastSessions, thisWeekSessions,
  patients, coachingLogs, orders,
}: Props) {
  const [drawerMember, setDrawerMember] = useState<MemberRow | null>(null);
  const [activeStage, setActiveStage] = useState<PipelineStage | "all">("all");

  const members = buildMembers(patients, coachingLogs, upcomingSessions, pastSessions);

  const avgEngagement =
    members.length > 0
      ? Math.round(
          (members.reduce((sum, m) => sum + (m.avgMood ?? 0), 0) /
            members.filter((m) => m.avgMood !== null).length) *
            10
        ) / 10
      : null;

  const graduationReady = members.filter((m) => m.stage === "graduation").length;
  const thisWeekCount = thisWeekSessions.length;

  const stages: PipelineStage[] = ["intake", "early", "active", "plateau", "graduation"];

  const filteredMembers =
    activeStage === "all" ? members : members.filter((m) => m.stage === activeStage);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Purple coaching header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-coach-bdr"
        style={{ background: "linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)" }}>
        <div className="w-[48px] h-[48px] rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)" }}>
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-t1">Coach Dashboard</h1>
          <p className="text-[12px] text-t2">FeelTru coaching programme · {members.length} active members</p>
        </div>
        <div className="ml-auto">
          <button className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold rounded-lg border border-coach-bdr bg-white text-coach hover:bg-coach-bg transition-colors">
            <Calendar className="w-3.5 h-3.5" />
            Schedule session
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-px bg-bdr border-b border-bdr flex-shrink-0">
        {[
          {
            label: "Active members",
            value: members.length,
            icon: Users,
            sub: `${members.filter((m) => m.stage === "active").length} in active stage`,
            cls: "bg-surface text-t1",
            iconCls: "text-coach",
          },
          {
            label: "Sessions this week",
            value: thisWeekCount,
            icon: Calendar,
            sub: `${upcomingSessions.length} upcoming total`,
            cls: thisWeekCount > 0 ? "bg-coach-bg text-coach" : "bg-surface text-t1",
            iconCls: "text-coach",
          },
          {
            label: "Avg engagement",
            value: avgEngagement !== null ? `${avgEngagement}/5` : "—",
            icon: Activity,
            sub: avgEngagement !== null
              ? avgEngagement >= 4 ? "Strong engagement ↑" : avgEngagement <= 2 ? "Needs attention ↓" : "Moderate"
              : "No sessions yet",
            cls: avgEngagement !== null && avgEngagement <= 2 ? "bg-warn-bg text-warn" : "bg-surface text-t1",
            iconCls: avgEngagement !== null && avgEngagement >= 4 ? "text-ok" : avgEngagement !== null && avgEngagement <= 2 ? "text-warn" : "text-t3",
          },
          {
            label: "Graduation-ready",
            value: graduationReady,
            icon: TrendingUp,
            sub: `≥10% weight loss achieved`,
            cls: graduationReady > 0 ? "bg-ok-bg text-ok" : "bg-surface text-t1",
            iconCls: graduationReady > 0 ? "text-ok" : "text-t3",
          },
        ].map((kpi) => (
          <div key={kpi.label} className={cn("px-5 py-3.5 flex flex-col gap-1", kpi.cls)}>
            <div className="flex items-center gap-1.5">
              <kpi.icon className={cn("w-3.5 h-3.5", kpi.iconCls)} />
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{kpi.label}</span>
            </div>
            <div className="text-2xl font-bold tabular-nums leading-none">{kpi.value}</div>
            <div className="text-[11px] opacity-60">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Left: Programme pipeline */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-bdr min-w-0">
          {/* Stage filter tabs */}
          <div className="flex items-center gap-1 px-4 py-2.5 border-b border-bdr bg-surface overflow-x-auto flex-shrink-0">
            <button
              onClick={() => setActiveStage("all")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors",
                activeStage === "all"
                  ? "bg-coach text-white"
                  : "bg-page-bg text-t2 hover:bg-coach-bg hover:text-coach"
              )}
            >
              All members
              <span className={cn("text-[10px] px-1.5 py-px rounded-full font-bold",
                activeStage === "all" ? "bg-white/20 text-white" : "bg-bdr text-t3"
              )}>
                {members.length}
              </span>
            </button>
            {stages.map((stage) => {
              const count = members.filter((m) => m.stage === stage).length;
              return (
                <button
                  key={stage}
                  onClick={() => setActiveStage(stage)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors",
                    activeStage === stage
                      ? "bg-coach text-white"
                      : "bg-page-bg text-t2 hover:bg-coach-bg hover:text-coach"
                  )}
                >
                  {stageLabel(stage)}
                  <span className={cn("text-[10px] px-1.5 py-px rounded-full font-bold",
                    activeStage === stage ? "bg-white/20 text-white" : "bg-bdr text-t3"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Members table */}
          <div className="flex-1 overflow-y-auto">
            {filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-t3 text-sm gap-2">
                <Users className="w-8 h-8 opacity-30" />
                No members in this stage
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-page-bg border-b border-bdr">
                    {["Member", "Stage", "Mood avg", "Weight lost", "Last session", "Next session", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-t3 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => {
                    const { patient, stage, avgMood, weightLostPct, latestLog, nextSession } = member;
                    return (
                      <tr
                        key={patient.id}
                        className="border-b border-bdr last:border-0 hover:bg-coach-bg/40 transition-colors cursor-pointer"
                        onClick={() => setDrawerMember(member)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-coach to-purple-400 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                              {initials(patient.demographic.full_name)}
                            </div>
                            <div>
                              <div className="text-[12px] font-semibold text-t1">{patient.demographic.full_name}</div>
                              <div className="text-[11px] text-t3 font-mono">{patient.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-[10px] font-bold px-2 py-px rounded-full border", stageBadge(stage))}>
                            {stageLabel(stage)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <MoodBar score={avgMood} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-[12px] font-semibold",
                            weightLostPct >= 5 ? "text-ok" :
                            weightLostPct > 0 ? "text-warn" : "text-t3"
                          )}>
                            {weightLostPct > 0 ? `↓ ${weightLostPct}%` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-t2">
                          {latestLog
                            ? format(parseISO(latestLog.entry_date), "d MMM")
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {nextSession ? (
                            <span className="text-[11px] text-coach font-medium">
                              {format(parseISO(nextSession.scheduled_start), "EEE d MMM · HH:mm")}
                            </span>
                          ) : (
                            <span className="text-[11px] text-err">None booked</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight className="w-4 h-4 text-t3" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Sessions panel */}
        <div className="w-[280px] flex-shrink-0 flex flex-col bg-surface overflow-y-auto">

          {/* Upcoming sessions */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-t3">Upcoming sessions</span>
              <span className="text-[10px] font-bold text-coach bg-coach-bg border border-coach-bdr px-1.5 py-px rounded-full">
                {upcomingSessions.length}
              </span>
            </div>
            {upcomingSessions.length === 0 ? (
              <div className="text-[12px] text-t3 text-center py-4">No upcoming sessions</div>
            ) : (
              <div className="flex flex-col gap-2">
                {upcomingSessions.map((s) => {
                  const patient = patients.find((p) => p.id === s.patient_id);
                  const isThisWeek = s.scheduled_start <= "2026-05-17T23:59:59Z";
                  return (
                    <div
                      key={s.id}
                      className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-bdr hover:border-coach-bdr hover:bg-coach-bg transition-colors cursor-pointer"
                      onClick={() => {
                        const member = members.find((m) => m.patient.id === s.patient_id);
                        if (member) setDrawerMember(member);
                      }}
                    >
                      <div className="w-0.5 h-full min-h-[32px] rounded-full bg-coach self-stretch flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-t1 truncate">
                          {patient?.demographic.full_name ?? s.patient_id}
                        </div>
                        <div className="text-[11px] text-t2">
                          {format(parseISO(s.scheduled_start), "EEE d MMM · HH:mm")}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {s.modality === "video" ? (
                            <Video className="w-3 h-3 text-coach" />
                          ) : (
                            <Phone className="w-3 h-3 text-coach" />
                          )}
                          <span className="text-[10px] text-t3 capitalize">{s.modality}</span>
                          {isThisWeek && (
                            <span className="text-[9px] font-bold bg-coach-bg text-coach border border-coach-bdr px-1.5 py-px rounded-full">
                              This week
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-bdr mt-3" />

          {/* Attention needed */}
          {members.some((m) => m.stage === "plateau" || m.hasEscalation) && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-warn" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-warn">Attention needed</span>
              </div>
              <div className="flex flex-col gap-2">
                {members.filter((m) => m.stage === "plateau" || m.hasEscalation).map((m) => (
                  <div
                    key={m.patient.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-warn-bdr bg-warn-bg cursor-pointer hover:bg-warn-bg/70 transition-colors"
                    onClick={() => setDrawerMember(m)}
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-coach to-purple-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {initials(m.patient.demographic.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-warn truncate">{m.patient.demographic.full_name}</div>
                      <div className="text-[10px] text-t3">
                        {m.hasEscalation ? "Clinical escalation" : "Plateau phase"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed sessions */}
          {pastSessions.length > 0 && (
            <>
              <div className="border-t border-bdr mt-1" />
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-t3">Recent completed</span>
                  <span className="text-[10px] text-ok font-bold">{pastSessions.length}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {pastSessions.slice(0, 3).map((s) => {
                    const patient = patients.find((p) => p.id === s.patient_id);
                    return (
                      <div key={s.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-bdr hover:bg-page-bg transition-colors">
                        <CheckCircle2 className="w-3.5 h-3.5 text-ok flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium text-t1 truncate">
                            {patient?.demographic.full_name ?? s.patient_id}
                          </div>
                          <div className="text-[10px] text-t3">
                            {format(parseISO(s.scheduled_start), "d MMM · HH:mm")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Member drawer */}
      {drawerMember && (
        <MemberDrawer
          member={drawerMember}
          clinicId={clinicId}
          onClose={() => setDrawerMember(null)}
        />
      )}
    </div>
  );
}
