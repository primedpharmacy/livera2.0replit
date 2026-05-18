"use client";

/**
 * WeightTrendChart — Task-243.
 *
 * Mini line chart shown on the patient profile Overview tab plotting the
 * intake baseline plus every recorded weight check-in
 * (PATIENT_WEIGHT_CHECKINS, written by recordPatientWeight in task-162).
 *
 * Read-only — purely a visualisation of the existing projection. Hovering a
 * point reveals date, weight in kg + st/lb, BMI, and delta vs baseline so
 * clinicians don't have to mentally diff two numbers.
 *
 * Empty state (only the baseline exists, no check-ins yet) renders a small
 * prompt instead of a single-dot chart, mirroring the WeightDeltaRow
 * convention of hiding noise on freshly-onboarded profiles.
 */

import { useMemo, useState } from "react";
import { TrendingDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { PatientWeightCheckIn } from "@/lib/api/mock";

interface Props {
  baseline: {
    weight_kg: number;
    bmi: number;
    recorded_at: string;
  };
  checkIns: PatientWeightCheckIn[];
}

type Point = {
  key: string;
  recorded_at: string;
  weight_kg: number;
  bmi: number;
  delta_vs_baseline_kg: number;
  isBaseline: boolean;
};

const KG_PER_LB = 0.45359237;
const LB_PER_ST = 14;

function kgToStLb(kg: number): string {
  const totalLb = kg / KG_PER_LB;
  const st = Math.floor(totalLb / LB_PER_ST);
  const lb = totalLb - st * LB_PER_ST;
  return `${st} st ${lb.toFixed(1)} lb`;
}

export function WeightTrendChart({ baseline, checkIns }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const points = useMemo<Point[]>(() => {
    const baselinePoint: Point = {
      key: "baseline",
      recorded_at: baseline.recorded_at,
      weight_kg: baseline.weight_kg,
      bmi: baseline.bmi,
      delta_vs_baseline_kg: 0,
      isBaseline: true,
    };
    const checkPoints: Point[] = checkIns
      .slice()
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
      .map((c) => ({
        key: c.id,
        recorded_at: c.recorded_at,
        weight_kg: c.weight_kg,
        bmi: c.bmi,
        delta_vs_baseline_kg: c.delta_vs_baseline_kg,
        isBaseline: false,
      }));
    return [baselinePoint, ...checkPoints];
  }, [baseline, checkIns]);

  // Empty state — only the baseline exists, no check-ins recorded yet.
  if (checkIns.length === 0) {
    return (
      <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
          <TrendingDown className="w-3.5 h-3.5 text-brand" />
          <span className="text-[11px] font-bold text-t2 uppercase tracking-wider">
            Weight trend
          </span>
        </div>
        <div className="px-4 py-6 text-center">
          <p className="text-[12px] text-t2">
            Only the intake baseline is recorded ({baseline.weight_kg.toFixed(1)} kg).
          </p>
          <p className="text-[11px] text-t3 mt-1">
            Log a new weight check-in to start tracking the trend over time.
          </p>
        </div>
      </div>
    );
  }

  // Geometry — render in a fixed virtual viewBox; preserveAspectRatio="none"
  // lets the chart stretch to fill its container width while keeping the
  // y-axis maths simple.
  const VB_W = 600;
  const VB_H = 180;
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_T = 14;
  const PAD_B = 22;

  const weights = points.map((p) => p.weight_kg);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  // Add a small visual margin around the range so the line isn't glued to
  // the top/bottom edge when readings vary; clamp to >=1 kg span so a flat
  // series still renders sensibly.
  const span = Math.max(maxW - minW, 1);
  const yMin = minW - span * 0.15;
  const yMax = maxW + span * 0.15;
  const ySpan = yMax - yMin;

  const firstTime = parseISO(points[0].recorded_at).getTime();
  const lastTime = parseISO(points[points.length - 1].recorded_at).getTime();
  const timeSpan = Math.max(lastTime - firstTime, 1);

  const xy = points.map((p) => {
    const t = parseISO(p.recorded_at).getTime();
    const x =
      points.length === 1
        ? (PAD_L + VB_W - PAD_R) / 2
        : PAD_L + ((t - firstTime) / timeSpan) * (VB_W - PAD_L - PAD_R);
    const y = PAD_T + ((yMax - p.weight_kg) / ySpan) * (VB_H - PAD_T - PAD_B);
    return { x, y };
  });

  const polyline = xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const baselineY =
    PAD_T + ((yMax - baseline.weight_kg) / ySpan) * (VB_H - PAD_T - PAD_B);

  const startLabel = format(parseISO(points[0].recorded_at), "d MMM yyyy");
  const endLabel = format(
    parseISO(points[points.length - 1].recorded_at),
    "d MMM yyyy",
  );

  const hover = hoverIdx !== null ? points[hoverIdx] : null;
  const hoverXY = hoverIdx !== null ? xy[hoverIdx] : null;

  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-bdr bg-page-bg">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-3.5 h-3.5 text-brand" />
          <span className="text-[11px] font-bold text-t2 uppercase tracking-wider">
            Weight trend · {points.length} reading{points.length === 1 ? "" : "s"}
          </span>
        </div>
        <span className="text-[11px] text-t3">
          {baseline.weight_kg.toFixed(1)} kg →{" "}
          {points[points.length - 1].weight_kg.toFixed(1)} kg
        </span>
      </div>

      <div className="p-4">
        <div className="relative">
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            className="w-full h-[180px] block"
            role="img"
            aria-label="Patient weight over time"
          >
            {/* Baseline reference line */}
            <line
              x1={PAD_L}
              x2={VB_W - PAD_R}
              y1={baselineY}
              y2={baselineY}
              stroke="currentColor"
              className="text-bdr"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            {/* Trend line */}
            {points.length > 1 && (
              <polyline
                points={polyline}
                fill="none"
                stroke="#4f46e5"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {/* Data points + invisible hit targets */}
            {xy.map((p, i) => {
              const isHover = hoverIdx === i;
              return (
                <g key={points[i].key}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHover ? 5 : 3.5}
                    fill={points[i].isBaseline ? "#94a3b8" : "#4f46e5"}
                    stroke="#fff"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={14}
                    fill="transparent"
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    onFocus={() => setHoverIdx(i)}
                    onBlur={() => setHoverIdx(null)}
                    tabIndex={0}
                    style={{ cursor: "pointer", outline: "none" }}
                    aria-label={`${format(parseISO(points[i].recorded_at), "d MMM yyyy")}: ${points[i].weight_kg.toFixed(1)} kg`}
                  />
                </g>
              );
            })}
          </svg>

          {/* Hover tooltip — positioned over the chart in percentage terms
              so it follows the dot when the SVG stretches. */}
          {hover && hoverXY && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
              style={{
                left: `${(hoverXY.x / VB_W) * 100}%`,
                top: `calc(${(hoverXY.y / VB_H) * 100}% - 8px)`,
              }}
            >
              <div className="bg-t1 text-white rounded-md shadow-md px-2.5 py-1.5 text-[11px] whitespace-nowrap">
                <p className="font-semibold">
                  {format(parseISO(hover.recorded_at), "d MMM yyyy")}
                  {hover.isBaseline && (
                    <span className="ml-1.5 text-[9px] uppercase tracking-wider opacity-70">
                      baseline
                    </span>
                  )}
                </p>
                <p className="opacity-90">
                  {hover.weight_kg.toFixed(1)} kg · {kgToStLb(hover.weight_kg)}
                </p>
                <p className="opacity-90">BMI {hover.bmi.toFixed(1)}</p>
                <p
                  className={
                    hover.isBaseline || hover.delta_vs_baseline_kg === 0
                      ? "opacity-70"
                      : hover.delta_vs_baseline_kg < 0
                        ? "text-emerald-300"
                        : "text-rose-300"
                  }
                >
                  {hover.isBaseline || hover.delta_vs_baseline_kg === 0
                    ? "No change vs baseline"
                    : `${hover.delta_vs_baseline_kg < 0 ? "−" : "+"}${Math.abs(hover.delta_vs_baseline_kg).toFixed(1)} kg vs baseline`}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-2 text-[10px] text-t3">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      </div>
    </div>
  );
}
