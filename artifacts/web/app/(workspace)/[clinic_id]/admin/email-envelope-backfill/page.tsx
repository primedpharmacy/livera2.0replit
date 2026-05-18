/**
 * Admin → Email envelope backfill — Task-204.
 *
 * Staff-only one-click trigger for `backfillPatientNotificationEnvelopes`,
 * the job that reconstructs missing email snapshots on older patient
 * notification rows so the "Preview email" action works on historical sends.
 *
 * Until this page existed the job was only callable from code, which forced
 * an engineering hand-off every time we wanted to refresh coverage after a
 * data migration. Now Owner/Admin staff can run it themselves — optionally
 * scoped to a single clinic — and see a summary of what was backfilled vs.
 * flagged unrecoverable, with the run captured as an audit event so we know
 * who triggered it and when.
 *
 * Role gate: Owner or Admin only — matches the holidays/exports settings
 * pages. Enforced at the page level via a redirect for unauthorised
 * users, and re-checked inside the server action itself so a direct
 * action invocation by a non-privileged caller is refused before the
 * job runs.
 */

import { redirect } from "next/navigation";
import { CURRENT_USER } from "@/lib/api/mock";
import { recordAudit } from "@/lib/api/audit";
import {
  backfillPatientNotificationEnvelopes,
  type BackfillResult,
} from "@/lib/api/jobs/backfillPatientNotificationEnvelopes";
import type { ClinicId } from "@/types";
import { EmailEnvelopeBackfillPanel } from "@/components/admin/EmailEnvelopeBackfillPanel";

type PageProps = { params: Promise<{ clinic_id: string }> };

export default async function EmailEnvelopeBackfillPage({ params }: PageProps) {
  const { clinic_id } = await params;

  if (!CURRENT_USER.roles.some((r) => r === "Admin" || r === "Owner")) {
    redirect(`/${clinic_id}/dashboard`);
  }

  async function runBackfill(scope: "this_clinic" | "all_clinics"): Promise<BackfillResult> {
    "use server";

    // Server-side re-check: never trust the client gate alone. The job
    // mutates fixture state and emits audit events, so a non-privileged
    // caller invoking the action directly must be refused.
    if (!CURRENT_USER.roles.some((r) => r === "Admin" || r === "Owner")) {
      throw new Error("forbidden: Admin or Owner role required");
    }

    const scoped = scope === "this_clinic";
    const result = await backfillPatientNotificationEnvelopes(
      scoped ? (clinic_id as ClinicId) : undefined,
    );

    // Durable audit trail — Task-167 spine. The fire-and-forget pattern
    // mirrors every other recordAudit call site (fixtures/orders.ts etc.)
    // so a DB hiccup never bubbles up to the staff member who just ran it.
    void recordAudit({
      clinic_id: clinic_id as ClinicId,
      actor: CURRENT_USER,
      entity: { type: "patient_notification", id: scoped ? clinic_id : "ALL" },
      event_type: "patient_notification_envelope_backfill_run",
      summary:
        `Ran email envelope backfill (${scope === "this_clinic" ? `clinic ${clinic_id}` : "all clinics"}) — ` +
        `${result.backfilled.length} backfilled, ` +
        `${result.unrecoverable.length} unrecoverable, ` +
        `${result.html_backfilled.length} HTML backfilled, ` +
        `${result.html_unsupported.length} HTML unsupported.`,
      after: {
        scope,
        considered:           result.considered,
        backfilled_count:     result.backfilled.length,
        unrecoverable_count:  result.unrecoverable.length,
        html_backfilled:      result.html_backfilled.length,
        html_unsupported:     result.html_unsupported.length,
        skipped:              result.skipped,
        unrecoverable_reasons: result.unrecoverable.map((u) => ({
          notification_id: u.notification_id,
          reason:          u.reason ?? null,
        })),
      },
    });

    return result;
  }

  return (
    <div className="px-6 py-6 max-w-3xl">
      <div className="mb-6">
        <h2 className="text-[15px] font-bold text-t1">Email envelope backfill</h2>
        <p className="text-[12px] text-t3 mt-1 leading-relaxed">
          Reconstructs missing email snapshots on older patient notification rows so the
          &ldquo;Preview email&rdquo; action works on historical sends. Safe to re-run —
          rows that have already been backfilled or flagged are skipped.
        </p>
      </div>

      <EmailEnvelopeBackfillPanel
        clinicId={clinic_id as ClinicId}
        onRun={runBackfill}
      />
    </div>
  );
}
