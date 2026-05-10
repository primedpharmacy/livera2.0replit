import { Suspense } from "react";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { PatientsView } from "@/components/patients/PatientsView";
import { listPatients } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

interface PatientsPageProps {
  params: { clinic_id: string };
}

export default function PatientsPage({ params }: PatientsPageProps) {
  return (
    <div>
      <PageHeader
        icon={Users}
        title="Patients"
        subtitle="Patient register for this workspace"
      />
      <Suspense key={params.clinic_id} fallback={<LoadingState.Table />}>
        <PatientsContent clinicId={params.clinic_id as ClinicId} />
      </Suspense>
    </div>
  );
}

async function PatientsContent({ clinicId }: { clinicId: ClinicId }) {
  try {
    const patients = await listPatients(clinicId);
    if (patients.length === 0) {
      return (
        <EmptyState
          icon={Users}
          title="No patients yet"
          description="Patients registered to this workspace will appear here."
        />
      );
    }
    return <PatientsView initialPatients={patients} clinicId={clinicId} />;
  } catch (err) {
    return (
      <ErrorState
        message={err instanceof Error ? err.message : "Failed to load patients"}
      />
    );
  }
}
