import { Suspense } from "react";
import {
  getClinic,
  listPatients,
  listCoachingLogs,
  listClinicalEscalationFlags,
  listConsultations,
  CURRENT_USER,
} from "@/lib/api/mock";
import { NOW } from "@/lib/api/constants";
import type { ClinicId, Patient, CoachingLog, ClinicalEscalationFlag, Consultation } from "@/types";
import { CoachDashboardClient } from "@/components/schedule/CoachDashboardClient";
import { LoadingState } from "@/components/shared/LoadingState";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function CoachPage({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <Suspense key={clinic_id} fallback={<LoadingState.Table />}>
      <CoachContent clinicId={clinic_id as ClinicId} />
    </Suspense>
  );
}

// ── KPI types ────────────────────────────────────────────────────────────────

export interface CoachKpi {
  /** KPI 1: % patients whose initial_call was within 7 calendar days of first dispatch */
  initial_call_within_7d: { n: number; d: number };
  /** KPI 2: avg calendar days between scheduled_date and entry_date (rolling 90 days) */
  avg_contact_delta_days: number | null;
  /** KPI 3: % escalation flags resolved within SLA (rolling 90 days, excludes open) */
  escalation_sla_met: { n: number; d: number };
}

export interface RosterRow {
  patient: Patient;
  lastLog: CoachingLog | null;
  nextSession: Consultation | null;
  weightLossKg: number;
  weightLossPct: number;
  hasOpenEscalation: boolean;
}

// ── Server component ─────────────────────────────────────────────────────────

async function CoachContent({ clinicId }: { clinicId: ClinicId }) {
  const clinic = await getClinic(clinicId);

  if (!clinic.config.coaching_enabled) {
    return (
      <CoachDashboardClient
        clinicId={clinicId}
        coachingEnabled={false}
        kpis={{ initial_call_within_7d: { n: 0, d: 0 }, avg_contact_delta_days: null, escalation_sla_met: { n: 0, d: 0 } }}
        roster={[]}
        todaySessions={[]}
        openEscalations={[]}
        coachName={CURRENT_USER.full_name}
      />
    );
  }

  const coachId = CURRENT_USER.id;
  const todayDate = NOW.slice(0, 10); // YYYY-MM-DD

  const [myPatients, allLogs, allFlags, consultations] = await Promise.all([
    listPatients(clinicId, { coach_id: coachId }),
    listCoachingLogs(clinicId, { coach_id: coachId }),
    listClinicalEscalationFlags(clinicId),
    listConsultations(clinicId, { type: "coaching" }),
  ]);

  const myPatientIds = new Set(myPatients.map((p) => p.id));
  const openEscalations = allFlags.filter(
    (f) => f.status === "open" && myPatientIds.has(f.patient_id)
  );

  // ── KPI 1: initial_call within 7 calendar days of first dispatch ──────────
  // For the mock we approximate first-dispatch from patient.created_at (Wave 11 will use orders)
  const kpi1Denominator = myPatients.filter((p) =>
    allLogs.some((l) => l.patient_id === p.id && l.entry_type === "initial_call")
  ).length;

  const kpi1Numerator = myPatients.filter((p) => {
    const initialCall = allLogs.find(
      (l) => l.patient_id === p.id && l.entry_type === "initial_call" && l.status === "completed"
    );
    if (!initialCall) return false;
    const dispatchApprox = p.created_at; // best proxy available without order query
    const deltaDays =
      (new Date(initialCall.entry_date).getTime() - new Date(dispatchApprox).getTime()) /
      (1000 * 60 * 60 * 24);
    return deltaDays <= 7;
  }).length;

  // ── KPI 2: avg delta days (completed logs with scheduled_date, rolling 90d) ──
  const ninetyDaysAgo = new Date(NOW);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysAgoISO = ninetyDaysAgo.toISOString();

  const completedWithScheduled = allLogs.filter(
    (l) =>
      l.status === "completed" &&
      l.scheduled_date !== null &&
      l.entry_date >= ninetyDaysAgoISO
  );

  let avgContactDeltaDays: number | null = null;
  if (completedWithScheduled.length > 0) {
    const totalDelta = completedWithScheduled.reduce((sum, l) => {
      const delta =
        (new Date(l.entry_date).getTime() - new Date(l.scheduled_date!).getTime()) /
        (1000 * 60 * 60 * 24);
      return sum + Math.abs(delta);
    }, 0);
    avgContactDeltaDays = Math.round((totalDelta / completedWithScheduled.length) * 10) / 10;
  }

  // ── KPI 3: escalation flags resolved within SLA (rolling 90d, excludes open) ──
  const recentFlags = allFlags.filter(
    (f) => myPatientIds.has(f.patient_id) && f.status !== "open" && f.raised_at >= ninetyDaysAgoISO
  );
  const kpi3Denominator = recentFlags.length;
  const kpi3Numerator = recentFlags.filter((f) => {
    if (!f.resolved_at) return false;
    const resolvedMs = new Date(f.resolved_at).getTime() - new Date(f.raised_at).getTime();
    const resolvedHours = resolvedMs / (1000 * 60 * 60);
    return resolvedHours <= clinic.config.default_slas.coach_escalation_response_wh;
  }).length;

  const kpis: CoachKpi = {
    initial_call_within_7d: { n: kpi1Numerator, d: kpi1Denominator },
    avg_contact_delta_days: avgContactDeltaDays,
    escalation_sla_met: { n: kpi3Numerator, d: kpi3Denominator },
  };

  // ── Roster rows ────────────────────────────────────────────────────────────
  const openFlagPatientIds = new Set(openEscalations.map((f) => f.patient_id));

  const roster: RosterRow[] = myPatients.map((patient) => {
    const patientLogs = allLogs
      .filter((l) => l.patient_id === patient.id)
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date));

    const lastLog = patientLogs[0] ?? null;

    const nextSession =
      consultations
        .filter(
          (c) =>
            c.patient_id === patient.id &&
            c.status === "scheduled" &&
            c.scheduled_start >= NOW
        )
        .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))[0] ?? null;

    const weightLossKg =
      Math.round((patient.baseline.baseline_weight_kg - patient.latest.weight_kg) * 10) / 10;
    const weightLossPct =
      Math.round((weightLossKg / patient.baseline.baseline_weight_kg) * 1000) / 10;

    return {
      patient,
      lastLog,
      nextSession,
      weightLossKg,
      weightLossPct,
      hasOpenEscalation: openFlagPatientIds.has(patient.id),
    };
  });

  // ── Today's sessions ───────────────────────────────────────────────────────
  const todaySessions = consultations
    .filter(
      (c) =>
        c.clinician_id === coachId &&
        c.scheduled_start.startsWith(todayDate) &&
        c.status === "scheduled"
    )
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));

  return (
    <CoachDashboardClient
      clinicId={clinicId}
      coachingEnabled={true}
      kpis={kpis}
      roster={roster}
      todaySessions={todaySessions}
      openEscalations={openEscalations}
      coachName={CURRENT_USER.full_name}
    />
  );
}
