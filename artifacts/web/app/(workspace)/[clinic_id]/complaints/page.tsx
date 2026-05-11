import { Suspense } from "react";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ComplaintsView } from "@/components/complaints/ComplaintsView";
import { listComplaints, listPatients, getClinicSync } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function ComplaintsPage({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <div>
      <PageHeader
        icon={Megaphone}
        title="Complaints"
        subtitle="Patient complaints — Monday.com is source of truth (DEC-37)"
      />
      <Suspense key={clinic_id} fallback={<LoadingState.Table />}>
        <ComplaintsContent clinicId={clinic_id as ClinicId} />
      </Suspense>
    </div>
  );
}

async function ComplaintsContent({ clinicId }: { clinicId: ClinicId }) {
  try {
    const [complaints, patients, clinic] = await Promise.all([
      listComplaints(clinicId),
      listPatients(clinicId),
      Promise.resolve(getClinicSync(clinicId)),
    ]);
    if (complaints.length === 0) {
      return (
        <EmptyState
          icon={Megaphone}
          title="No complaints recorded"
          description="Complaints synced from Monday.com will appear here."
        />
      );
    }
    return <ComplaintsView initialComplaints={complaints} patients={patients} clinicId={clinicId} clinic={clinic} />;
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : "Failed to load complaints"} />;
  }
}
