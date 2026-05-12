import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoadingState } from "@/components/shared/LoadingState";
import { CoachDashboardClient } from "@/components/schedule/CoachDashboardClient";
import {
  getClinic,
  listConsultations,
  listPatients,
  listCoachingLogs,
  listOrders,
} from "@/lib/api/mock";
import { NOW } from "@/lib/api/constants";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function CoachPage({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <Suspense key={clinic_id} fallback={<LoadingState.Table />}>
      <CoachContent clinicId={clinic_id as ClinicId} />
    </Suspense>
  );
}

async function CoachContent({ clinicId }: { clinicId: ClinicId }) {
  const clinic = await getClinic(clinicId);

  if (!clinic.config.coaching_enabled) {
    redirect(`/${clinicId}/dashboard`);
  }

  const [allConsultations, patients, coachingLogs, orders] = await Promise.all([
    listConsultations(clinicId, { type: "coaching" }),
    listPatients(clinicId),
    listCoachingLogs(clinicId),
    listOrders(clinicId),
  ]);

  const WEEK_END = "2026-05-17T23:59:59Z";

  const upcomingSessions = allConsultations
    .filter((c) => c.scheduled_start >= NOW && c.status === "scheduled")
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));

  const pastSessions = allConsultations
    .filter((c) => c.status === "completed")
    .sort((a, b) => b.scheduled_start.localeCompare(a.scheduled_start));

  const thisWeekSessions = upcomingSessions.filter(
    (s) => s.scheduled_start <= WEEK_END
  );

  return (
    <CoachDashboardClient
      clinicId={clinicId}
      coachingEnabled={true}
      upcomingSessions={upcomingSessions}
      pastSessions={pastSessions}
      thisWeekSessions={thisWeekSessions}
      patients={patients}
      coachingLogs={coachingLogs}
      orders={orders}
    />
  );
}
