import { Suspense } from "react";
import { Home } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Breadcrumb } from "@/components/shell/Breadcrumb";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { DashboardView } from "@/components/dashboard/DashboardView";
import {
  getClinic,
  listClinicalEscalationFlags,
  CURRENT_USER,
} from "@/lib/api/mock";
import type { ClinicId, ClinicalEscalationFlag } from "@/types";

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

    const openEscalations: ClinicalEscalationFlag[] = coachingEnabled
      ? await listClinicalEscalationFlags(clinicId, { status: "open" })
      : [];

    return (
      <DashboardView
        clinicId={clinicId}
        coachingEnabled={coachingEnabled}
        openEscalations={openEscalations}
        currentUserRoles={CURRENT_USER.roles}
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
