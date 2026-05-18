import { describe, expect, it } from "vitest";

import type { ClinicConfig, Order } from "@/lib/api/types";

import {
  DEFAULT_WEIGHT_WARNING_THRESHOLDS,
  analyseWeightHistory,
} from "../weightWarnings";

type Reading = NonNullable<Order["weight_history"]>[number];

function reading(daysAgo: number, weight_kg: number, bmi = 30): Reading {
  const t = new Date("2026-05-01T00:00:00.000Z").getTime();
  return {
    recorded_at: new Date(t - daysAgo * 86_400_000).toISOString(),
    weight_kg,
    bmi,
  };
}

const customThresholds: ClinicConfig["weight_warning_thresholds"] = {
  bmi_continuation_floor: 28,
  rapid_loss_kg_per_week: 1.5,
  plateau_tolerance_kg: 0.5,
  plateau_min_readings: 4,
};

describe("analyseWeightHistory", () => {
  it("flags weight regain when the latest reading is heavier", () => {
    const history = [reading(14, 100), reading(0, 101.2)];
    const warnings = analyseWeightHistory(history, {
      thresholds: customThresholds,
    });
    const regain = warnings.find((w) => w.kind === "weight_regain");
    expect(regain).toBeDefined();
    expect(regain?.severity).toBe("err");
    expect(regain?.label).toContain("1.2kg");
  });

  it("flags a plateau exactly at the configured tolerance (boundary)", () => {
    // 4 readings (custom min), spread = exactly 0.5kg (custom tolerance).
    const history = [
      reading(21, 100.0),
      reading(14, 100.5),
      reading(7, 100.0),
      reading(0, 100.3),
    ];
    const warnings = analyseWeightHistory(history, {
      thresholds: customThresholds,
    });
    expect(warnings.some((w) => w.kind === "plateau")).toBe(true);

    // One reading nudged just past tolerance → no plateau.
    const justOver = [
      reading(21, 100.0),
      reading(14, 100.6),
      reading(7, 100.0),
      reading(0, 100.3),
    ];
    const overWarnings = analyseWeightHistory(justOver, {
      thresholds: customThresholds,
    });
    expect(overWarnings.some((w) => w.kind === "plateau")).toBe(false);
  });

  it("flags rapid loss only when strictly above the configured kg/week", () => {
    // Exactly at threshold (1.5kg/week for custom) → no warning (uses `>`).
    const atThreshold = [reading(7, 100), reading(0, 98.5)];
    const atWarnings = analyseWeightHistory(atThreshold, {
      thresholds: customThresholds,
    });
    expect(atWarnings.some((w) => w.kind === "rapid_loss")).toBe(false);

    // Just above → fires.
    const overThreshold = [reading(7, 100), reading(0, 98.3)];
    const overWarnings = analyseWeightHistory(overThreshold, {
      thresholds: customThresholds,
    });
    const rapid = overWarnings.find((w) => w.kind === "rapid_loss");
    expect(rapid).toBeDefined();
    expect(rapid?.severity).toBe("err");
    expect(rapid?.label).toContain("7 days");
  });

  it("flags BMI below the continuation floor only on continuations", () => {
    const history = [reading(7, 80, 30), reading(0, 79.5, 27.9)];

    const noFlag = analyseWeightHistory(history, {
      thresholds: customThresholds,
      isContinuation: false,
    });
    expect(noFlag.some((w) => w.kind === "bmi_below_threshold")).toBe(false);

    const flagged = analyseWeightHistory(history, {
      thresholds: customThresholds,
      isContinuation: true,
    });
    const bmi = flagged.find((w) => w.kind === "bmi_below_threshold");
    expect(bmi).toBeDefined();
    expect(bmi?.severity).toBe("warn");
    expect(bmi?.label).toContain("27.9");

    // At the floor → not flagged.
    const atFloor = analyseWeightHistory(
      [reading(7, 80, 30), reading(0, 79.5, 28)],
      { thresholds: customThresholds, isContinuation: true },
    );
    expect(atFloor.some((w) => w.kind === "bmi_below_threshold")).toBe(false);
  });

  it("falls back to platform defaults when no thresholds are provided", () => {
    // Defaults: bmi_continuation_floor=27.5, rapid_loss_kg_per_week=2,
    // plateau_tolerance_kg=0.3, plateau_min_readings=3.
    // Build a history that would NOT trigger under customThresholds but DOES
    // under defaults — proving the defaults path is taken.
    //
    // 3 readings within 0.3kg → plateau under defaults (min=3, tol=0.3),
    // but customThresholds requires 4 readings so it would be silent there.
    const plateauHistory = [
      reading(14, 90.0),
      reading(7, 90.2),
      reading(0, 90.1),
    ];
    const defaults = analyseWeightHistory(plateauHistory);
    expect(defaults.some((w) => w.kind === "plateau")).toBe(true);

    const custom = analyseWeightHistory(plateauHistory, {
      thresholds: customThresholds,
    });
    expect(custom.some((w) => w.kind === "plateau")).toBe(false);

    // BMI default floor is 27.5 — a 27.4 reading on continuation should fire.
    const bmiHistory = [reading(7, 80, 30), reading(0, 79.5, 27.4)];
    const bmiDefault = analyseWeightHistory(bmiHistory, {
      isContinuation: true,
    });
    expect(bmiDefault.some((w) => w.kind === "bmi_below_threshold")).toBe(
      true,
    );

    // Sanity check: the exported defaults match what we asserted above.
    expect(DEFAULT_WEIGHT_WARNING_THRESHOLDS).toEqual({
      bmi_continuation_floor: 27.5,
      rapid_loss_kg_per_week: 2,
      plateau_tolerance_kg: 0.3,
      plateau_min_readings: 3,
    });
  });

  it("returns no warnings for fewer than two readings", () => {
    expect(analyseWeightHistory([])).toEqual([]);
    expect(analyseWeightHistory([reading(0, 90)])).toEqual([]);
    expect(analyseWeightHistory(null)).toEqual([]);
    expect(analyseWeightHistory(undefined)).toEqual([]);
  });
});
