import { Suspense } from "react";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { WelcomeCallDetailClient } from "@/components/welcome-calls/WelcomeCallDetailClient";
import {
  getWelcomeCall,
  listTeamMembers,
  listPatients,
  logWelcomeCallAttempt,
  markWelcomeCallUnreachable,
  reopenWelcomeCall,
  editWelcomeCallAttempt,
  addWelcomeCallNote,
  createTask,
  CURRENT_USER,
} from "@/lib/api/mock";
import type {
  LogWelcomeCallAttemptInput,
  EditWelcomeCallAttemptInput,
} from "@/lib/api/mock";
import type { ClinicId } from "@/types";

interface Props {
  params: Promise<{ clinic_id: string; call_id: string }>;
}

async function WelcomeCallDetailContent({ clinicId, callId }: { clinicId: string; callId: string }) {
  try {
    const [call, members, patients] = await Promise.all([
      getWelcomeCall(clinicId as ClinicId, callId),
      listTeamMembers(clinicId as ClinicId),
      listPatients(clinicId as ClinicId),
    ]);
    const patient = patients.find((p) => p.id === call.patient_id);
    const patientName = patient?.demographic.full_name ?? call.patient_id;

    // ── Server actions — Task-157 ────────────────────────────────────────
    // Persist welcome-call state transitions and revalidate so the detail
    // page (and any list rendered server-side) shows the saved state after
    // navigation or a hard refresh.
    async function handleLogAttempt(input: LogWelcomeCallAttemptInput) {
      "use server";
      try {
        await logWelcomeCallAttempt(clinicId as ClinicId, callId, input);
        revalidatePath(`/${clinicId}/welcome-calls/${callId}`);
        revalidatePath(`/${clinicId}/welcome-calls`);
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, reason: err instanceof Error ? err.message : "Failed to log attempt" };
      }
    }

    async function handleMarkUnreachable(reason: string) {
      "use server";
      try {
        await markWelcomeCallUnreachable(clinicId as ClinicId, callId, reason);
        revalidatePath(`/${clinicId}/welcome-calls/${callId}`);
        revalidatePath(`/${clinicId}/welcome-calls`);
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, reason: err instanceof Error ? err.message : "Failed to mark unreachable" };
      }
    }

    async function handleEditAttempt(attemptId: string, input: EditWelcomeCallAttemptInput) {
      "use server";
      try {
        await editWelcomeCallAttempt(clinicId as ClinicId, callId, attemptId, input);
        revalidatePath(`/${clinicId}/welcome-calls/${callId}`);
        revalidatePath(`/${clinicId}/welcome-calls`);
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, reason: err instanceof Error ? err.message : "Failed to edit attempt" };
      }
    }

    async function handleAddNote(body: string) {
      "use server";
      try {
        await addWelcomeCallNote(clinicId as ClinicId, callId, body);
        revalidatePath(`/${clinicId}/welcome-calls/${callId}`);
        revalidatePath(`/${clinicId}/welcome-calls`);
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, reason: err instanceof Error ? err.message : "Failed to add note" };
      }
    }

    async function handleEscalateToPrescriber(reason: string) {
      "use server";
      try {
        const trimmed = reason.trim();
        if (!trimmed) {
          return { ok: false as const, reason: "A reason is required to escalate." };
        }
        const task = await createTask(clinicId as ClinicId, {
          title: `Escalate to prescriber — welcome call ${call.id} unreachable`,
          priority: "high",
          due_date: new Date().toISOString().slice(0, 10),
          description:
            `${patientName} (${call.patient_id}) could not be reached for their welcome call after ${call.attempts.length} attempt${call.attempts.length === 1 ? "" : "s"}.\n` +
            `Original order: ${call.order_id}\n` +
            `Welcome call: ${call.id}\n\n` +
            `Reason for escalation:\n${trimmed}\n\n` +
            `Raised by ${CURRENT_USER.full_name} from the welcome-call detail page.`,
        });
        revalidatePath(`/${clinicId}/tasks`);
        revalidatePath(`/${clinicId}/tasks/${task.id}`);
        revalidatePath(`/${clinicId}/welcome-calls/${callId}`);
        return { ok: true as const, taskId: task.id };
      } catch (err) {
        return { ok: false as const, reason: err instanceof Error ? err.message : "Failed to escalate." };
      }
    }

    async function handleReopen() {
      "use server";
      try {
        await reopenWelcomeCall(clinicId as ClinicId, callId);
        revalidatePath(`/${clinicId}/welcome-calls/${callId}`);
        revalidatePath(`/${clinicId}/welcome-calls`);
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, reason: err instanceof Error ? err.message : "Failed to reopen call" };
      }
    }

    return (
      <WelcomeCallDetailClient
        clinicId={clinicId}
        call={call}
        patientName={patientName}
        members={members}
        onLogAttempt={handleLogAttempt}
        onMarkUnreachable={handleMarkUnreachable}
        onReopen={handleReopen}
        onEditAttempt={handleEditAttempt}
        onAddNote={handleAddNote}
        onEscalateToPrescriber={handleEscalateToPrescriber}
      />
    );
  } catch {
    notFound();
  }
}

export default async function WelcomeCallDetailPage({ params }: Props) {
  const { clinic_id, call_id } = await params;
  return (
    <Suspense fallback={<div className="p-6 text-t3 text-sm">Loading welcome call…</div>}>
      <WelcomeCallDetailContent clinicId={clinic_id} callId={call_id} />
    </Suspense>
  );
}
