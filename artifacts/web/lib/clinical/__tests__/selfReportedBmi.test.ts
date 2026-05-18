import { describe, expect, it } from "vitest";
import {
  SELF_REPORTED_BMI_FLAG,
  evaluateSelfReportedBmi,
  filterSelfReportedBmiFlag,
} from "@/lib/clinical/selfReportedBmi";

describe("evaluateSelfReportedBmi", () => {
  it("returns null when BMI sits inside the safe band", () => {
    expect(evaluateSelfReportedBmi(18.5)).toBeNull();
    expect(evaluateSelfReportedBmi(27.5)).toBeNull();
    expect(evaluateSelfReportedBmi(35)).toBeNull();
    expect(evaluateSelfReportedBmi(60)).toBeNull();
  });

  it("flags suspiciously low values", () => {
    expect(evaluateSelfReportedBmi(18.4)).toBe(SELF_REPORTED_BMI_FLAG);
    expect(evaluateSelfReportedBmi(12)).toBe(SELF_REPORTED_BMI_FLAG);
  });

  it("flags suspiciously high values", () => {
    expect(evaluateSelfReportedBmi(60.1)).toBe(SELF_REPORTED_BMI_FLAG);
    expect(evaluateSelfReportedBmi(120)).toBe(SELF_REPORTED_BMI_FLAG);
  });

  it("treats non-finite and non-positive values as suspicious", () => {
    expect(evaluateSelfReportedBmi(0)).toBe(SELF_REPORTED_BMI_FLAG);
    expect(evaluateSelfReportedBmi(-5)).toBe(SELF_REPORTED_BMI_FLAG);
    expect(evaluateSelfReportedBmi(Number.NaN)).toBe(SELF_REPORTED_BMI_FLAG);
    expect(evaluateSelfReportedBmi(Number.POSITIVE_INFINITY)).toBe(
      SELF_REPORTED_BMI_FLAG,
    );
  });
});

describe("filterSelfReportedBmiFlag", () => {
  const flags = [
    "New intake",
    "Awaiting BMI evidence",
    SELF_REPORTED_BMI_FLAG,
  ];

  it("keeps the flag while BMI evidence is unverified", () => {
    expect(filterSelfReportedBmiFlag(flags, null)).toEqual(flags);
    expect(filterSelfReportedBmiFlag(flags, undefined)).toEqual(flags);
    expect(filterSelfReportedBmiFlag(flags, "")).toEqual(flags);
  });

  it("drops both BMI evidence flags once evidence is verified (Task-247)", () => {
    expect(
      filterSelfReportedBmiFlag(flags, "2026-05-18T10:00:00Z"),
    ).toEqual(["New intake"]);
  });

  it("tolerates missing input arrays", () => {
    expect(filterSelfReportedBmiFlag(undefined, null)).toEqual([]);
    expect(filterSelfReportedBmiFlag(undefined, "2026-05-18T10:00:00Z")).toEqual(
      [],
    );
  });
});
