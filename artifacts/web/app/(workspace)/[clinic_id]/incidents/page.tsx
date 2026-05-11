import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { IncidentsView } from "@/components/incidents/IncidentsView";
import { listIncidents, listPatients, getClinicSync } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function IncidentsPage({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <div>
      <PageHeader
        icon={AlertTriangle}
        title="Incidents"
        subtitle="Clinical incidents and safety events"
      />
      <Suspense key={clinic_id} fallback={<LoadingState.Table />}>
        <IncidentsContent clinicId={clinic_id as ClinicId} />
      </Suspense>
    </div>
  );
}

async function IncidentsContent({ clinicId }: { clinicId: ClinicId }) {
  try {
    const [incidents, patients, clinic] = await Promise.all([
      listIncidents(clinicId),
      listPatients(clinicId),
      Promise.resolve(getClinicSync(clinicId)),
    ]);
    if (incidents.length === 0) {
      return (
        <EmptyState
          icon={AlertTriangle}
          title="No incidents recorded"
          description="Clinical incidents and safety events will appear here."
        />
      );
    }
    return <IncidentsView initialIncidents={incidents} patients={patients} clinicId={clinicId} clinic={clinic} />;
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : "Failed to load incidents"} />;
  }
}
