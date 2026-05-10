import { Suspense } from "react";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { OrdersView } from "@/components/orders/OrdersView";
import { listOrders, getClinicSync } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

interface OrdersPageProps {
  params: { clinic_id: string };
}

export default function OrdersPage({ params }: OrdersPageProps) {
  return (
    <div>
      <PageHeader
        icon={Package}
        title="Orders"
        subtitle="All orders for this workspace"
      />
      <Suspense key={params.clinic_id} fallback={<LoadingState.Table />}>
        <OrdersContent clinicId={params.clinic_id as ClinicId} />
      </Suspense>
    </div>
  );
}

async function OrdersContent({ clinicId }: { clinicId: ClinicId }) {
  try {
    const [orders, clinic] = await Promise.all([
      listOrders(clinicId),
      Promise.resolve(getClinicSync(clinicId)),
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
    return <OrdersView initialOrders={orders} clinicId={clinicId} clinic={clinic} />;
  } catch (err) {
    return (
      <ErrorState
        message={err instanceof Error ? err.message : "Failed to load orders"}
      />
    );
  }
}
