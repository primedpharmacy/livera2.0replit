'use client';

/**
 * Run-cleanup button — Task-249.
 *
 * Triggers `cleanupPatientContactData` server-side via a server action,
 * then relies on the action's `revalidatePath` to refresh the page so any
 * newly-fixed records drop off the list. Disabled while the job is in
 * flight; errors are surfaced inline beneath the button.
 */

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { triggerPatientContactCleanupAction } from './actions';

export function RunCleanupButton({ clinicId }: { clinicId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await triggerPatientContactCleanupAction(clinicId);
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
        {isPending ? 'Running cleanup…' : 'Run cleanup now'}
      </button>
      {error && (
        <div className="text-[11px] text-err max-w-[40ch] text-right" role="alert">
          Cleanup failed: {error}
        </div>
      )}
    </div>
  );
}
