import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TaskDetailClient } from "@/components/tasks/TaskDetailClient";
import { getTask, listTeamMembers } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

interface Props {
  params: Promise<{ clinic_id: string; task_id: string }>;
}

async function TaskDetailContent({ clinicId, taskId }: { clinicId: string; taskId: string }) {
  try {
    const [task, members] = await Promise.all([
      getTask(clinicId as ClinicId, taskId),
      listTeamMembers(clinicId as ClinicId),
    ]);
    return <TaskDetailClient clinicId={clinicId} task={task} members={members} />;
  } catch {
    notFound();
  }
}

export default async function TaskDetailPage({ params }: Props) {
  const { clinic_id, task_id } = await params;
  return (
    <Suspense fallback={<div className="p-6 text-t3 text-sm">Loading task…</div>}>
      <TaskDetailContent clinicId={clinic_id} taskId={task_id} />
    </Suspense>
  );
}
