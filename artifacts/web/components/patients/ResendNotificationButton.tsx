"use client";

/**
 * ResendNotificationButton — Task-97.
 *
 * Renders next to a Failed patient-notification row in the per-patient
 * Notification log tab. Clicking it asks the server to resend the email now
 * (bypassing the next_retry_at backoff window) via the same applyRetryOutcome
 * path as the scheduled retry job, then refreshes the route so the row's
 * status / attempt count / next_retry_at update in place.
 *
 * The permission gate lives in the server component that decides whether to
 * mount this button at all (Owner/Admin only). Bounced rows are filtered out
 * by the caller — they must never be retried per retry policy.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

type ResendAction = (notificationId: string) =>
  Promise<{ ok: true } | { ok: false; reason: string }>;

interface Props {
  notificationId: string;
  onResend: ResendAction;
}

export function ResendNotificationButton({ notificationId, onResend }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const result = await onResend(notificationId);
      if (!result.ok) {
        setError(reasonToMessage(result.reason));
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-bdr bg-surface text-t1 hover:bg-page-bg hover:border-brand disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw className={`w-3 h-3 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Resending…" : "Resend now"}
      </button>
      {error && (
        <span className="text-[11px] text-err">{error}</span>
      )}
    </div>
  );
}

function reasonToMessage(reason: string): string {
  switch (reason) {
    case "not_found":    return "Notification not found.";
    case "not_failed":   return "Only Failed notifications can be resent.";
    case "bounced":      return "Bounced notifications cannot be resent.";
    case "exhausted":    return "Retry attempts exhausted.";
    case "no_envelope":  return "Missing email content to resend.";
    default:             return "Could not resend.";
  }
}
