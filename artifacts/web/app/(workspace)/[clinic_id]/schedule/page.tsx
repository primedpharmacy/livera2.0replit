import { Suspense } from "react";
import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { listConsultations, listPatients } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

const INITIAL_MONDAY = "2026-05-11";

export default async function SchedulePage({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <>
      <PageHeader
        icon={Calendar}
        title="Schedule"
        subtitle="Weekly consultation calendar"
      />
      <Suspense key={clinic_id} fallback={<LoadingState.Table />}>
        <ScheduleContent clinicId={clinic_id as ClinicId} />
      </Suspense>
    </>
  );
}

async function ScheduleContent({ clinicId }: { clinicId: ClinicId }) {
  const from = `${INITIAL_MONDAY}T00:00:00Z`;
  const to   = "2026-05-17T23:59:59Z";

  const [consultations, patients] = await Promise.all([
    listConsultations(clinicId, { from, to }),
    listPatients(clinicId),
  ]);

  const patientNames: Record<string, string> = {};
  patients.forEach((p) => {
    patientNames[p.id] = p.demographic.full_name;
  });

  return (
    <ScheduleView
      clinicId={clinicId}
      initialMonday={INITIAL_MONDAY}
      initialConsultations={consultations}
      initialPatientNames={patientNames}
    />
  );
}
