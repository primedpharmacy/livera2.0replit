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
  listSlaBreaches,
  getClinicalCheckQueue,
  listOrders,
  listComplaints,
  listIncidents,
  listTasks,
  listWelcomeCalls,
  listPatients,
  listDeliveryExceptions,
  CURRENT_USER,
} from "@/lib/api/mock";
import type {
  ClinicId,
  ClinicalEscalationFlag,
  SlaBreach,
  Order,
  Complaint,
  Incident,
  Task,
  WelcomeCall,
  CourierEvent,
} from "@/types";

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

    const [
      openEscalations,
      openSlaBreaches,
      clinicalCheckOrders,
      allOrders,
      allComplaints,
      allIncidents,
      allTasks,
      allWelcomeCalls,
      allPatients,
      deliveryExceptions,
    ] = await Promise.all([
      coachingEnabled
        ? listClinicalEscalationFlags(clinicId, { status: "open" })
        : Promise.resolve([] as ClinicalEscalationFlag[]),
      listSlaBreaches(clinicId, { status: "open" }),
      getClinicalCheckQueue(clinicId),
      listOrders(clinicId),
      listComplaints(clinicId),
      listIncidents(clinicId),
      listTasks(clinicId),
      listWelcomeCalls(clinicId),
      listPatients(clinicId),
      listDeliveryExceptions(clinicId),
    ]);

    const patientMap: Record<string, string> = Object.fromEntries(
      allPatients.map((p) => [p.id, p.demographic.full_name])
    );

    const openComplaints = allComplaints.filter(
      (c) => !["resolved", "closed"].includes(c.status)
    );
    const recentIncidents = [...allIncidents]
      .filter((i) => i.status !== "closed")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 3);
    const myTasks = allTasks.filter(
      (t) => t.owner_user_id === CURRENT_USER.id && t.status !== "done"
    );
    const welcomeCallsDue = allWelcomeCalls.filter(
      (w) => w.status === "awaiting" || w.status === "attempted"
    );

    // Task-125 — Orders that still need the patient to upload their current
    // GLP-1 prescription. Mirrors the gate used in decideOrder / resendPxUploadLink.
    const pxUploadPendingOrders = (allOrders as Order[]).filter(
      (o) =>
        (o.contextual_flags?.includes("Px upload pending") ?? false) &&
        o.px_upload == null &&
        o.status !== "cancelled" &&
        o.status !== "expired" &&
        o.status !== "declined",
    );

    return (
      <DashboardView
        clinicId={clinicId}
        coachingEnabled={coachingEnabled}
        openEscalations={openEscalations}
        openSlaBreaches={openSlaBreaches as SlaBreach[]}
        currentUserRoles={CURRENT_USER.roles}
        clinicalCheckOrders={clinicalCheckOrders as Order[]}
        allOrders={allOrders as Order[]}
        openComplaints={openComplaints as Complaint[]}
        recentIncidents={recentIncidents as Incident[]}
        myTasks={myTasks as Task[]}
        welcomeCallsDue={welcomeCallsDue as WelcomeCall[]}
        deliveryExceptions={deliveryExceptions as CourierEvent[]}
        pxUploadPendingOrders={pxUploadPendingOrders}
        patientMap={patientMap}
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
