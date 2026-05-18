/**
 * Task-163 — Self-reported BMI sanity check at intake.
 *
 * Patients self-report their height and weight at intake, which seeds the
 * baseline BMI shown to the prescriber. To protect prescribers from obviously
 * suspect numbers (the classic typo case is height entered in metres instead
 * of centimetres, or kg/lbs confusion), we raise a contextual flag at intake
 * when the computed BMI falls outside a generous safe band for a GLP-1
 * weight-loss order.
 *
 * The flag is informational: it surfaces on the dashboard / clinical check
 * queue and the order detail header alongside existing flags like
 * "Awaiting BMI evidence". It is cleared at read time once a prescriber
 * reviews the BMI photo evidence (i.e. when the patient record's
 * `verification.bmi_verified_at` becomes truthy) — see
 * `normalizeSelfReportedBmiFlag` in `lib/api/fixtures/orders.ts`, which uses
 * the `filterSelfReportedBmiFlag` helper below.
 */
export const SELF_REPORTED_BMI_FLAG = "Self-reported BMI out of range";

// Generous band — anything inside is acceptable at intake and only the usual
// NICE CG189 eligibility gates apply downstream. Anything outside is almost
// certainly a data-entry mistake (BMI 12 = a stick; BMI 65 = far above any
// realistic weight-loss-clinic patient).
export const SELF_REPORTED_BMI_LOWER = 18.5;
export const SELF_REPORTED_BMI_UPPER = 60;

/**
 * Returns the contextual flag label when the self-reported BMI looks
 * suspicious, or `null` when it is within the acceptable band. Non-finite or
 * non-positive values are treated as suspicious so the prescriber notices
 * the bad number rather than silently approving a zero-BMI order.
 */
export function evaluateSelfReportedBmi(bmi: number): string | null {
  if (!Number.isFinite(bmi) || bmi <= 0) return SELF_REPORTED_BMI_FLAG;
  if (bmi < SELF_REPORTED_BMI_LOWER) return SELF_REPORTED_BMI_FLAG;
  if (bmi > SELF_REPORTED_BMI_UPPER) return SELF_REPORTED_BMI_FLAG;
  return null;
}

// Task-247 — the intake "Awaiting BMI evidence" flag is the second BMI gate
// that auto-clears once a prescriber confirms the photo evidence. Kept here
// alongside SELF_REPORTED_BMI_FLAG so every read-side normaliser drops both
// in lockstep (otherwise the order header still shows "Awaiting BMI evidence"
// after a prescriber has signed it off).
export const AWAITING_BMI_EVIDENCE_FLAG = "Awaiting BMI evidence";

const BMI_EVIDENCE_FLAGS: readonly string[] = [
  SELF_REPORTED_BMI_FLAG,
  AWAITING_BMI_EVIDENCE_FLAG,
];

/**
 * Drop the BMI-evidence contextual flags from a contextual_flags array once
 * the patient's BMI evidence has been reviewed (i.e. `bmi_verified_at` is
 * set). Display sites pass `bmiVerifiedAt` from the linked patient record so
 * both "Self-reported BMI out of range" and "Awaiting BMI evidence"
 * automatically disappear from the queue and the order detail once a
 * prescriber has confirmed the photo evidence.
 */
export function filterSelfReportedBmiFlag(
  flags: readonly string[] | undefined,
  bmiVerifiedAt: string | null | undefined,
): string[] {
  const arr = flags ? [...flags] : [];
  if (!bmiVerifiedAt) return arr;
  return arr.filter((f) => !BMI_EVIDENCE_FLAGS.includes(f));
}
