import { Suspense } from "react";
import { notFound } from "next/navigation";
import { WelcomeCallDetailClient } from "@/components/welcome-calls/WelcomeCallDetailClient";
import { getWelcomeCall, listTeamMembers, listPatients } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

interface Props {
  params: Promise<{ clinic_id: string; call_id: string }>;
}

async function WelcomeCallDetailContent({ clinicId, callId }: { clinicId: string; callId: string }) {
  try {
    const [call, members, patients] = await Promise.all([
      getWelcomeCall(clinicId as ClinicId, callId),
      listTeamMembers(clinicId as ClinicId),
      listPatients(clinicId as ClinicId),
    ]);
    const patient = patients.find((p) => p.id === call.patient_id);
    const patientName = patient?.demographic.full_name ?? call.patient_id;
    return (
      <WelcomeCallDetailClient
        clinicId={clinicId}
        call={call}
        patientName={patientName}
        members={members}
      />
    );
  } catch {
    notFound();
  }
}

export default async function WelcomeCallDetailPage({ params }: Props) {
  const { clinic_id, call_id } = await params;
  return (
    <Suspense fallback={<div className="p-6 text-t3 text-sm">Loading welcome call…</div>}>
      <WelcomeCallDetailContent clinicId={clinic_id} callId={call_id} />
    </Suspense>
  );
}
