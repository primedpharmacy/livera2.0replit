import { Suspense } from "react";
import { Home } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Breadcrumb } from "@/components/shell/Breadcrumb";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { DashboardView } from "@/components/dashboard/DashboardView";
import {
  getClinic,
  getClinicalCheckQueue,
  listPatients,
  listOrders,
  listComplaints,
  listConsultations,
  listIncidents,
  listClinicalEscalationFlags,
} from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type DashboardPageProps = { params: Promise<{ clinic_id: string }> };

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { clinic_id } = await params;
  return (
    <>
      <Breadcrumb items={[{ label: "Dashboard" }]} />
      <PageHeader
        icon={Home}
        title="Dashboard"
        subtitle="Overview of activity across the clinic"
      />
      <Suspense key={clinic_id} fallback={<LoadingState.Table />}>
        <DashboardContent clinicId={clinic_id as ClinicId} />
      </Suspense>
    </>
  );
}

async function DashboardContent({ clinicId }: { clinicId: ClinicId }) {
  try {
    const clinic = await getClinic(clinicId);
    const coachingEnabled = clinic.config.coaching_enabled;

    const fetches: Promise<unknown>[] = [
      getClinicalCheckQueue(clinicId),
      listPatients(clinicId),
      listOrders(clinicId),
      listComplaints(clinicId),
      listConsultations(clinicId),
      listIncidents(clinicId),
    ];

    if (coachingEnabled) {
      fetches.push(listClinicalEscalationFlags(clinicId, { status: "open" }));
    }

    const results = await Promise.all(fetches);
    const clinicalQueue   = results[0] as Awaited<ReturnType<typeof getClinicalCheckQueue>>;
    const patients        = results[1] as Awaited<ReturnType<typeof listPatients>>;
    const orders          = results[2] as Awaited<ReturnType<typeof listOrders>>;
    const complaints      = results[3] as Awaited<ReturnType<typeof listComplaints>>;
    const consultations   = results[4] as Awaited<ReturnType<typeof listConsultations>>;
    const incidents       = results[5] as Awaited<ReturnType<typeof listIncidents>>;
    const openEscalations = coachingEnabled
      ? (results[6] as Awaited<ReturnType<typeof listClinicalEscalationFlags>>)
      : [];

    const patientNames: Record<string, string> = Object.fromEntries(
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
        coachingEnabled={coachingEnabled}
        openEscalationCount={openEscalations.length}
      />
    );
  } catch (err) {
    return (
      <ErrorState
        message={err instanceof Error ? err.message : "Failed to load dashboard"}
      />
    );
  }
}
