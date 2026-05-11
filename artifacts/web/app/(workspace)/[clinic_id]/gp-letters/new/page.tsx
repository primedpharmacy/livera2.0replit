import { Suspense } from "react";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GPLetterNewClient } from "@/components/gp-letters/GPLetterNewClient";
import { listPatients, listGPLetterTemplates, getClinicSync } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function GPLetterNewPage({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <div>
      <PageHeader
        icon={FileText}
        title="New GP Letter"
        subtitle="Draft a letter to a patient's GP"
      />
      <Suspense key={clinic_id} fallback={<LoadingState.Detail />}>
        <GPLetterNewContent clinicId={clinic_id as ClinicId} />
      </Suspense>
    </div>
  );
}

async function GPLetterNewContent({ clinicId }: { clinicId: ClinicId }) {
  try {
    const [patients, templates, clinic] = await Promise.all([
      listPatients(clinicId),
      listGPLetterTemplates(),
      Promise.resolve(getClinicSync(clinicId)),
    ]);
    return <GPLetterNewClient patients={patients} templates={templates} clinic={clinic} clinicId={clinicId} />;
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : "Failed to load form data"} />;
  }
}
