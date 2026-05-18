"use client";

/**
 * Workspace-level error boundary.
 * Catches any unhandled Server Component render errors and shows a
 * friendly recovery UI instead of a blank crash page.
 */

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function WorkspaceError({ error, reset }: Props) {
  useEffect(() => {
    console.error("[WorkspaceError]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-err-bg border border-err-bdr flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-err" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h1 className="text-[16px] font-bold text-t1">Something went wrong</h1>
        <p className="text-[13px] text-t2 leading-relaxed">
          A rendering error occurred. This is usually transient — try refreshing
          the page.
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-t3 mt-1">
            ref: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Try again
      </button>
    </div>
  );
}
