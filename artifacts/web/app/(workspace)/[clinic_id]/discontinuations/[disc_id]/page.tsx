/**
 * Discontinuation Protocol detail page — BLD-13.5
 */

import { Suspense } from "react";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { DiscontinuationDetailClient } from "@/components/discontinuations/DiscontinuationDetailClient";
import { getDiscontinuation, getPatient, getClinicSync } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string; disc_id: string }> };

export default async function DiscontinuationDetailPage({ params }: Props) {
  const { clinic_id, disc_id } = await params;
  return (
    <Suspense key={`${clinic_id}-${disc_id}`} fallback={<LoadingState.Detail />}>
      <Content clinicId={clinic_id as ClinicId} discId={disc_id} />
    </Suspense>
  );
}

async function Content({ clinicId, discId }: { clinicId: ClinicId; discId: string }) {
  try {
    const disc = await getDiscontinuation(clinicId, discId);
    const [patient, clinic] = await Promise.all([
      getPatient(clinicId, disc.patient_id).catch(() => null),
      Promise.resolve(getClinicSync(clinicId)),
    ]);
    return (
      <DiscontinuationDetailClient
        initialDisc={disc}
        patient={patient ?? null}
        clinic={clinic}
        clinicId={clinicId}
      />
    );
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : "Failed to load protocol"} />;
  }
}
