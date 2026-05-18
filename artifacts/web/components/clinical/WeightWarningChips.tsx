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
  findAcknowledgement,
  type WeightWarning,
} from "@/lib/clinical/weightWarnings";
import {
  acknowledgeWeightWarning,
  editWeightWarningAcknowledgement,
  undoWeightWarningAcknowledgement,
  USERS_REGISTRY,
} from "@/lib/api/mock";
import type { Order, ClinicId } from "@/types";

interface Props {
  order: Order;
  clinicId: ClinicId;
  warnings: WeightWarning[];
  /** Compact size used inside the slide-over summary tab. */
  size?: "sm" | "md";
  /** Allow staff without decide permission to view chips but not acknowledge. */
  canAcknowledge?: boolean;
  /** Notify parent that the order on the server changed (so it can refetch / patch state). */
  onAcknowledged?: (updated: Order) => void;
}

export function WeightWarningChips({
  order,
  clinicId,
  warnings,
  size = "md",
  canAcknowledge = true,
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
          onAcknowledged={onAcknowledged}
        />
      ))}
    </div>
  );
}

type FormMode = "none" | "acknowledge" | "edit" | "undo";

function WeightWarningChip({
  order,
  clinicId,
  warning,
  size,
  canAcknowledge,
  onAcknowledged,
}: {
  order: Order;
  clinicId: ClinicId;
  warning: WeightWarning;
  size: "sm" | "md";
  canAcknowledge: boolean;
  onAcknowledged?: (updated: Order) => void;
}) {
  const ack = findAcknowledgement(order, warning.kind);
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
    return (
      <div className="inline-flex flex-wrap items-start gap-1.5">
        <span
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
        {canAcknowledge && mode === "none" && (
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
        {(mode === "edit" || mode === "undo") && (
          <InlineForm
            label={
              mode === "edit"
                ? "Update the rationale for this acknowledgement"
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
            submitLabel={mode === "edit" ? "Save changes" : "Undo acknowledgement"}
            submitIcon={mode === "edit" ? "save" : "undo"}
            onSubmit={async () => {
              setSubmitting(true);
              setError(null);
              try {
                const updated =
                  mode === "edit"
                    ? await editWeightWarningAcknowledgement(
                        clinicId,
                        order.id,
                        warning.kind,
                        text,
                      )
                    : await undoWeightWarningAcknowledgement(
                        clinicId,
                        order.id,
                        warning.kind,
                        text,
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
