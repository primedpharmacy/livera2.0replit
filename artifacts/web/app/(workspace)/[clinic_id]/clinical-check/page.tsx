import { Suspense } from "react";
import { Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Breadcrumb } from "@/components/shell/Breadcrumb";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ClinicalCheckClient } from "@/components/clinical-check/ClinicalCheckClient";
import { getClinicalCheckQueue, getClinic, listCoachingLogs, listPatients } from "@/lib/api/mock";
import type { ClinicId, CoachingLog } from "@/types";

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
    const clinic = await getClinic(clinicId);
    const coachingEnabled = clinic.config.coaching_enabled;

    const fetches: Promise<unknown>[] = [
      getClinicalCheckQueue(clinicId),
      listPatients(clinicId),
    ];

    if (coachingEnabled) {
      fetches.push(listCoachingLogs(clinicId));
    }

    const results = await Promise.all(fetches);
    const orders   = results[0] as Awaited<ReturnType<typeof getClinicalCheckQueue>>;
    const patients = results[1] as Awaited<ReturnType<typeof listPatients>>;

    if (orders.length === 0) {
      return (
        <EmptyState
          icon={Stethoscope}
          title="Queue is clear"
          description="No orders are currently awaiting clinical review."
        />
      );
    }

    const patientNames: Record<string, string> = Object.fromEntries(
      patients.map((p) => [p.id, p.demographic.full_name])
    );

    // ── BLD-2.9: build coaching log map scoped to reorder patients ───────────
    let coachingLogsByPatientId: Record<string, CoachingLog[]> | undefined;
    if (coachingEnabled) {
      const allLogs = results[2] as CoachingLog[];
      const reorderPatientIds = new Set(
        orders.filter((o) => o.type === "reorder").map((o) => o.patient_id)
      );
      coachingLogsByPatientId = {};
      for (const log of allLogs) {
        if (!reorderPatientIds.has(log.patient_id)) continue;
        if (!coachingLogsByPatientId[log.patient_id]) {
          coachingLogsByPatientId[log.patient_id] = [];
        }
        coachingLogsByPatientId[log.patient_id].push(log);
      }
      // Sort each patient's logs newest-first
      for (const pid of Object.keys(coachingLogsByPatientId)) {
        coachingLogsByPatientId[pid].sort((a, b) =>
          b.entry_date.localeCompare(a.entry_date)
        );
      }
    }

    return (
      <ClinicalCheckClient
        orders={orders}
        clinic={clinic}
        clinicId={clinicId}
        patientNames={patientNames}
        coachingLogsByPatientId={coachingLogsByPatientId}
      />
    );
  } catch (err) {
    return (
      <ErrorState
        message={err instanceof Error ? err.message : "Failed to load clinical check queue"}
      />
    );
  }
}
