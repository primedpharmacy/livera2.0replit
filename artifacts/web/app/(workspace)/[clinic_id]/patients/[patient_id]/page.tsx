import { Suspense } from "react";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PatientProfileView } from "@/components/patients/PatientProfileView";
import {
  getPatient,
  getClinic,
  listOrders,
  listIncidents,
  listComplaints,
  listConsultations,
  listCoachingLogs,
} from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string; patient_id: string }> };

export default async function PatientProfilePage({ params }: Props) {
  const { clinic_id, patient_id } = await params;
  return (
    <Suspense key={`${clinic_id}-${patient_id}`} fallback={<LoadingState.Detail />}>
      <ProfileContent clinicId={clinic_id as ClinicId} patientId={patient_id} />
    </Suspense>
  );
}

async function ProfileContent({ clinicId, patientId }: { clinicId: ClinicId; patientId: string }) {
  try {
    const [patient, clinic, orders, allIncidents, allComplaints, allConsultations, allCoachingLogs] =
      await Promise.all([
        getPatient(clinicId, patientId),
        getClinic(clinicId),
        listOrders(clinicId, { patient_id: patientId }),
        listIncidents(clinicId),
        listComplaints(clinicId),
        listConsultations(clinicId),
        listCoachingLogs(clinicId, { patient_id: patientId }),
      ]);

    const incidents    = allIncidents.filter((i) => i.patient_id === patientId);
    const complaints   = allComplaints.filter((c) => c.patient_id === patientId);
    const consultations = allConsultations.filter((c) => c.patient_id === patientId);

    return (
      <PatientProfileView
        patient={patient}
        clinic={clinic}
        clinicId={clinicId}
        orders={orders}
        incidents={incidents}
        complaints={complaints}
        consultations={consultations}
        coachingLogs={allCoachingLogs}
      />
    );
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : "Failed to load patient"} />;
  }
}
