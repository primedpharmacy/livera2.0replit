"use client";

/**
 * EmailPreviewButton — Task-98 / Task-131
 *
 * Renders a "Preview email" action for a notification row whose
 * `email_envelope` snapshot is non-null. Opens a modal that renders the
 * captured recipient, subject, and body so staff can verify exactly what
 * the patient saw — without having to read the raw payload JSON.
 *
 * Task-131 — when the envelope captured an `html_body`, the modal defaults
 * to a sandboxed iframe rendering of the styled HTML the patient actually
 * received (branding, buttons, formatting). A tab lets staff switch to the
 * plain-text fallback. Envelopes without an HTML snapshot (older rows)
 * fall straight to the plain-text view.
 *
 * The iframe is sandboxed with no allow-* flags, so the captured HTML
 * cannot run scripts, navigate the parent, or submit forms.
 */

import { useEffect, useMemo, useState } from "react";
import { Mail, X } from "lucide-react";
import type { PatientEmailEnvelope } from "@/lib/api/fixtures/patientNotifications";

type Tab = "html" | "text";

export function EmailPreviewButton({
  envelope,
  notificationId,
}: {
  envelope: PatientEmailEnvelope;
  notificationId: string;
}) {
  const [open, setOpen] = useState(false);
  const hasHtml = !!envelope.html_body;
  const [tab, setTab] = useState<Tab>(hasHtml ? "html" : "text");

  useEffect(() => {
    if (!open) return;
    // Reset to the richest view available each time the modal opens.
    setTab(hasHtml ? "html" : "text");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hasHtml]);

  // Memoise the srcdoc so the iframe doesn't reload on every render.
  const htmlSrcDoc = useMemo(() => envelope.html_body ?? "", [envelope.html_body]);

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

            {hasHtml && (
              <div
                role="tablist"
                aria-label="Email body format"
                className="flex items-center gap-1 px-5 pt-3 border-b border-bdr shrink-0"
              >
                <TabButton
                  active={tab === "html"}
                  onClick={() => setTab("html")}
                  label="HTML"
                />
                <TabButton
                  active={tab === "text"}
                  onClick={() => setTab("text")}
                  label="Plain text"
                />
              </div>
            )}

            <div className="overflow-y-auto flex-1">
              {hasHtml && tab === "html" ? (
                <iframe
                  title="Email HTML preview"
                  sandbox=""
                  srcDoc={htmlSrcDoc}
                  className="w-full h-[60vh] bg-white border-0"
                />
              ) : (
                <pre className="px-5 py-4 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-t1">
                  {envelope.text_body}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-3 py-1.5 text-[12px] font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-brand text-t1"
          : "border-transparent text-t3 hover:text-t1"
      }`}
    >
      {label}
    </button>
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
