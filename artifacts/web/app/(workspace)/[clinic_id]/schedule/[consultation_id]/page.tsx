import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  getConsultation,
  getPatient,
  getOrder,
  listConsultations,
} from "@/lib/api/mock";
import type { ClinicId } from "@/types";
import { ConsultationDetailClient } from "@/components/schedule/ConsultationDetailClient";

type Props = {
  params: Promise<{ clinic_id: string; consultation_id: string }>;
};

export default async function ConsultationDetailPage({ params }: Props) {
  const { clinic_id, consultation_id } = await params;
  const clinicId = clinic_id as ClinicId;

  let consultation;
  try {
    consultation = await getConsultation(clinicId, consultation_id);
  } catch {
    notFound();
  }

  const [patient, order, allConsultations] = await Promise.all([
    getPatient(clinicId, consultation.patient_id).catch(() => null),
    consultation.linked_order_id
      ? getOrder(clinicId, consultation.linked_order_id).catch(() => null)
      : Promise.resolve(null),
    listConsultations(clinicId).catch(() => []),
  ]);

  if (!patient) notFound();

  const history = allConsultations
    .filter(
      (c) =>
        c.patient_id === consultation.patient_id && c.id !== consultation.id
    )
    .sort((a, b) => b.scheduled_start.localeCompare(a.scheduled_start))
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Back bar */}
      <div className="flex items-center gap-2 px-6 py-3 bg-surface border-b border-bdr">
        <Link
          href={`/${clinicId}/schedule`}
          className="flex items-center gap-1.5 text-sm text-t2 hover:text-t1 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Schedule
        </Link>
        <span className="text-t3">/</span>
        <span className="text-sm font-medium text-t1">
          {patient.demographic.full_name} — {consultation.id}
        </span>
      </div>

      <ConsultationDetailClient
        consultation={consultation}
        patient={patient}
        order={order}
        history={history}
        clinicId={clinicId}
      />
    </div>
  );
}
