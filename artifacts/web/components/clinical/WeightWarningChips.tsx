"use client";

/**
 * Task-99 — Concerning weight-warning chips with an inline "Acknowledge" action.
 *
 * Used by both ClinicalCheckSlideOver and OrderWeightTrajectoryCard so the
 * presentation + interaction stays in sync. Each chip:
 *   - Shows the warning label with a severity-coloured pill.
 *   - Exposes an "Acknowledge" button that expands a small note form.
 *   - Switches to a muted "reviewed" state once acknowledged, surfacing who
 *     reviewed it, when, and the rationale they captured.
 *
 * Task-135 — An acknowledged chip also exposes "Edit rationale" and "Undo"
 * actions (gated by the same decide permission). Edits append to the entry's
 * history and undos stamp the entry as reversed; nothing is silently
 * overwritten, and every action shows up in the order activity timeline.
 */

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import {
  WEIGHT_WARNING_CHIP_CLS,
  WEIGHT_WARNING_ACK_CHIP_CLS,
  describeWeightWarningThreshold,
  describeAcknowledgedWeightWarningThreshold,
  haveWeightWarningThresholdsChanged,
  findAcknowledgement,
  type WeightWarning,
} from "@/lib/clinical/weightWarnings";
import type { ClinicConfig } from "@/types";
import {
  acknowledgeWeightWarning,
  editWeightWarningAcknowledgement,
  undoWeightWarningAcknowledgement,
  USERS_REGISTRY,
} from "@/lib/api/mock";
import { useCurrentUser } from "@/lib/context";
import type { Order, ClinicId } from "@/types";

interface Props {
  order: Order;
  clinicId: ClinicId;
  warnings: WeightWarning[];
  /** Compact size used inside the slide-over summary tab. */
  size?: "sm" | "md";
  /** Allow staff without decide permission to view chips but not acknowledge. */
  canAcknowledge?: boolean;
  /** Clinic-tuned thresholds (Task-143) — surfaced as a hover tooltip on each chip. */
  thresholds?: ClinicConfig["weight_warning_thresholds"];
  /** Notify parent that the order on the server changed (so it can refetch / patch state). */
  onAcknowledged?: (updated: Order) => void;
}

export function WeightWarningChips({
  order,
  clinicId,
  warnings,
  size = "md",
  canAcknowledge = true,
  thresholds,
  onAcknowledged,
}: Props) {
  if (warnings.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {warnings.map((w) => (
        <WeightWarningChip
          key={w.kind}
          order={order}
          clinicId={clinicId}
          warning={w}
          size={size}
          canAcknowledge={canAcknowledge}
          thresholds={thresholds}
          onAcknowledged={onAcknowledged}
        />
      ))}
    </div>
  );
}

type FormMode =
  | "none"
  // Task-189 — a clinician who didn't record the original ack must explicitly
  // confirm the override before the Edit/Undo affordances unlock.
  | "override_confirm"
  | "acknowledge"
  | "edit"
  | "undo";

