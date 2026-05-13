import { Suspense } from "react";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GpLetterTemplatesEditor } from "@/components/settings/GpLetterTemplatesEditor";
import { listGPLetterTemplates, getClinicSync } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function GpLetterTemplatesPage({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <Suspense key={clinic_id} fallback={<LoadingState.Table />}>
      <GpLetterTemplatesContent clinicId={clinic_id as ClinicId} />
    </Suspense>
  );
}

async function GpLetterTemplatesContent({ clinicId }: { clinicId: ClinicId }) {
  try {
    const templates = await listGPLetterTemplates(clinicId);
    return (
      <GpLetterTemplatesEditor
        clinicId={clinicId}
        initialTemplates={templates}
      />
    );
  } catch (err) {
    return (
      <ErrorState
        message={err instanceof Error ? err.message : "Failed to load GP letter templates"}
      />
    );
  }
}
