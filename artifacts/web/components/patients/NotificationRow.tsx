/**
 * Shared renderer for a single PatientNotification row.
 *
 * Originally inlined inside `app/(workspace)/[clinic_id]/patients/[patient_id]/page.tsx`
 * (the per-patient Notification log tab — BLD-FCM-LOG-01). Task-199 extracts
 * it so any *other* consumer of `listPatientNotifications` / notification
 * rows that wants to render a status chip inherits the carrier-reason
 * rendering automatically — i.e. Failed/Bounced SMS rows always show the
 * Twilio `last_error` inline AND as a tooltip on the status chip, matching
 * the behaviour added in Task-137 / Task-173, instead of any new global or
 * order-level notification surface re-implementing it (and forgetting).
 */

import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { PatientNotification } from "@/lib/api/mock";
import type { ClinicId } from "@/lib/api/types";
import { NOW } from "@/lib/api/constants";
import { formatDateTime } from "@/lib/format";
import { EmailPreviewButton } from "@/components/patients/EmailPreviewButton";
import { ResendNotificationButton } from "@/components/patients/ResendNotificationButton";
import { SwitchToEmailButton } from "@/components/patients/SwitchToEmailButton";

export type ResendActionResult = { ok: true } | { ok: false; reason: string };

export function NotificationRow({
  notification: n,
  clinicId,
  patientId,
  canResend,
  onResend,
  currentChannel,
  canSwitchChannel,
}: {
  notification: PatientNotification;
  clinicId: ClinicId;
  // Task-200 — patientId, currentChannel and canSwitchChannel are optional
  // so non-patient-profile consumers of this shared row (e.g. order-level
  // notification surfaces) don't have to wire them up. The Switch-to-email
  // recovery action only mounts when all three are provided AND the row is
  // a Bounced/Failed SMS for a patient not already on email.
  patientId?: string;
  canResend: boolean;
  onResend: (notificationId: string) => Promise<ResendActionResult>;
  currentChannel?: 'email' | 'sms' | 'phone';
  canSwitchChannel?: boolean;
}) {
  const statusMeta =
    n.status === "Delivered"
      ? { Icon: CheckCircle2, cls: "bg-ok-bg text-ok border-ok-bdr" }
      : n.status === "Queued"
      ? { Icon: Clock, cls: "bg-info-bg text-info border-info-bdr" }
      : n.status === "Failed"
      ? { Icon: AlertCircle, cls: "bg-warn-bg text-warn border-warn-bdr" }
      : { Icon: XCircle, cls: "bg-err-bg text-err border-err-bdr" };
  const StatusIcon = statusMeta.Icon;

  return (
    // Task-201 — stable test hook so the SMS carrier-failure browser test
    // can scope per-row assertions to the exact NotificationRow being checked.
    <div className="px-4 py-3" data-testid={`notification-row-${n.id}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[11px] font-semibold text-t2 shrink-0">{n.id}</span>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-px rounded-full border shrink-0 ${statusMeta.cls}`}
          // Task-137 — surface the carrier reason as a tooltip on the status
          // chip itself so clinicians scanning the log see WHY an SMS failed
          // without expanding the row.
          title={n.last_error ?? undefined}
        >
          <StatusIcon className="w-3 h-3" /> {n.status}
        </span>
        <span className="text-[11px] font-semibold text-t2 shrink-0">{n.channel}</span>
        <span className="text-[12px] text-t1 font-medium">{n.type.replace(/_/g, " ")}</span>
        {n.order_id && (
          <Link
            href={`/${clinicId}/orders/${n.order_id}`}
            className="font-mono text-[11px] text-brand hover:underline shrink-0"
          >
            {n.order_id}
          </Link>
        )}
        <span className="text-[11px] text-t3 ml-auto shrink-0">{formatDateTime(n.sent_at)}</span>
      </div>
      {/* Task-173 — surface the underlying failure reason and the relative
          auto-retry countdown inline on Failed/Bounced rows so staff can
          decide whether to wait or resend without opening the payload. The
          full error is preserved in the `title` tooltip when truncated.
          The retry pill is shown independently of `last_error` so a Failed
          row with a future `next_retry_at` still surfaces the countdown
          even when no error string was captured. */}
      {(() => {
        const showError = (n.status === "Failed" || n.status === "Bounced") && !!n.last_error;
        const autoRetryIn =
          n.status === "Failed" && n.next_retry_at
            ? formatAutoRetryIn(n.next_retry_at, NOW)
            : null;
        if (!showError && !autoRetryIn) return null;
        return (
          <div className="mt-1.5 flex items-start gap-2 text-[11px] text-err leading-relaxed">
            {showError ? (
              <>
                <AlertCircle className="w-3 h-3 mt-px shrink-0" />
                <span
                  className="truncate min-w-0 flex-1"
                  title={n.last_error ?? undefined}
                >
                  <span className="font-semibold">Error:</span> {n.last_error}
                </span>
              </>
            ) : (
              <span className="min-w-0 flex-1" />
            )}
            {autoRetryIn && n.next_retry_at && (
              <span
                className="shrink-0 inline-flex items-center gap-1 px-1.5 py-px rounded-full border border-warn-bdr bg-warn-bg text-warn font-semibold"
                title={`Scheduled auto-retry at ${formatDateTime(n.next_retry_at)}`}
              >
                <Clock className="w-3 h-3" /> Auto-retry {autoRetryIn}
              </span>
            )}
          </div>
        );
      })()}
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-t3">
        <span>Template:</span>
        <code className="font-mono bg-page-bg px-1.5 py-px rounded border border-bdr text-t2">{n.template}</code>
        {n.attempt_count > 1 && (
          <span className="ml-2">
            Attempt {n.attempt_count}/{n.max_attempts}
          </span>
        )}
      </div>
      {n.email_envelope && (
        <div className="mt-2">
          <EmailPreviewButton envelope={n.email_envelope} notificationId={n.id} />
        </div>
      )}
      {/* Task-132 — explain why "Preview email" is missing on older rows
          that the envelope-backfill job could not reconstruct, instead of
          silently hiding the action. */}
      {!n.email_envelope && n.email_envelope_unavailable_reason && (
        <p className="mt-2 text-[11px] text-t3 italic">
          Email preview unavailable: {formatUnavailableReason(n.email_envelope_unavailable_reason)}
        </p>
      )}
      {/* Task-97 — staff-initiated immediate resend. Only on Failed rows that
          still have retry budget AND a captured email_envelope; Bounced rows
          are intentionally excluded per retry policy. */}
      {canResend
        && n.status === "Failed"
        && n.email_envelope
        && n.attempt_count < n.max_attempts && (
          <ResendNotificationButton notificationId={n.id} onResend={onResend} />
        )}
      {/* Task-200 — when an SMS keeps bouncing/failing, offer a one-click
          recovery to flip the patient's preferred channel to email. Gated by
          the same write:patients permission as the Contact-section editor,
          and only shown when the patient isn't already on email. Reuses
          updatePatientPreferredChannel so the existing change log + audit
          trail is written exactly as if staff had used the editor. The
          patientId / currentChannel / canSwitchChannel props are optional
          on this shared row so non-patient-profile consumers don't have to
          wire them up — the action simply hides when any are missing. */}
      {canSwitchChannel
        && patientId
        && currentChannel
        && n.channel === "SMS"
        && (n.status === "Bounced" || n.status === "Failed")
        && currentChannel !== "email" && (
          <SwitchToEmailButton clinicId={clinicId} patientId={patientId} />
        )}
      {Object.keys(n.payload).length > 0 && (
        <details className="mt-2 group">
          <summary className="text-[11px] font-semibold text-t3 cursor-pointer hover:text-t2 select-none">
            Payload
          </summary>
          <pre className="mt-1.5 text-[11px] leading-relaxed bg-page-bg border border-bdr rounded p-2 overflow-x-auto font-mono text-t2">
{JSON.stringify(n.payload, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

// Task-173 — render `next_retry_at` as a short relative countdown ("in 4 min",
// "in 2 h", "in <1 min") so staff investigating a failed notification can see
// at a glance how long until the scheduler retries on its own. Returns null
// when the retry time has already passed — in that case the sweep is due any
// moment now and the absolute timestamp would be more misleading than helpful.
function formatAutoRetryIn(iso: string, nowIso: string): string | null {
  const diffMs = new Date(iso).getTime() - new Date(nowIso).getTime();
  if (diffMs <= 0) return null;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "in <1 min";
  const min = Math.floor(sec / 60);
  if (min < 60) return `in ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `in ${hr} h`;
  const d = Math.floor(hr / 24);
  return `in ${d} d`;
}

// Task-132 — staff-facing copy for the `email_envelope_unavailable_reason`
// flag set by the envelope-backfill job. Kept colocated with the notification
// row renderer above so the wording can evolve alongside the UI.
function formatUnavailableReason(reason: string): string {
  switch (reason) {
    case 'patient_not_found':    return 'patient record is no longer on file.';
    case 'order_not_found':      return 'the originating order has been removed.';
    case 'no_email_on_file':     return 'no email address is on file for this patient.';
    case 'unsupported_template': return 'the email template is no longer supported.';
    default:                     return reason;
  }
}
