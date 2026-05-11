import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Breadcrumb } from "@/components/shell/Breadcrumb";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { AmendmentsView } from "@/components/amendments/AmendmentsView";
import { listAmendments } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type AmendmentsPageProps = { params: Promise<{ clinic_id: string }> };

export default async function AmendmentsPage({ params }: AmendmentsPageProps) {
  const { clinic_id } = await params;
  return (
    <>
      <Breadcrumb items={[{ label: "Amendments" }]} />
      <PageHeader
        icon={RefreshCw}
        title="Amendments"
        subtitle="Order amendment requests"
      />
      <Suspense key={clinic_id} fallback={<LoadingState.Table />}>
        <AmendmentsContent clinicId={clinic_id as ClinicId} />
      </Suspense>
    </>
  );
}

async function AmendmentsContent({ clinicId }: { clinicId: ClinicId }) {
  try {
    const amendments = await listAmendments(clinicId);

    if (amendments.length === 0) {
      return (
        <EmptyState
          icon={RefreshCw}
          title="No amendments yet"
          description="Amendment requests raised against orders in this workspace will appear here."
        />
      );
    }

    return <AmendmentsView initialAmendments={amendments} clinicId={clinicId} />;
  } catch (err) {
    return (
      <ErrorState
        message={err instanceof Error ? err.message : "Failed to load amendments"}
      />
    );
  }
}
