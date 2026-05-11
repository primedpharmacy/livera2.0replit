import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { AmendmentDetailClient } from "@/components/amendments/AmendmentDetailClient";
import { getAmendment, getOrder, getPatient } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type AmendmentDetailPageProps = {
  params: Promise<{ clinic_id: string; amendment_id: string }>;
};

export default async function AmendmentDetailPage({ params }: AmendmentDetailPageProps) {
  const { clinic_id, amendment_id } = await params;
  return (
    <div className="flex flex-col h-full">
      <Suspense
        key={`${clinic_id}-${amendment_id}`}
        fallback={<LoadingState.Detail />}
      >
        <AmendmentContent clinicId={clinic_id as ClinicId} amendmentId={amendment_id} />
      </Suspense>
    </div>
  );
}

async function AmendmentContent({
  clinicId,
  amendmentId,
}: {
  clinicId: ClinicId;
  amendmentId: string;
}) {
  try {
    const amendment = await getAmendment(clinicId, amendmentId);
    const order     = await getOrder(clinicId, amendment.order_id);
    const patient   = await getPatient(clinicId, order.patient_id);

    return (
      <AmendmentDetailClient
        initialAmendment={amendment}
        order={order}
        patient={patient}
        clinicId={clinicId}
      />
    );
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes("not found")) {
      notFound();
    }
    return (
      <ErrorState
        message={err instanceof Error ? err.message : "Failed to load amendment"}
      />
    );
  }
}
