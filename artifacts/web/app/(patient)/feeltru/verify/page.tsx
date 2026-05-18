/**
 * Patient-facing SumSub identity verification — mock mirror of the live SDK.
 *
 * Task-326 (Wave 9a Foundations). Backend remains stubbed (no real applicant
 * is created), but the UX mirrors the three steps a patient sees in the real
 * SumSub WebSDK: applicant creation → document upload → liveness check →
 * confirmation. The clinic-facing patient profile surfaces the resulting
 * step/status/document_type/confidence on the Verification panel.
 *
 * Real integration arrives in a later wave; this screen exists so the rest of
 * the foundation work (types, fixtures, admin-side display) has a concrete
 * surface to point at.
 */
"use client";

import { useState } from "react";
import { ShieldCheck, FileText, Camera, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";

type Step = "applicant" | "document_upload" | "liveness" | "completed";
type DocType = "passport" | "driving_licence" | "national_id";

const STEP_ORDER: Step[] = ["applicant", "document_upload", "liveness", "completed"];

const STEP_META: Record<Step, { label: string; helper: string }> = {
  applicant: {
    label: "Create applicant",
    helper: "We securely create your verification record with SumSub.",
  },
  document_upload: {
    label: "Upload your ID",
    helper: "Choose a government-issued document. We'll mirror it to SumSub.",
  },
  liveness: {
    label: "Liveness check",
    helper: "A short selfie video confirms it's really you. No audio is captured.",
  },
  completed: {
    label: "All done",
    helper: "Your clinician will review your details shortly.",
  },
};

export default function PatientVerifyPage() {
  const [step, setStep] = useState<Step>("applicant");
  const [busy, setBusy] = useState(false);
  const [docType, setDocType] = useState<DocType | null>(null);

  const stepIdx = STEP_ORDER.indexOf(step);

  async function advance(next: Step) {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    setStep(next);
    setBusy(false);
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <header className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 text-[12px] uppercase tracking-wider text-t3 font-bold">
          <ShieldCheck className="w-3.5 h-3.5" /> FeelTru identity check
        </div>
        <h1 className="mt-2 text-xl font-semibold text-t1">Verify your identity</h1>
        <p className="mt-1 text-[13px] text-t2">
          Takes about 2 minutes. Powered by SumSub.
        </p>
      </header>

      {/* Step indicator */}
      <ol className="mb-6 flex items-center justify-between gap-2" aria-label="Verification steps">
        {STEP_ORDER.map((s, i) => {
          const reached = i <= stepIdx;
          const current = i === stepIdx;
          return (
            <li key={s} className="flex-1 flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border ${
                  reached
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-t3 border-bdr"
                } ${current ? "ring-2 ring-brand/30" : ""}`}
                aria-current={current ? "step" : undefined}
              >
                {i + 1}
              </span>
              {i < STEP_ORDER.length - 1 && (
                <span
                  className={`h-px flex-1 ${reached && i < stepIdx ? "bg-brand" : "bg-bdr"}`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>

      <section className="rounded-xl border border-bdr bg-surface p-5 shadow-sm">
        <h2 className="text-[15px] font-semibold text-t1">{STEP_META[step].label}</h2>
        <p className="mt-1 text-[12px] text-t2">{STEP_META[step].helper}</p>

        <div className="mt-5">
          {step === "applicant" && (
            <button
              type="button"
              onClick={() => advance("document_upload")}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 w-full rounded-md bg-brand px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {busy ? "Creating applicant…" : "Start verification"}
            </button>
          )}

          {step === "document_upload" && (
            <div className="space-y-3">
              <div className="space-y-2">
                {([
                  { id: "passport", label: "Passport" },
                  { id: "driving_licence", label: "Driving licence" },
                  { id: "national_id", label: "National ID card" },
                ] as Array<{ id: DocType; label: string }>).map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-2 rounded-md border p-3 text-[13px] cursor-pointer ${
                      docType === opt.id ? "border-brand bg-brand-light" : "border-bdr bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="doc_type"
                      value={opt.id}
                      checked={docType === opt.id}
                      onChange={() => setDocType(opt.id)}
                      className="accent-brand"
                    />
                    <FileText className="w-4 h-4 text-t3" />
                    <span className="font-medium text-t1">{opt.label}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => advance("liveness")}
                disabled={busy || !docType}
                className="inline-flex items-center justify-center gap-2 w-full rounded-md bg-brand px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {busy ? "Uploading document…" : "Upload document"}
              </button>
            </div>
          )}

          {step === "liveness" && (
            <div className="space-y-3">
              <div className="rounded-md border border-bdr bg-page-bg p-6 flex flex-col items-center text-center">
                <Camera className="w-10 h-10 text-t3" aria-hidden />
                <p className="mt-2 text-[12px] text-t2">
                  Position your face inside the oval and follow the on-screen prompts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => advance("completed")}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 w-full rounded-md bg-brand px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {busy ? "Running liveness check…" : "Capture liveness check"}
              </button>
            </div>
          )}

          {step === "completed" && (
            <div className="flex flex-col items-center text-center py-2">
              <CheckCircle2 className="w-12 h-12 text-ok" aria-hidden />
              <p className="mt-3 text-[14px] font-semibold text-t1">
                Verification submitted
              </p>
              <p className="mt-1 text-[12px] text-t2">
                We&apos;ll email you as soon as your clinician has reviewed your details.
              </p>
            </div>
          )}
        </div>
      </section>

      <p className="mt-4 text-[11px] text-t3 text-center">
        Mock SumSub flow — no real document data is captured.
      </p>
    </div>
  );
}
