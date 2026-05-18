"use client";

/**
 * OrderBMIValidationCard — BLD-16.2
 *
 * Three-up BMI validation card shown on the Clinical evidence tab when
 * clinic.config.features.bmi_ai_validation_enabled is true.
 *
 * Columns:
 *   1. Self-reported — height/weight/BMI from latest patient reading
 *   2. Photo verification — bmi_verified_at gate with pass/fail badge
 *   3. NICE CG189 eligibility — ≥30 outright or ≥27.5 + comorbidity
 *
 * Eligibility is derived from the patient's current BMI and the NICE
 * checklist item "BMI ≥27.5 with comorbidity" when present.
 */

import { useState } from "react";
import { CheckCircle2, XCircle, Camera, ClipboardList, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, formatBMI, formatWeight } from "@/lib/format";
import { confirmBmiEvidence, rejectBmiEvidence } from "@/lib/api/mock";
import { useCurrentUser } from "@/lib/context";
import { can } from "@/lib/permissions";
import type { Patient, Order, ClinicId } from "@/types";

interface Props {
  patient: Patient;
  order: Pick<Order, "nice_checklist">;
  clinicId: ClinicId;
  // Task-247 — let the parent refresh its order/patient state once the
  // prescriber confirms or rejects BMI evidence, so the order header's
  // "Awaiting BMI evidence" / "Self-reported BMI out of range" flags
  // re-render (they auto-clear via normalizeSelfReportedBmiFlag once
  // verification.bmi_verified_at is set).
  onPatientUpdated?: (patient: Patient) => void;
}

// ── helpers ──────────────────────────────────────────────────────────────────

type EligibilityResult =
  | { status: "eligible";     label: string }
  | { status: "conditional";  label: string }
  | { status: "not_eligible"; label: string }
  | { status: "insufficient"; label: string };

function calcNiceEligibility(
  bmi: number,
  niceChecklist: Order["nice_checklist"],
): EligibilityResult {
  if (bmi >= 30) {
    return { status: "eligible", label: `BMI ${formatBMI(bmi)} ≥ 30 — eligible` };
  }
  if (bmi >= 27.5) {
    const comorbidityItem = niceChecklist?.find((item) =>
      item.label.toLowerCase().includes("comorbidity") ||
      item.label.toLowerCase().includes("27.5"),
    );
    if (comorbidityItem?.checked) {
      return {
        status: "eligible",
        label: `BMI ${formatBMI(bmi)} ≥ 27.5 + comorbidity confirmed`,
      };
    }
    return {
      status: "conditional",
      label: `BMI ${formatBMI(bmi)} ≥ 27.5 — comorbidity not yet confirmed`,
    };
  }
  if (bmi > 0) {
    return {
      status: "not_eligible",
      label: `BMI ${formatBMI(bmi)} < 27.5 — below NICE CG189 threshold`,
    };
  }
  return { status: "insufficient", label: "Insufficient data" };
}

// ── sub-components ───────────────────────────────────────────────────────────

function ColumnHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <Icon className="w-3.5 h-3.5 text-t3 shrink-0" />
      <p className="text-[10px] font-bold text-t3 uppercase tracking-wider">{title}</p>
    </div>
  );
}

function DataRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-[11px] text-t3 shrink-0">{label}</span>
      <span className={cn("text-[11px] font-semibold text-t1 text-right", mono && "font-mono")}>
        {value}
      </span>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "pass" | "fail" | "warn" | "unknown";
}) {
  const styles: Record<typeof status, string> = {
    pass:    "bg-ok-bg border border-ok-bdr text-ok",
    fail:    "bg-err-bg border border-err-bdr text-err",
    warn:    "bg-warn-bg border border-warn-bdr text-warn",
    unknown: "bg-surface-2 border border-border text-t3",
  };
  const labels: Record<typeof status, string> = {
    pass:    "Verified",
    fail:    "Not verified",
    warn:    "Conditional",
    unknown: "Pending",
  };
  const Icon =
    status === "pass"
      ? CheckCircle2
      : status === "fail"
      ? XCircle
      : AlertCircle;

  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", styles[status])}>
      <Icon className="w-3 h-3 shrink-0" />
      {labels[status]}
    </span>
  );
}

// ── main component ───────────────────────────────────────────────────────────

