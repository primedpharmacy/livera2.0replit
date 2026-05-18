import type { Order } from "@/lib/api/types";

export type WeightWarningSeverity = "warn" | "err";

export type WeightWarningKind =
  | "weight_regain"
  | "plateau"
  | "rapid_loss"
  | "bmi_below_threshold";

export interface WeightWarning {
  kind: WeightWarningKind;
  severity: WeightWarningSeverity;
  label: string;
}

const BMI_CONTINUATION_THRESHOLD = 27.5;
const PLATEAU_TOLERANCE_KG = 0.3;
const PLATEAU_MIN_READINGS = 3;
const RAPID_LOSS_KG_PER_WEEK = 2;

type Reading = NonNullable<Order["weight_history"]>[number];

export function analyseWeightHistory(
  history: Order["weight_history"] | undefined | null,
  opts?: { isContinuation?: boolean },
): WeightWarning[] {
  const readings: Reading[] = [...(history ?? [])].sort((a, b) =>
    a.recorded_at.localeCompare(b.recorded_at),
  );
  if (readings.length < 2) return [];

  const warnings: WeightWarning[] = [];
  const last = readings[readings.length - 1];
  const prev = readings[readings.length - 2];

  // 1. Weight regain — last reading is heavier than the previous one.
  const deltaKg = +(last.weight_kg - prev.weight_kg).toFixed(1);
  if (deltaKg > 0) {
    warnings.push({
      kind: "weight_regain",
      severity: "err",
      label: `Weight regained ${deltaKg}kg over last 2 readings`,
    });
  }

  // 2. Plateau — no meaningful change across the last N readings.
  if (readings.length >= PLATEAU_MIN_READINGS) {
    const tail = readings.slice(-PLATEAU_MIN_READINGS);
    const tailMin = Math.min(...tail.map((r) => r.weight_kg));
    const tailMax = Math.max(...tail.map((r) => r.weight_kg));
    if (tailMax - tailMin <= PLATEAU_TOLERANCE_KG) {
      warnings.push({
        kind: "plateau",
        severity: "warn",
        label: `Plateau — no change in ${PLATEAU_MIN_READINGS} readings`,
      });
    }
  }

  // 3. Rapid loss — >2kg/week between the last two readings.
  const days =
    (new Date(last.recorded_at).getTime() -
      new Date(prev.recorded_at).getTime()) /
    86_400_000;
  if (days > 0 && deltaKg < 0) {
    const lostKg = Math.abs(deltaKg);
    const lostPerWeek = (lostKg / days) * 7;
    if (lostPerWeek > RAPID_LOSS_KG_PER_WEEK) {
      const windowDays = Math.max(1, Math.round(days));
      warnings.push({
        kind: "rapid_loss",
        severity: "err",
        label: `Rapid loss — ${lostKg.toFixed(1)}kg in ${windowDays} day${windowDays === 1 ? "" : "s"}`,
      });
    }
  }

  // 4. BMI below continuation threshold (only meaningful on a continuation/reorder).
  if (opts?.isContinuation && last.bmi != null && last.bmi < BMI_CONTINUATION_THRESHOLD) {
    warnings.push({
      kind: "bmi_below_threshold",
      severity: "warn",
      label: `BMI now ${last.bmi.toFixed(1)} — below continuation threshold`,
    });
  }

  return warnings;
}

export const WEIGHT_WARNING_CHIP_CLS: Record<WeightWarningSeverity, string> = {
  warn: "bg-warn-bg text-warn border-warn-bdr",
  err: "bg-err-bg text-err border-err-bdr",
};

// Task-99 — muted styling for warnings the clinician has already acknowledged.
// Both the colour cue and the AlertTriangle icon are dropped on subsequent
// visits so the chip reads as "reviewed", not "new".
export const WEIGHT_WARNING_ACK_CHIP_CLS =
  "bg-page-bg text-t3 border-bdr";

export type WeightWarningAcknowledgement = NonNullable<
  Order["weight_warning_acknowledgements"]
>[number];

export function findAcknowledgement(
  order: Pick<Order, "weight_warning_acknowledgements"> | undefined | null,
  kind: WeightWarningKind,
): WeightWarningAcknowledgement | undefined {
  return order?.weight_warning_acknowledgements?.find((a) => a.kind === kind);
}
