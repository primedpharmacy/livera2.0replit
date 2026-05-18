/**
 * Reports → Patient Flag Changes — Task-226
 *
 * Cross-patient audit/activity view for VIP / status / coach changes
 * (patient_vip_updated, patient_status_updated, patient_coach_updated).
 * Sits alongside the existing AUD-1x reports as the natural global home
 * for the per-patient breadcrumbs added in task-150.
 */

import { History } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Breadcrumb } from "@/components/shell/Breadcrumb";
import { PatientFlagChangesReport } from "@/components/reports/PatientFlagChangesReport";
import { listPatientFlagChanges, listPatients } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function PatientFlagChangesPage({ params }: Props) {
  const { clinic_id } = await params;
  const clinicId = clinic_id as ClinicId;

  const [changes, patients] = await Promise.all([
    listPatientFlagChanges(clinicId),
    listPatients(clinicId),
  ]);

  const patientRefs = patients.map((p) => ({
    id: p.id,
    full_name: p.demographic.full_name,
  }));

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Reports", href: `/${clinic_id}/reports` },
          { label: "Patient Flag Changes" },
        ]}
      />
      <PageHeader
        icon={History}
        title="Patient Flag Changes"
        subtitle="Cross-patient activity log · patient_vip_updated · patient_status_updated · patient_coach_updated · filter by actor and date · click through to the affected patient"
      />
      <PatientFlagChangesReport
        clinicId={clinic_id}
        changes={changes}
        patients={patientRefs}
      />
    </>
  );
}
