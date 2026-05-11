import { Suspense } from "react";
import { Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Breadcrumb } from "@/components/shell/Breadcrumb";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ClinicalCheckClient } from "@/components/clinical-check/ClinicalCheckClient";
import { getClinicalCheckQueue, getClinicSync } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type ClinicalCheckPageProps = { params: Promise<{ clinic_id: string }> };

export default async function ClinicalCheckPage({ params }: ClinicalCheckPageProps) {
  const { clinic_id } = await params;
  return (
    <>
      <Breadcrumb items={[{ label: "Clinical Check" }]} />
      <PageHeader
        icon={Stethoscope}
        title="Clinical Check"
        subtitle="Orders awaiting clinical review"
      />
      <Suspense key={clinic_id} fallback={<LoadingState.Table />}>
        <ClinicalCheckContent clinicId={clinic_id as ClinicId} />
      </Suspense>
    </>
  );
}

async function ClinicalCheckContent({ clinicId }: { clinicId: ClinicId }) {
  try {
    const [orders, clinic] = await Promise.all([
      getClinicalCheckQueue(clinicId),
      Promise.resolve(getClinicSync(clinicId)),
    ]);

    if (orders.length === 0) {
      return (
        <EmptyState
          icon={Stethoscope}
          title="Queue is clear"
          description="No orders are currently awaiting clinical review."
        />
      );
    }

    return <ClinicalCheckClient orders={orders} clinic={clinic} clinicId={clinicId} />;
  } catch (err) {
    return (
      <ErrorState
        message={err instanceof Error ? err.message : "Failed to load clinical check queue"}
      />
    );
  }
}
