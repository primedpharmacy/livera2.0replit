import { Suspense } from "react";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { GPLettersView } from "@/components/gp-letters/GPLettersView";
import { listGPLetters, listPatients, listGPLetterTemplates, getClinicSync } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function GPLettersPage({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <div>
      <PageHeader
        icon={FileText}
        title="GP Letters"
        subtitle="Correspondence sent to GPs on behalf of patients"
      />
      <Suspense key={clinic_id} fallback={<LoadingState.Table />}>
        <GPLettersContent clinicId={clinic_id as ClinicId} />
      </Suspense>
    </div>
  );
}

async function GPLettersContent({ clinicId }: { clinicId: ClinicId }) {
  try {
    const [letters, patients, templates, clinic] = await Promise.all([
      listGPLetters(clinicId),
      listPatients(clinicId),
      listGPLetterTemplates(clinicId),
      Promise.resolve(getClinicSync(clinicId)),
    ]);
    if (letters.length === 0) {
      return (
        <EmptyState
          icon={FileText}
          title="No GP letters yet"
          description="Letters drafted or sent to GPs will appear here."
        />
      );
    }
    return <GPLettersView initialLetters={letters} patients={patients} templates={templates} clinicId={clinicId} clinic={clinic} />;
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : "Failed to load GP letters"} />;
  }
}
