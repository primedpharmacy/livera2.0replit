import { Suspense } from "react";
import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function SchedulePage({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <>
      <PageHeader
        icon={Calendar}
        title="Schedule"
        subtitle="Weekly consultation calendar"
      />
      <Suspense key={clinic_id} fallback={<LoadingState.Table />}>
        <ScheduleView clinicId={clinic_id as ClinicId} initialMonday="2026-05-11" />
      </Suspense>
    </>
  );
}
