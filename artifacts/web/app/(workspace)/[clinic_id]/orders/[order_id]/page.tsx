import { notFound } from "next/navigation";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Suspense } from "react";
import { OrderDetailClient } from "@/components/orders/OrderDetailClient";
import { getOrder, getPatient, getClinicSync, listClinicalNotes, listPatientNotifications } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type OrderDetailPageProps = { params: Promise<{ clinic_id: string; order_id: string }> };

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { clinic_id, order_id } = await params;
  return (
    <div className="flex flex-col h-full">
      <Suspense
        key={`${clinic_id}-${order_id}`}
        fallback={<LoadingState.Detail />}
      >
        <OrderContent clinicId={clinic_id as ClinicId} orderId={order_id} />
      </Suspense>
    </div>
  );
}

async function OrderContent({ clinicId, orderId }: { clinicId: ClinicId; orderId: string }) {
  try {
    const order = await getOrder(clinicId, orderId);
    const [patient, clinicalNotes, orderNotifications] = await Promise.all([
      getPatient(clinicId, order.patient_id),
      listClinicalNotes(clinicId, { patient_id: order.patient_id }),
      // Task-199 — fetch this order's notifications so the order-level
      // panel can surface the Twilio carrier reason on Bounced/Failed SMS
      // rows inline (same renderer as the per-patient log) without staff
      // having to drill into the patient profile.
      listPatientNotifications(clinicId, { order_id: orderId }),
    ]);
    const clinic = getClinicSync(clinicId);

    return (
      <OrderDetailClient
        initialOrder={order}
        patient={patient}
        clinic={clinic}
        clinicId={clinicId}
        initialClinicalNotes={clinicalNotes}
        orderNotifications={orderNotifications}
      />
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      notFound();
    }
    return (
      <ErrorState message={err instanceof Error ? err.message : "Failed to load order"} />
    );
  }
}
