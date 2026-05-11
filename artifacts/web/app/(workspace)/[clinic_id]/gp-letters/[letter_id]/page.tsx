import { Suspense } from "react";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GPLetterDetailClient } from "@/components/gp-letters/GPLetterDetailClient";
import { getGPLetter, getPatient, getClinicSync } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string; letter_id: string }> };

export default async function GPLetterDetailPage({ params }: Props) {
  const { clinic_id, letter_id } = await params;
  return (
    <Suspense key={`${clinic_id}-${letter_id}`} fallback={<LoadingState.Detail />}>
      <GPLetterDetailContent clinicId={clinic_id as ClinicId} letterId={letter_id} />
    </Suspense>
  );
}

async function GPLetterDetailContent({ clinicId, letterId }: { clinicId: ClinicId; letterId: string }) {
  try {
    const letter = await getGPLetter(clinicId, letterId);
    const [patient, clinic] = await Promise.all([
      getPatient(clinicId, letter.patient_id),
      Promise.resolve(getClinicSync(clinicId)),
    ]);
    return <GPLetterDetailClient initialLetter={letter} patient={patient} clinic={clinic} clinicId={clinicId} />;
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : "Failed to load GP letter"} />;
  }
}