export function OrderBMIValidationCard({ patient, order, clinicId, onPatientUpdated }: Props) {
  const { latest, baseline, verification } = patient;
  const currentUser = useCurrentUser();
  const canReview = can(currentUser, "decide", "orders");
  const [pending, setPending] = useState<null | "confirm" | "reject">(null);
  const [error, setError] = useState<string | null>(null);

  const bmiVerified = !!verification.bmi_verified_at;
  const eligibility = calcNiceEligibility(latest.bmi, order.nice_checklist);

  async function handleReview(decision: "confirm" | "reject") {
    if (pending) return;
    setPending(decision);
    setError(null);
    try {
      const updated =
        decision === "confirm"
          ? await confirmBmiEvidence(clinicId, patient.id, currentUser)
          : await rejectBmiEvidence(clinicId, patient.id, currentUser);
      onPatientUpdated?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record BMI review.");
    } finally {
      setPending(null);
    }
  }

  const eligibilityStatus: "pass" | "fail" | "warn" | "unknown" =
    eligibility.status === "eligible"     ? "pass"    :
    eligibility.status === "conditional"  ? "warn"    :
    eligibility.status === "not_eligible" ? "fail"    : "unknown";

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5 text-brand" />
          <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider">
            BMI Validation · NICE CG189
          </h3>
        </div>
        <StatusBadge
          status={
            eligibilityStatus === "pass" && bmiVerified ? "pass" :
            eligibilityStatus === "fail"                ? "fail" :
            eligibilityStatus === "warn"                ? "warn" : "unknown"
          }
        />
      </div>

      {/* Three-up grid */}
      <div className="grid grid-cols-3 divide-x divide-border">

        {/* Column 1 — Self-reported */}
        <div className="px-4 py-3">
          <ColumnHeader icon={ClipboardList} title="Self-reported" />
          <DataRow label="Height"  value={`${baseline.height_cm} cm`} />
          <DataRow label="Weight"  value={formatWeight(latest.weight_kg)} />
          <DataRow label="BMI"     value={formatBMI(latest.bmi)} />
          <DataRow label="Baseline BMI" value={formatBMI(baseline.baseline_bmi)} />
          <p className="mt-2.5 text-[10px] text-t3 italic">
            Patient-submitted via questionnaire
          </p>
        </div>

        {/* Column 2 — Photo verification */}
        <div className="px-4 py-3">
          <ColumnHeader icon={Camera} title="Photo verification" />
          <div className="flex flex-col gap-2">
            <StatusBadge status={bmiVerified ? "pass" : "fail"} />
            {bmiVerified ? (
              <>
                <p className="text-[11px] text-t2 font-semibold">
                  Verified {formatDateTime(verification.bmi_verified_at!)}
                </p>
                <p className="text-[10px] text-t3">
                  Clinical photo evidence reviewed and accepted by a prescriber.
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] text-t2 font-semibold">No verification on record</p>
                <p className="text-[10px] text-t3">
                  Request a weight photo from the patient before approving.
                </p>
              </>
            )}

            {/* Task-247 — Prescriber review action */}
            {canReview && (
              <div className="mt-1 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleReview("confirm")}
                    disabled={pending !== null || bmiVerified}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-semibold bg-ok text-white hover:bg-ok/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title={bmiVerified ? "Already verified" : "Confirm BMI photo evidence"}
                  >
                    {pending === "confirm" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    {bmiVerified ? "Confirmed" : "Confirm evidence"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview("reject")}
                    disabled={pending !== null}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-semibold border border-err-bdr text-err bg-err-bg hover:bg-err hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title={
                      bmiVerified
                        ? "Reject and require a fresh upload"
                        : "Mark the current photo as unacceptable and request a new one"
                    }
                  >
                    {pending === "reject" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    Reject
                  </button>
                </div>
                {error && <p className="text-[10px] text-err">{error}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Column 3 — NICE CG189 eligibility */}
        <div className="px-4 py-3">
          <ColumnHeader icon={CheckCircle2} title="NICE CG189 gate" />
          <div className="flex flex-col gap-2">
            <StatusBadge status={eligibilityStatus} />
            <p className="text-[11px] text-t2 font-semibold">{eligibility.label}</p>
            {eligibility.status === "conditional" && (
              <p className="text-[10px] text-warn">
                Tick the comorbidity item on the checklist above to confirm eligibility.
              </p>
            )}
            {eligibility.status === "not_eligible" && (
              <p className="text-[10px] text-err">
                Patient does not meet NICE CG189 BMI criteria. Do not prescribe without clinical escalation.
              </p>
            )}
            {eligibility.status === "eligible" && (
              <p className="text-[10px] text-ok">
                BMI criteria satisfied per NICE CG189 §1.2.
              </p>
            )}
          </div>

          {/* Threshold reminder */}
          <div className="mt-3 pt-2.5 border-t border-border space-y-0.5">
            <p className="text-[9.5px] text-t3 font-semibold uppercase tracking-wide">
              Thresholds
            </p>
            <p className="text-[10px] text-t3">≥ 30.0 — eligible outright</p>
            <p className="text-[10px] text-t3">≥ 27.5 + comorbidity — eligible</p>
            <p className="text-[10px] text-t3">&lt; 27.5 — not eligible</p>
          </div>
        </div>
      </div>
    </div>
  );
}
