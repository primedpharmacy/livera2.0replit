import { Suspense } from "react";
import { Phone } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { WelcomeCallsClient } from "@/components/welcome-calls/WelcomeCallsClient";
import { listConsultations, listPatients } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function WelcomeCallsPage({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <>
      <PageHeader
        icon={Phone}
        title="Welcome Calls"
        subtitle="Onboarding calls for new patients"
      />
      <Suspense key={clinic_id} fallback={<LoadingState.Table />}>
        <WelcomeCallsContent clinicId={clinic_id as ClinicId} />
      </Suspense>
    </>
  );
}

async function WelcomeCallsContent({ clinicId }: { clinicId: ClinicId }) {
  try {
    const [consultations, patients] = await Promise.all([
      listConsultations(clinicId, { type: "welcome_call" }),
      listPatients(clinicId),
    ]);
    const patientNames: Record<string, string> = {};
    patients.forEach((p) => {
      patientNames[p.id] = p.demographic.full_name;
    });
    return (
      <WelcomeCallsClient
        consultations={consultations}
        patientNames={patientNames}
        clinicId={clinicId}
      />
    );
  } catch (err) {
    return (
      <ErrorState
        message={
          err instanceof Error ? err.message : "Failed to load welcome calls"
        }
      />
    );
  }
}
