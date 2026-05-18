"use client";

/**
 * Task-244 — Patient-facing self-report form.
 *
 * Sibling of LogWeightForm (staff). Same kg / st+lb input, same client-side
 * 30–300 kg range mirror, same `recordPatientWeight` call — only difference
 * is the `source: 'patient'` flag, which makes the fixture:
 *   - skip the staff write:patients gate (the magic link is the auth boundary)
 *   - audit-log actor_id = patient_id, source = 'patient'
 *   - leave coach_acknowledged_at = null so the coach badge surfaces it.
 *
 * After a successful submission we render a thank-you panel rather than
 * reopening the form — patients shouldn't be able to spam multiple rows from
 * one session by accident. Re-visiting the link is always allowed.
 */

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  recordPatientWeight,
  WEIGHT_MIN_KG,
  WEIGHT_MAX_KG,
} from "@/lib/api/mock";
import type { ClinicId } from "@/lib/api/types";

type Unit = "kg" | "st_lb";

interface Props {
  clinicId: ClinicId;
  patientId: string;
  heightCm: number;
}

const KG_PER_LB = 0.45359237;
const LB_PER_ST = 14;

function stLbToKg(st: number, lb: number): number {
  return (st * LB_PER_ST + lb) * KG_PER_LB;
}

export function PatientSelfWeightForm({ clinicId, patientId, heightCm }: Props) {
  const [unit, setUnit] = useState<Unit>("kg");
  const [kgInput, setKgInput] = useState("");
  const [stInput, setStInput] = useState("");
  const [lbInput, setLbInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState<{ kg: number; bmi: number | null } | null>(null);

  function resolveWeightKg(): number | null {
    if (unit === "kg") {
      const v = parseFloat(kgInput);
      if (!Number.isFinite(v)) return null;
      return v;
    }
    const st = stInput.trim() === "" ? 0 : parseFloat(stInput);
    const lb = lbInput.trim() === "" ? 0 : parseFloat(lbInput);
    if (!Number.isFinite(st) || !Number.isFinite(lb)) return null;
    if (st === 0 && lb === 0 && stInput.trim() === "" && lbInput.trim() === "") {
      return null;
    }
    if (lb < 0 || lb >= LB_PER_ST) return null;
    if (st < 0) return null;
    return stLbToKg(st, lb);
  }

  const previewKg = resolveWeightKg();
  const previewBmi =
    previewKg !== null && heightCm > 0
      ? Math.round((previewKg / ((heightCm / 100) * (heightCm / 100))) * 10) / 10
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const weightKg = resolveWeightKg();
    if (weightKg === null) {
      setError(
        unit === "kg"
          ? "Please enter your weight in kilograms."
          : "Please enter stones and pounds (0 ≤ lb < 14).",
      );
      return;
    }
    const rounded = Math.round(weightKg * 10) / 10;
    if (rounded < WEIGHT_MIN_KG || rounded > WEIGHT_MAX_KG) {
      setError(`Weight must be between ${WEIGHT_MIN_KG} and ${WEIGHT_MAX_KG} kg.`);
      return;
    }
    setSaving(true);
    try {
      await recordPatientWeight(clinicId, patientId, rounded, undefined, {
        source: "patient",
      });
      setSubmitted({ kg: rounded, bmi: previewBmi });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record weight");
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <section className="rounded-xl border border-bdr bg-surface p-6 shadow-sm text-center">
        <CheckCircle2 className="w-12 h-12 text-ok mx-auto" aria-hidden />
        <h2 className="mt-3 text-[15px] font-semibold text-t1">Thanks — we&apos;ve got it.</h2>
        <p className="mt-1 text-[13px] text-t2">
          Today&apos;s reading: <span className="font-medium text-t1">{submitted.kg.toFixed(1)} kg</span>
          {submitted.bmi !== null && (
            <>
              {" · "}BMI <span className="font-medium text-t1">{submitted.bmi.toFixed(1)}</span>
            </>
          )}
        </p>
        <p className="mt-3 text-[12px] text-t3">
          Your coach will see this on your profile and follow up if anything needs a closer look.
        </p>
      </section>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-bdr bg-surface p-5 shadow-sm space-y-4"
    >
      <div className="flex gap-2 text-[12px]">
        <button
          type="button"
          onClick={() => setUnit("kg")}
          disabled={saving}
          className={`flex-1 px-3 py-2 rounded border transition-colors ${
            unit === "kg"
              ? "bg-brand text-white border-brand"
              : "bg-surface text-t2 border-bdr hover:text-t1"
          }`}
        >
          Kilograms
        </button>
        <button
          type="button"
          onClick={() => setUnit("st_lb")}
          disabled={saving}
          className={`flex-1 px-3 py-2 rounded border transition-colors ${
            unit === "st_lb"
              ? "bg-brand text-white border-brand"
              : "bg-surface text-t2 border-bdr hover:text-t1"
          }`}
        >
          Stones / lbs
        </button>
      </div>

      {unit === "kg" ? (
        <label className="block">
          <span className="block text-[12px] font-medium text-t2 mb-1">Weight (kg)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={WEIGHT_MIN_KG}
              max={WEIGHT_MAX_KG}
              value={kgInput}
              onChange={(e) => setKgInput(e.target.value)}
              disabled={saving}
              placeholder="e.g. 82.4"
              autoFocus
              className="flex-1 text-[14px] px-3 py-2 border border-bdr rounded bg-white text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <span className="text-[13px] text-t2">kg</span>
          </div>
        </label>
      ) : (
        <div>
          <span className="block text-[12px] font-medium text-t2 mb-1">Weight (stones &amp; pounds)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              step="1"
              min={0}
              value={stInput}
              onChange={(e) => setStInput(e.target.value)}
              disabled={saving}
              placeholder="st"
              autoFocus
              aria-label="Stones"
              className="w-20 text-[14px] px-3 py-2 border border-bdr rounded bg-white text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <span className="text-[13px] text-t2">st</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0}
              max={13.9}
              value={lbInput}
              onChange={(e) => setLbInput(e.target.value)}
              disabled={saving}
              placeholder="lb"
              aria-label="Pounds"
              className="w-20 text-[14px] px-3 py-2 border border-bdr rounded bg-white text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <span className="text-[13px] text-t2">lb</span>
          </div>
        </div>
      )}

      {previewKg !== null && previewBmi !== null && (
        <p className="text-[12px] text-t2">
          ≈{" "}
          <span className="font-medium text-t1">
            {(Math.round(previewKg * 10) / 10).toFixed(1)} kg
          </span>{" "}
          · BMI <span className="font-medium text-t1">{previewBmi.toFixed(1)}</span>
        </p>
      )}

      {error && (
        <p role="alert" className="text-[12px] text-err">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center gap-2 w-full rounded-md bg-brand px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saving ? "Saving…" : "Submit check-in"}
      </button>
    </form>
  );
}
