import { Suspense } from "react";
import { getClinic, listConsultations, listPatients } from "@/lib/api/mock";
import { NOW } from "@/lib/api/constants";
import type { ClinicId } from "@/types";
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

async function CoachContent({ clinicId }: { clinicId: ClinicId }) {
  const clinic = await getClinic(clinicId);
  const coachingEnabled = clinic.config.coaching_enabled;

  if (!coachingEnabled) {
    return (
      <CoachDashboardClient
        clinicId={clinicId}
        coachingEnabled={false}
        upcomingSessions={[]}
        pastSessions={[]}
        patients={[]}
      />
    );
  }

  const [allConsultations, patients] = await Promise.all([
    listConsultations(clinicId, { type: "coaching" }),
    listPatients(clinicId),
  ]);

  const now = NOW;
  const upcomingSessions = allConsultations
    .filter((c) => c.scheduled_start >= now && c.status === "scheduled")
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));

  const pastSessions = allConsultations
    .filter((c) => c.status === "completed")
    .sort((a, b) => b.scheduled_start.localeCompare(a.scheduled_start));

  return (
    <CoachDashboardClient
      clinicId={clinicId}
      coachingEnabled={true}
      upcomingSessions={upcomingSessions}
      pastSessions={pastSessions}
      patients={patients}
    />
  );
}
