'use client';

/**
 * Run-sweep button — Task-155.
 *
 * Triggers `runPatientNotificationRetrySweep` server-side via a server action,
 * then relies on the action's `revalidatePath` to refresh the page so the
 * new rows appear at the top. Disabled while a sweep is in flight; errors
 * are surfaced inline beneath the button.
 */

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { triggerRetrySweepAction } from './actions';

export function RunSweepButton({ clinicId }: { clinicId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await triggerRetrySweepAction(clinicId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand text-white text-[13px] font-semibold border border-brand hover:bg-brand/90 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} aria-hidden />
        {isPending ? 'Running sweep…' : 'Run sweep now'}
      </button>
      {error && (
        <div className="text-[11px] text-err max-w-[40ch] text-right" role="alert">
          Sweep failed: {error}
        </div>
      )}
    </div>
  );
}
