import { Suspense } from "react";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ComplaintDetailClient } from "@/components/complaints/ComplaintDetailClient";
import { getComplaint, getClinicSync } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string; complaint_id: string }> };

export default async function ComplaintDetailPage({ params }: Props) {
  const { clinic_id, complaint_id } = await params;
  return (
    <Suspense key={`${clinic_id}-${complaint_id}`} fallback={<LoadingState.Detail />}>
      <ComplaintDetailContent clinicId={clinic_id as ClinicId} complaintId={complaint_id} />
    </Suspense>
  );
}

async function ComplaintDetailContent({ clinicId, complaintId }: { clinicId: ClinicId; complaintId: string }) {
  try {
    const [complaint, clinic] = await Promise.all([
      getComplaint(clinicId, complaintId),
      Promise.resolve(getClinicSync(clinicId)),
    ]);
    return <ComplaintDetailClient initialComplaint={complaint} clinic={clinic} clinicId={clinicId} />;
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : "Failed to load complaint"} />;
  }
}
