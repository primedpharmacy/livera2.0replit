"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { CoachingLogEntryForm } from "./CoachingLogEntryForm";
import type { ClinicId, CoachingLog } from "@/types";

interface Props {
  clinicId: ClinicId;
  patientId: string;
  patientName: string;
  onLogged?: (log: CoachingLog) => void;
}

export function CoachingLogEntryModal({ clinicId, patientId, patientName, onLogged }: Props) {
  const [open, setOpen] = useState(false);

  function handleSuccess(log: CoachingLog) {
    setOpen(false);
    onLogged?.(log);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold text-white bg-brand rounded-md hover:bg-brand-dark transition-colors"
      >
        <Plus className="w-4 h-4" />
        Log entry
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Dialog */}
          <div className="relative z-10 w-full max-w-xl bg-surface rounded-xl shadow-xl border border-bdr overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-bdr">
              <div>
                <h2 className="text-base font-semibold text-t1">Add coaching log entry</h2>
                <p className="text-[12px] text-t2 mt-0.5">{patientName}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md text-t3 hover:text-t1 hover:bg-page-bg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="px-5 py-4 max-h-[80vh] overflow-y-auto">
              <CoachingLogEntryForm
                clinicId={clinicId}
                patientId={patientId}
                onSuccess={handleSuccess}
                onCancel={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
