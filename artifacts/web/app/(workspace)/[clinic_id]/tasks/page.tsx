import { Suspense } from "react";
import { TasksView } from "@/components/tasks/TasksView";
import { listTasks, listTeamMembers } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

interface Props {
  params: Promise<{ clinic_id: string }>;
}

async function TasksContent({ clinicId }: { clinicId: string }) {
  const [tasks, members] = await Promise.all([
    listTasks(clinicId as ClinicId),
    listTeamMembers(clinicId as ClinicId),
  ]);
  return <TasksView clinicId={clinicId} tasks={tasks} members={members} />;
}

export default async function TasksPage({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <Suspense key={clinic_id} fallback={<div className="p-6 text-t3 text-sm">Loading…</div>}>
      <TasksContent clinicId={clinic_id} />
    </Suspense>
  );
}
