"use client";

/**
 * EmailPreviewButton — Task-98
 *
 * Renders a "Preview email" action for a notification row whose
 * `email_envelope` snapshot is non-null. Opens a modal that renders the
 * captured recipient, subject, and text body so staff can verify exactly
 * what the patient saw — without having to read the raw payload JSON.
 *
 * The envelope was captured at first-send time (see Task-66) so this is the
 * exact content delivered to the patient, including any retry resends.
 */

import { useEffect, useState } from "react";
import { Mail, X } from "lucide-react";
import type { PatientEmailEnvelope } from "@/lib/api/fixtures/patientNotifications";

export function EmailPreviewButton({
  envelope,
  notificationId,
}: {
  envelope: PatientEmailEnvelope;
  notificationId: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
      >
        <Mail className="w-3 h-3" /> Preview email
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Email preview"
        >
          <div
            className="bg-surface border border-bdr rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-bdr shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-4 h-4 text-t2 shrink-0" />
                <h2 className="text-[14px] font-semibold text-t1 truncate">
                  Email preview
                </h2>
                <span className="font-mono text-[11px] text-t3 shrink-0">
                  {notificationId}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-page-bg text-t3 hover:text-t1"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-bdr shrink-0 space-y-1.5">
              <HeaderRow label="To" value={envelope.to_email} mono />
              <HeaderRow label="Subject" value={envelope.subject} />
              <HeaderRow label="Template" value={envelope.template} mono />
            </div>

            <div className="px-5 py-4 overflow-y-auto flex-1">
              <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-t1">{envelope.text_body}</pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HeaderRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 text-[12px]">
      <span className="text-t3 w-16 shrink-0">{label}</span>
      <span className={`text-t1 ${mono ? "font-mono" : ""} break-all`}>{value}</span>
    </div>
  );
}
