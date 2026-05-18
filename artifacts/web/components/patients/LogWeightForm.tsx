"use client";

/**
 * LogWeightForm — Task-162.
 *
 * Inline "Log new weight" trigger that opens a small modal-style panel inside
 * the patient profile Measurements section. Lets staff record a fresh weight
 * check-in so patient.latest moves past day-one intake and trend deltas
 * against the baseline actually update over time.
 *
 * Accepts input in kilograms or stones+pounds — both are normalised to kg
 * before submission so the fixture only sees one canonical unit. Client-side
 * range check mirrors the server-side bounds (30–300 kg) defined alongside
 * recordPatientWeight; the server still re-validates.
 *
 * Layer 1 (UI gate): `canEdit` derived from can(actor, 'write','patients');
 *   when false we render nothing (the static Measurements rows already show
 *   the latest reading for read-only viewers).
 * Layer 2 (server gate): enforced in recordPatientWeight fixture.
 * Layer 3 (audit log): [AUDIT] entry written by the fixture.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
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
  canEdit: boolean;
}

const KG_PER_LB = 0.45359237;
const LB_PER_ST = 14;

function stLbToKg(st: number, lb: number): number {
  return (st * LB_PER_ST + lb) * KG_PER_LB;
}

export function LogWeightForm({ clinicId, patientId, heightCm, canEdit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<Unit>("kg");
  const [kgInput, setKgInput] = useState("");
  const [stInput, setStInput] = useState("");
  const [lbInput, setLbInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  if (!canEdit) return null;

  function reset() {
    setKgInput("");
    setStInput("");
    setLbInput("");
    setError(null);
    setUnit("kg");
  }

  function close() {
    reset();
    setOpen(false);
  }

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
      ? Math.round(
          (previewKg / ((heightCm / 100) * (heightCm / 100))) * 10,
        ) / 10
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const weightKg = resolveWeightKg();
    if (weightKg === null) {
      setError(
        unit === "kg"
          ? "Enter a weight in kilograms."
          : "Enter stones and pounds (0 ≤ lb < 14).",
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
      await recordPatientWeight(clinicId, patientId, rounded);
      close();
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record weight");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-brand bg-brand-bg border border-brand-bdr rounded hover:bg-brand hover:text-white transition-colors"
      >
        <Plus className="w-3 h-3" /> Log new weight
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-2 p-2.5 bg-page-bg border border-bdr rounded space-y-2"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-t1">New weight check-in</p>
        <button
          type="button"
          onClick={close}
          disabled={saving}
          className="text-t3 hover:text-t1 p-0.5 rounded disabled:opacity-40"
          aria-label="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex gap-1 text-[11px]">
        <button
          type="button"
          onClick={() => setUnit("kg")}
          disabled={saving}
          className={`flex-1 px-2 py-1 rounded border transition-colors ${
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
          className={`flex-1 px-2 py-1 rounded border transition-colors ${
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
          <span className="sr-only">Weight in kilograms</span>
          <div className="flex items-center gap-1.5">
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
              className="flex-1 text-[12px] px-2 py-1 border border-bdr rounded bg-surface text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <span className="text-[11px] text-t2">kg</span>
          </div>
        </label>
      ) : (
        <div className="flex items-center gap-1.5">
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
            className="w-16 text-[12px] px-2 py-1 border border-bdr rounded bg-surface text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
          <span className="text-[11px] text-t2">st</span>
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
            className="w-16 text-[12px] px-2 py-1 border border-bdr rounded bg-surface text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
          <span className="text-[11px] text-t2">lb</span>
        </div>
      )}

      {previewKg !== null && previewBmi !== null && (
        <p className="text-[11px] text-t2">
          ≈{" "}
          <span className="font-medium text-t1">
            {(Math.round(previewKg * 10) / 10).toFixed(1)} kg
          </span>{" "}
          · BMI <span className="font-medium text-t1">{previewBmi.toFixed(1)}</span>
        </p>
      )}

      {error && <p className="text-[11px] text-err">{error}</p>}

      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 px-2 py-1 text-[11px] font-medium text-white bg-brand rounded hover:bg-brand-dark disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save check-in"}
        </button>
        <button
          type="button"
          onClick={close}
          disabled={saving}
          className="px-2 py-1 text-[11px] font-medium text-t2 bg-surface border border-bdr rounded hover:text-t1 disabled:opacity-40 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
