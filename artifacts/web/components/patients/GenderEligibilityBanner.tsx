"use client";

/**
 * GenderEligibilityBanner — BLD-10.2 / 10.3 / 10.4
 *
 * Shown when clinic.config.gender_eligibility === 'female_only'
 * AND patient.demographic.sex_at_birth !== 'female'.
 *
 * Legal basis: UK Equality Act 2010, Schedule 3, Paragraph 27.
 * FeelTru is a single-sex service for females — male/non-binary patients
 * should be redirected to VSC (gender-neutral clinic) or data purged
 * per UK GDPR Art 5(1)(c) (data minimisation).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, Trash2, X, ShieldAlert } from "lucide-react";
import { purgePatientData } from "@/lib/api/mock";
import { cn } from "@/lib/utils";
import type { ClinicId } from "@/types";

interface Props {
  clinicId: ClinicId;
  patientId: string;
  patientName: string;
  sexAtBirth: "female" | "male" | "other";
  genderEligibility: "female_only" | "gender_neutral";
  canPurge: boolean;
}

export function GenderEligibilityBanner({
  clinicId,
  patientId,
  patientName,
  sexAtBirth,
  genderEligibility,
  canPurge,
}: Props) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (genderEligibility !== "female_only" || sexAtBirth === "female" || dismissed) return null;

  const sexLabel = sexAtBirth === "male" ? "male" : "non-binary / other";

  async function handlePurge() {
    setPurging(true);
    setPurgeError(null);
    try {
      await purgePatientData(clinicId, patientId);
      router.push(`/${clinicId}/patients`);
    } catch (err) {
      setPurgeError(err instanceof Error ? err.message : "Purge failed");
      setPurging(false);
    }
  }

  return (
    <>
      {/* Banner */}
      <div className="mx-0 border-b border-err-bdr bg-err-bg px-5 py-3.5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-err shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-err leading-tight">
              Gender eligibility mismatch — action required
            </p>
            <p className="text-[12px] text-err/80 mt-1 leading-relaxed">
              <span className="font-semibold">{patientName}</span> is registered at FeelTru with sex at birth recorded as{" "}
              <span className="font-semibold">{sexLabel}</span>.
              FeelTru operates as a single-sex female service under{" "}
              <span className="font-semibold">UK Equality Act 2010, Schedule 3, Paragraph 27</span>.
              This patient must be redirected to VSC (gender-neutral) or their data purged.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <a
                href="https://vsc.health"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md bg-err text-white hover:bg-err/90 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Redirect to VSC ↗
              </a>
              {canPurge && (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md border border-err text-err bg-err-bg hover:bg-err/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Purge patient data
                </button>
              )}
              <button
                onClick={() => setDismissed(true)}
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-err/60 hover:text-err transition-colors"
              >
                <X className="w-3 h-3" /> Dismiss
              </button>
            </div>
            <p className="text-[10px] text-err/60 mt-2">
              DEC-16 · UK GDPR Art 5(1)(c) data minimisation applies if patient does not transfer to VSC.
            </p>
          </div>
        </div>
      </div>

      {/* Purge confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !purging && setShowConfirm(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-surface rounded-xl shadow-2xl border border-bdr mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-err-bg flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-err" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-t1">Purge patient data</h2>
                <p className="text-[12px] text-t3">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-err-bg border border-err-bdr rounded-lg px-4 py-3 mb-4">
              <p className="text-[12px] text-err font-semibold mb-1">
                You are about to permanently delete all Livera data for:
              </p>
              <p className="text-[14px] font-bold text-t1">{patientName}</p>
              <p className="text-[11px] font-mono text-t3 mt-0.5">{patientId}</p>
            </div>

            <div className="space-y-2 mb-5">
              <p className="text-[12px] text-t2">
                <span className="font-semibold">Legal basis:</span> UK GDPR Art 5(1)(c) — data minimisation.
                This patient does not meet FeelTru's gender eligibility criteria.
              </p>
              <p className="text-[12px] text-t2">
                <span className="font-semibold">What gets deleted:</span> Patient profile, orders, clinical notes, and all linked records in this Livera instance.
              </p>
              <p className="text-[11px] text-warn bg-warn-bg border border-warn-bdr rounded px-3 py-2">
                Primed API purge requires a separate request to Yohan's backend team (V1.2 scope). This action removes data from the Livera mirror only.
              </p>
            </div>

            {purgeError && (
              <p className="text-[12px] text-err mb-3">{purgeError}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={purging}
                className="px-4 py-1.5 text-[12px] font-semibold border border-bdr rounded-md text-t2 hover:text-t1 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePurge}
                disabled={purging}
                className={cn(
                  "px-4 py-1.5 text-[12px] font-semibold rounded-md bg-err text-white transition-colors",
                  purging ? "opacity-60 cursor-not-allowed" : "hover:bg-err/90"
                )}
              >
                {purging ? "Purging..." : "Confirm purge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
