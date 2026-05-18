import { Suspense } from "react";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { IncidentDetailClient } from "@/components/incidents/IncidentDetailClient";
import { getIncident, getClinicSync, listIncidentComments } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string; incident_id: string }> };

export default async function IncidentDetailPage({ params }: Props) {
  const { clinic_id, incident_id } = await params;
  return (
    <Suspense key={`${clinic_id}-${incident_id}`} fallback={<LoadingState.Detail />}>
      <IncidentDetailContent clinicId={clinic_id as ClinicId} incidentId={incident_id} />
    </Suspense>
  );
}

async function IncidentDetailContent({ clinicId, incidentId }: { clinicId: ClinicId; incidentId: string }) {
  try {
    const [incident, clinic, initialComments] = await Promise.all([
      getIncident(clinicId, incidentId),
      Promise.resolve(getClinicSync(clinicId)),
      listIncidentComments(clinicId, incidentId),
    ]);
    return (
      <IncidentDetailClient
        initialIncident={incident}
        clinic={clinic}
        clinicId={clinicId}
        initialComments={initialComments}
      />
    );
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : "Failed to load incident"} />;
  }
}
