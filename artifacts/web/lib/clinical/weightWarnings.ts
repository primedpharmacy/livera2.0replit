import type { ClinicConfig, Order } from "@/lib/api/types";

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

// Platform defaults — used when a clinic config has not been provided.
// Clinics override these via ClinicConfig.weight_warning_thresholds (Task-100).
export const DEFAULT_WEIGHT_WARNING_THRESHOLDS: ClinicConfig["weight_warning_thresholds"] = {
  bmi_continuation_floor: 27.5,
  rapid_loss_kg_per_week: 2,
  plateau_tolerance_kg: 0.3,
  plateau_min_readings: 3,
};

type Reading = NonNullable<Order["weight_history"]>[number];

export function analyseWeightHistory(
  history: Order["weight_history"] | undefined | null,
  opts?: {
    isContinuation?: boolean;
    thresholds?: ClinicConfig["weight_warning_thresholds"];
  },
): WeightWarning[] {
  const thresholds = opts?.thresholds ?? DEFAULT_WEIGHT_WARNING_THRESHOLDS;
  const {
    bmi_continuation_floor: BMI_CONTINUATION_THRESHOLD,
    rapid_loss_kg_per_week: RAPID_LOSS_KG_PER_WEEK,
    plateau_tolerance_kg: PLATEAU_TOLERANCE_KG,
    plateau_min_readings: PLATEAU_MIN_READINGS,
  } = thresholds;

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

  // 3. Rapid loss — >threshold kg/week between the last two readings.
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

// Task-143 — Human-readable summary of the active clinic thresholds, rendered
// next to the warning chips so prescribers can see *which* numbers triggered a
// warning without leaving the order. Returns null when no thresholds were
// supplied so callers don't accidentally surface platform defaults as if they
// were clinic-tuned values.
export function formatWeightWarningThresholdsSummary(
  thresholds: ClinicConfig["weight_warning_thresholds"] | undefined | null,
): string | null {
  if (!thresholds) return null;
  const {
    bmi_continuation_floor,
    rapid_loss_kg_per_week,
    plateau_tolerance_kg,
    plateau_min_readings,
  } = thresholds;
  return [
    `Plateau: ${plateau_min_readings} readings within ${plateau_tolerance_kg}kg`,
    `Rapid loss > ${rapid_loss_kg_per_week}kg/week`,
    `BMI floor ${bmi_continuation_floor}`,
  ].join(" · ");
}

// Task-143 — Per-warning tooltip explaining the exact threshold value the
// warning was measured against. Surfaced via `title` on each chip so hovering
// the chip reveals the trigger condition.
export function describeWeightWarningThreshold(
  kind: WeightWarningKind,
  thresholds: ClinicConfig["weight_warning_thresholds"] | undefined | null,
): string | null {
  if (!thresholds) return null;
  switch (kind) {
    case "plateau":
      return `Triggered when the last ${thresholds.plateau_min_readings} readings stay within ${thresholds.plateau_tolerance_kg}kg of each other.`;
    case "rapid_loss":
      return `Triggered when weight loss exceeds ${thresholds.rapid_loss_kg_per_week}kg/week between consecutive readings.`;
    case "bmi_below_threshold":
      return `Triggered on continuation orders when the latest BMI drops below ${thresholds.bmi_continuation_floor}.`;
    case "weight_regain":
      return "Triggered whenever the latest reading is heavier than the previous one.";
    default:
      return null;
  }
}

// Task-211 — clinics can retune their weight-warning thresholds at any time
// (via Settings → Weight warnings). Warnings older than the most recent edit
// may have been triggered against different numbers, so each acknowledgement
// captures the snapshot it fired under. These helpers let the chip surface
// both the historical and current threshold values when they diverge.

type Thresholds = ClinicConfig["weight_warning_thresholds"];

/** Returns the threshold keys relevant to a given warning kind. */
function thresholdKeysForKind(kind: WeightWarningKind): Array<keyof Thresholds> {
  switch (kind) {
    case "plateau":
      return ["plateau_min_readings", "plateau_tolerance_kg"];
    case "rapid_loss":
      return ["rapid_loss_kg_per_week"];
    case "bmi_below_threshold":
      return ["bmi_continuation_floor"];
    case "weight_regain":
      // Weight regain isn't threshold-driven, so changes never affect it.
      return [];
    default:
      return [];
  }
}

/**
 * Task-211 — Returns true when the clinic thresholds *that matter for this
 * warning kind* have changed between the historical snapshot and the current
 * values. Returns false when the snapshot is missing (we have no history to
 * compare against), or when the relevant numbers are identical.
 */
export function haveWeightWarningThresholdsChanged(
  kind: WeightWarningKind,
  historical: Thresholds | undefined | null,
  current: Thresholds | undefined | null,
): boolean {
  if (!historical || !current) return false;
  const keys = thresholdKeysForKind(kind);
  return keys.some((k) => historical[k] !== current[k]);
}

/**
 * Task-211 — Human-readable summary of the threshold values relevant to a
 * specific warning kind. Renders the per-kind subset (e.g. "plateau 3 within
 * 0.3kg") so the tooltip can show "Fired under: X — now Y" succinctly.
 */
export function summariseThresholdsForKind(
  kind: WeightWarningKind,
  thresholds: Thresholds | undefined | null,
): string | null {
  if (!thresholds) return null;
  switch (kind) {
    case "plateau":
      return `plateau ${thresholds.plateau_min_readings} within ${thresholds.plateau_tolerance_kg}kg`;
    case "rapid_loss":
      return `> ${thresholds.rapid_loss_kg_per_week}kg/week`;
    case "bmi_below_threshold":
      return `BMI floor ${thresholds.bmi_continuation_floor}`;
    case "weight_regain":
      return null;
    default:
      return null;
  }
}

/**
 * Task-211 — Tooltip text for an acknowledged chip that captures both the
 * current clinic threshold and the historical snapshot the warning fired
 * under (when they differ). Falls back to the regular per-warning description
 * when no snapshot exists or the values still match.
 */
export function describeAcknowledgedWeightWarningThreshold(
  kind: WeightWarningKind,
  historical: Thresholds | undefined | null,
  current: Thresholds | undefined | null,
): string | null {
  const baseline = describeWeightWarningThreshold(kind, current);
  if (!haveWeightWarningThresholdsChanged(kind, historical, current)) {
    return baseline;
  }
  const firedUnder = summariseThresholdsForKind(kind, historical);
  const now = summariseThresholdsForKind(kind, current);
  if (!firedUnder || !now) return baseline;
  return `Fired under: ${firedUnder} — now ${now}`;
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

// Task-135 — Acknowledgement entries are append-only, so a single warning kind
// may have multiple historical entries (e.g. acknowledged → undone → acknowledged
// again). The "current" acknowledgement is the most recent entry for that kind
// that has not been reversed; if every entry has been reversed, the chip falls
// back to its unreviewed state and exposes the Acknowledge action again.
export function findAcknowledgement(
  order: Pick<Order, "weight_warning_acknowledgements"> | undefined | null,
  kind: WeightWarningKind,
): WeightWarningAcknowledgement | undefined {
  const entries = order?.weight_warning_acknowledgements ?? [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.kind === kind && !e.reversed_at) return e;
  }
  return undefined;
}

// Task-136 — Aggregate per-order weight-warning state so the clinical check
// queue can show a "reviewed" indicator, filter out fully-acknowledged orders,
// and bump still-unacknowledged ones up the urgency sort.
export interface OrderWeightWarningState {
  total: number;
  unacknowledged: number;
  acknowledged: number;
  allAcknowledged: boolean;
  hasUnacknowledged: boolean;
}

export function summariseOrderWeightWarnings(
  order: Pick<
    Order,
    "type" | "weight_history" | "weight_warning_acknowledgements"
  >,
  thresholds?: ClinicConfig["weight_warning_thresholds"],
): OrderWeightWarningState {
  const warnings = analyseWeightHistory(order.weight_history, {
    isContinuation: order.type === "reorder",
    thresholds,
  });
  let acknowledged = 0;
  for (const w of warnings) {
    if (findAcknowledgement(order, w.kind)) acknowledged++;
  }
  const total = warnings.length;
  const unacknowledged = total - acknowledged;
  return {
    total,
    unacknowledged,
    acknowledged,
    allAcknowledged: total > 0 && unacknowledged === 0,
    hasUnacknowledged: unacknowledged > 0,
  };
}
