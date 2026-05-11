"use client";

import { FileText, Lock } from "lucide-react";

interface Props {
  isCompleted: boolean;
}

export function ConsultationPostCallActions({ isCompleted }: Props) {
  return (
    <div className={`bg-surface rounded-xl border p-4 ${
      isCompleted ? "border-bdr" : "border-dashed border-bdr opacity-60"
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-brand" />
        <h3 className="text-sm font-semibold text-t1">Post-call Actions</h3>
        {!isCompleted && (
          <span className="ml-auto flex items-center gap-1 text-xs text-t3">
            <Lock className="w-3.5 h-3.5" />
            Available after call
          </span>
        )}
      </div>

      {isCompleted ? (
        <div className="flex flex-col gap-2">
          <button className="w-full text-left px-3 py-2 rounded-lg border border-bdr hover:bg-page-bg text-sm text-t1 transition-colors">
            Draft clinical note (AI-assisted)
          </button>
          <button className="w-full text-left px-3 py-2 rounded-lg border border-bdr hover:bg-page-bg text-sm text-t1 transition-colors">
            Send GP letter
          </button>
          <button className="w-full text-left px-3 py-2 rounded-lg border border-bdr hover:bg-page-bg text-sm text-t1 transition-colors">
            Update order / raise amendment
          </button>
        </div>
      ) : (
        <p className="text-sm text-t3">
          Post-call actions — clinical notes, GP letters, and order updates — will be available
          once the consultation is marked as in progress.
        </p>
      )}
    </div>
  );
}
