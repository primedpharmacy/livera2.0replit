import { Suspense } from "react";
import { TasksView } from "@/components/tasks/TasksView";

interface Props {
  params: Promise<{ clinic_id: string }>;
}

async function TasksContent({ clinic_id }: { clinic_id: string }) {
  return <TasksView clinicId={clinic_id} />;
}

export default async function TasksPage({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <Suspense key={clinic_id} fallback={<div className="p-6 text-t3 text-sm">Loading…</div>}>
      <TasksContent clinic_id={clinic_id} />
    </Suspense>
  );
}
