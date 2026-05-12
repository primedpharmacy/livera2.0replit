import { Suspense } from "react";
import { LoadingState } from "@/components/shared/LoadingState";
import { DashboardView } from "@/components/dashboard/DashboardView";
import {
  getClinic,
  getClinicalCheckQueue,
  listOrders,
  listComplaints,
  listConsultations,
  listIncidents,
  listPatients,
} from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function DashboardPage({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <Suspense key={clinic_id} fallback={<LoadingState.Detail />}>
      <DashboardContent clinicId={clinic_id as ClinicId} />
    </Suspense>
  );
}

async function DashboardContent({ clinicId }: { clinicId: ClinicId }) {
  const [clinic, orders, clinicalQueue, complaints, consultations, incidents, patients] =
    await Promise.all([
      getClinic(clinicId),
      listOrders(clinicId),
      getClinicalCheckQueue(clinicId),
      listComplaints(clinicId),
      listConsultations(clinicId),
      listIncidents(clinicId),
      listPatients(clinicId),
    ]);

  const patientNames = Object.fromEntries(
    patients.map((p) => [p.id, p.demographic.full_name])
  );

  return (
    <DashboardView
      clinicId={clinicId}
      clinic={clinic}
      orders={orders}
      clinicalQueue={clinicalQueue}
      complaints={complaints}
      consultations={consultations}
      incidents={incidents}
      patients={patients}
      patientNames={patientNames}
    />
  );
}
