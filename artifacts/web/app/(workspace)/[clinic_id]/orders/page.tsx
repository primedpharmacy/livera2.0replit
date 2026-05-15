import { Suspense } from "react";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { OrdersView } from "@/components/orders/OrdersView";
import { listOrders, getClinicSync, listPatients } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type OrdersPageProps = { params: Promise<{ clinic_id: string }> };

export default async function OrdersPage({ params }: OrdersPageProps) {
  const { clinic_id } = await params;
  return (
    <div>
      <PageHeader
        icon={Package}
        title="Orders"
        subtitle="All orders across every state"
      />
      <Suspense key={clinic_id} fallback={<LoadingState.Table />}>
        <OrdersContent clinicId={clinic_id as ClinicId} />
      </Suspense>
    </div>
  );
}

async function OrdersContent({ clinicId }: { clinicId: ClinicId }) {
  try {
    const [orders, clinic, patients] = await Promise.all([
      listOrders(clinicId),
      Promise.resolve(getClinicSync(clinicId)),
      listPatients(clinicId),
    ]);

    if (orders.length === 0) {
      return (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="Orders placed by patients in this workspace will appear here."
        />
      );
    }

    const patientNames: Record<string, string> = Object.fromEntries(
      patients.map((p) => [p.id, p.demographic.full_name])
    );

    return (
      <OrdersView
        initialOrders={orders}
        clinicId={clinicId}
        clinic={clinic}
        patientNames={patientNames}
      />
    );
  } catch (err) {
    return (
      <ErrorState
        message={err instanceof Error ? err.message : "Failed to load orders"}
      />
    );
  }
}