function WeightWarningChip({
  order,
  clinicId,
  warning,
  size,
  canAcknowledge,
  thresholds,
  onAcknowledged,
}: {
  order: Order;
  clinicId: ClinicId;
  warning: WeightWarning;
  size: "sm" | "md";
  canAcknowledge: boolean;
  thresholds?: ClinicConfig["weight_warning_thresholds"];
  onAcknowledged?: (updated: Order) => void;
}) {
  const CURRENT_USER = useCurrentUser();
  const ack = findAcknowledgement(order, warning.kind);
  // Task-211 — when this chip has been acknowledged, build a tooltip that
  // contrasts the snapshot the warning fired under with the clinic's current
  // numbers (if they've since changed). Unacknowledged chips just describe
  // the live threshold as before (Task-143).
  const thresholdTooltip = ack
    ? describeAcknowledgedWeightWarningThreshold(
        warning.kind,
        ack.thresholds_snapshot,
        thresholds,
      )
    : describeWeightWarningThreshold(warning.kind, thresholds);
  const thresholdsChanged =
    !!ack &&
    haveWeightWarningThresholdsChanged(
      warning.kind,
      ack.thresholds_snapshot,
      thresholds,
    );
  const [mode, setMode] = useState<FormMode>("none");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textCls = size === "sm" ? "text-[10.5px]" : "text-[11px]";
  const padCls = size === "sm" ? "px-2 py-0.5" : "px-2 py-0.5";

  const reset = () => {
    setMode("none");
    setText("");
    setError(null);
  };

  if (ack) {
    const who = USERS_REGISTRY[ack.acknowledged_by_user_id]?.full_name
      ?? ack.acknowledged_by_user_id;
    // Task-189 — only the clinician who recorded the acknowledgement gets the
    // Edit/Undo buttons by default. Everyone else with `decide` permission has
    // to step through an "override teammate's acknowledgement" confirmation,
    // and the resulting API call carries `override: true` so the audit
    // timeline can capture that the chip was flipped by a different reviewer.
    const isOwnAck = ack.acknowledged_by_user_id === CURRENT_USER.id;
    const isOverride = !isOwnAck;
    return (
      <div className="inline-flex flex-wrap items-start gap-1.5">
        <span
          title={thresholdTooltip ?? undefined}
          className={cn(
            "inline-flex items-center gap-1 font-semibold border rounded-full",
            WEIGHT_WARNING_ACK_CHIP_CLS,
            textCls,
            padCls,
          )}
        >
          <CheckCircle2 className="w-3 h-3" />
          <span className="line-through decoration-t3/60">{warning.label}</span>
          <span className="ml-1 normal-case text-t3 font-medium">
            · acknowledged
          </span>
        </span>
        <span className="text-[10.5px] text-t3 leading-tight pt-0.5">
          {who} · {formatRelativeTime(ack.acknowledged_at)} — “{ack.rationale}”
          {ack.edits?.length ? (
            <span className="ml-1 italic">(edited)</span>
          ) : null}
        </span>
        {/* Task-211 — flag the chip when the clinic has retuned the relevant
            thresholds since this warning fired. The full "Fired under: X — now
            Y" comparison is in the chip's hover tooltip; this badge just makes
            the divergence discoverable at a glance. */}
        {thresholdsChanged && (
          <span
            title={thresholdTooltip ?? undefined}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full border border-warn-bdr bg-warn-bg text-warn"
          >
            <AlertTriangle className="w-3 h-3" />
            Thresholds changed since this warning
          </span>
        )}
        {canAcknowledge && mode === "none" && isOwnAck && (
          <div className="inline-flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                setMode("edit");
                setText(ack.rationale);
                setError(null);
              }}
              className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-brand hover:underline"
            >
              <Pencil className="w-3 h-3" /> Edit rationale
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("undo");
                setText("");
                setError(null);
              }}
              className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-t2 hover:underline"
            >
              <Undo2 className="w-3 h-3" /> Undo
            </button>
          </div>
        )}
        {canAcknowledge && mode === "none" && !isOwnAck && (
          <button
            type="button"
            onClick={() => {
              setMode("override_confirm");
              setText("");
              setError(null);
            }}
            className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-warn hover:underline pt-0.5"
          >
            <AlertTriangle className="w-3 h-3" /> Override teammate&rsquo;s acknowledgement
          </button>
        )}
        {mode === "override_confirm" && (
          <div className="w-full mt-1 rounded-md border border-warn-bdr bg-warn-bg p-2">
            <p className="text-[11px] font-semibold text-t1 mb-1">
              This acknowledgement was recorded by {who}.
            </p>
            <p className="text-[10.5px] text-t2 leading-snug">
              Overriding will flip the chip back to unreviewed for the whole
              team (or replace their rationale) and the audit timeline will
              show that you overrode {who}. Continue?
            </p>
            <div className="mt-1.5 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-t2 px-2 py-1 rounded hover:bg-page-bg"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("edit");
                  setText(ack.rationale);
                  setError(null);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand border border-brand/40 px-2 py-1 rounded hover:bg-brand/5"
              >
                <Pencil className="w-3 h-3" /> Override &amp; edit rationale
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("undo");
                  setText("");
                  setError(null);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-warn hover:bg-warn/90 px-2.5 py-1 rounded"
              >
                <Undo2 className="w-3 h-3" /> Override &amp; undo
              </button>
            </div>
          </div>
        )}
        {(mode === "edit" || mode === "undo") && (
          <InlineForm
            label={
              mode === "edit"
                ? isOverride
                  ? `Override ${who}'s rationale — capture why you're changing it`
                  : "Update the rationale for this acknowledgement"
                : isOverride
                  ? `Override ${who}'s acknowledgement — why are you undoing it?`
                  : "Why are you undoing this acknowledgement?"
            }
            placeholder={
              mode === "edit"
                ? "Updated rationale…"
                : "e.g. Acknowledged the wrong chip — meant to review the plateau warning."
            }
            value={text}
            onChange={setText}
            submitting={submitting}
            error={error}
            onCancel={reset}
            submitLabel={
              mode === "edit"
                ? isOverride ? "Save override" : "Save changes"
                : isOverride ? "Override & undo" : "Undo acknowledgement"
            }
            submitIcon={mode === "edit" ? "save" : "undo"}
            onSubmit={async () => {
              setSubmitting(true);
              setError(null);
              try {
                const overrideOpts = isOverride ? { override: true } : undefined;
                const updated =
                  mode === "edit"
                    ? await editWeightWarningAcknowledgement(
                        clinicId,
                        order.id,
                        warning.kind,
                        text,
                        overrideOpts,
                      )
                    : await undoWeightWarningAcknowledgement(
                        clinicId,
                        order.id,
                        warning.kind,
                        text,
                        overrideOpts,
                      );
                reset();
                onAcknowledged?.(updated);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not save change");
              } finally {
                setSubmitting(false);
              }
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex flex-wrap items-start gap-1.5">
      <span
        title={thresholdTooltip ?? undefined}
        className={cn(
          "inline-flex items-center gap-1 font-semibold border rounded-full",
          WEIGHT_WARNING_CHIP_CLS[warning.severity],
          textCls,
          padCls,
        )}
      >
        <AlertTriangle className="w-3 h-3" />
        {warning.label}
      </span>
      {canAcknowledge && mode === "none" && (
        <button
          type="button"
          onClick={() => {
            setMode("acknowledge");
            setText("");
            setError(null);
          }}
          className="text-[10.5px] font-semibold text-brand hover:underline pt-0.5"
        >
          Acknowledge
        </button>
      )}
      {mode === "acknowledge" && (
        <InlineForm
          label="Why is it safe to proceed despite this warning?"
          placeholder="e.g. Patient on holiday last fortnight — weight stable on review."
          value={text}
          onChange={setText}
          submitting={submitting}
          error={error}
          onCancel={reset}
          submitLabel="Save acknowledgement"
          submitIcon="save"
          onSubmit={async () => {
            setSubmitting(true);
            setError(null);
            try {
              const updated = await acknowledgeWeightWarning(
                clinicId,
                order.id,
                warning.kind,
                text,
                // Task-211 — capture the live clinic thresholds so audits can
                // later reconstruct exactly which numbers this chip fired under.
                thresholds,
              );
              reset();
              onAcknowledged?.(updated);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save acknowledgement");
            } finally {
              setSubmitting(false);
            }
          }}
        />
      )}
    </div>
  );
}

function InlineForm({
  label,
  placeholder,
  value,
  onChange,
  submitting,
  error,
  onCancel,
  onSubmit,
  submitLabel,
  submitIcon,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: () => void | Promise<void>;
  submitLabel: string;
  submitIcon: "save" | "undo";
}) {
  return (
    <div className="w-full mt-1 rounded-md border border-bdr bg-surface p-2">
      <label className="block text-[10.5px] font-semibold text-t2 mb-1">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        disabled={submitting}
        placeholder={placeholder}
        className="w-full text-[12px] rounded border border-bdr bg-page-bg px-2 py-1.5 text-t1 focus:outline-none focus:ring-1 focus:ring-brand resize-y"
      />
      {error && (
        <p className="mt-1 text-[10.5px] text-err font-medium">{error}</p>
      )}
      <div className="mt-1.5 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-t2 px-2 py-1 rounded hover:bg-page-bg disabled:opacity-50"
        >
          <X className="w-3 h-3" /> Cancel
        </button>
        <button
          type="button"
          disabled={submitting || value.trim().length < 3}
          onClick={() => void onSubmit()}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-brand hover:bg-brand/90 px-2.5 py-1 rounded disabled:opacity-50"
        >
          {submitIcon === "save" ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <Undo2 className="w-3 h-3" />
          )}
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
