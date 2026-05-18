"use client";

/**
 * DeliveryInstructionsCard — Task-318.
 *
 * Surfaces the patient-typed courier note on Order Detail and lets a staff
 * member review/edit/approve or reject it. The patient's original text is
 * always shown (quoted, immutable) so a reviewer can compare it to the
 * `staff_value` that will actually ship to Primed.
 *
 * Permission model: every mutating control is gated by `write:orders`; users
 * without the capability see a read-only view with the status pill.
 */

import { useState } from "react";
import { Truck } from "lucide-react";
import { DCard } from "./orderPrimitives";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { USERS_REGISTRY } from "@/lib/api/mock";
import { useCurrentUser } from "@/lib/context";
import { can } from "@/lib/permissions";
import { DELIVERY_INSTRUCTIONS_MAX_LEN } from "@/lib/api/fixtures/deliveryInstructions";

/**
 * Format an ISO timestamp as a short relative phrase ("2h ago", "3d ago").
 * Falls back to the absolute date for timestamps older than ~30 days so the
 * status pill stays compact without ever showing something like "412d ago".
 */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 30) return `${Math.round(diffSec / 86400)}d ago`;
  return formatDateTime(iso);
}
import {
  approveDeliveryInstructionsAction,
  rejectDeliveryInstructionsAction,
  updateDeliveryInstructionsAction,
} from "@/lib/actions/deliveryInstructionsActions";
import type { ClinicId, Order } from "@/types";

type Mode = "view" | "edit" | "reject";

interface Props {
  order: Order;
  clinicId: ClinicId;
  onOrderUpdated?: (order: Order) => void;
}

function StatusPill({
  status,
  reviewer,
  reviewedAt,
}: {
  status: "unreviewed" | "approved" | "rejected";
  reviewer?: string | null;
  reviewedAt?: string | null;
}) {
  const cls =
    status === "approved" ? "bg-ok-bg text-ok border-ok-bdr"
    : status === "rejected" ? "bg-err-bg text-err border-err-bdr"
    : "bg-warn-bg text-warn border-warn-bdr";
  const label =
    status === "approved" ? "Approved"
    : status === "rejected" ? "Rejected"
    : "Unreviewed";
  const suffix =
    status !== "unreviewed" && reviewer && reviewedAt
      ? ` · ${reviewer} · ${formatRelative(reviewedAt)}`
      : "";
  return (
    <span
      className={`inline-flex items-center text-[10.5px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${cls}`}
      data-testid="delivery-instructions-status-pill"
    >
      {label}
      {suffix && <span className="ml-1 normal-case font-medium tracking-normal">{suffix}</span>}
    </span>
  );
}

export function DeliveryInstructionsCard({ order, clinicId, onOrderUpdated }: Props) {
  const user = useCurrentUser();
  const canWrite = can(user, "write", "orders");
  const di = order.delivery_instructions;

  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState(di?.staff_value ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Task-318 — Omit the card entirely when the patient didn't supply any
  // courier instruction. The sidebar stays clean and reviewers only see the
  // card on the orders that need their attention.
  if (!di) return null;

  const reviewer = di.reviewed_by_user_id
    ? USERS_REGISTRY[di.reviewed_by_user_id]?.full_name ?? di.reviewed_by_user_id
    : null;

  function resetMode() {
    setMode("view");
    setError(null);
    setReason("");
    setDraft(di?.staff_value ?? "");
  }

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update delivery instructions");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    const updated = await run(() =>
      approveDeliveryInstructionsAction(clinicId, order.id,
        mode === "edit" ? { staff_value: draft } : undefined),
    );
    if (updated) { onOrderUpdated?.(updated); resetMode(); }
  }

  async function handleSaveEdit() {
    const updated = await run(() =>
      updateDeliveryInstructionsAction(clinicId, order.id, { staff_value: draft }),
    );
    if (updated) { onOrderUpdated?.(updated); resetMode(); }
  }

  async function handleReject() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Please give a reason for rejecting the instruction.");
      return;
    }
    const updated = await run(() =>
      rejectDeliveryInstructionsAction(clinicId, order.id, { reason: trimmed }),
    );
    if (updated) { onOrderUpdated?.(updated); resetMode(); }
  }

  const draftLen = draft.length;
  const overLimit = draftLen > DELIVERY_INSTRUCTIONS_MAX_LEN;

  return (
    <DCard
      icon={Truck}
      title="Delivery instructions"
      headerExtra={
        <StatusPill
          status={di.review_status}
          reviewer={reviewer}
          reviewedAt={di.reviewed_at}
        />
      }
    >
      <div className="space-y-3">
        <div>
          <div className="text-[10.5px] font-semibold text-t3 uppercase tracking-wide mb-1">
            Patient submitted
          </div>
          {di.patient_submitted ? (
            <blockquote className="text-[12px] text-t1 italic border-l-2 border-bdr pl-2 whitespace-pre-wrap">
              “{di.patient_submitted}”
            </blockquote>
          ) : (
            <p className="text-[12px] text-t3">— None provided —</p>
          )}
        </div>

        {mode === "view" && (
          <div>
            <div className="text-[10.5px] font-semibold text-t3 uppercase tracking-wide mb-1">
              Will ship to courier
            </div>
            {di.staff_value ? (
              <p className="text-[12px] text-t1 whitespace-pre-wrap">{di.staff_value}</p>
            ) : (
              <p className="text-[12px] text-t3">
                {di.review_status === "rejected"
                  ? "Cleared on rejection — nothing will be sent to the courier."
                  : "No instruction will be sent to the courier."}
              </p>
            )}
            {di.review_status !== "unreviewed" && reviewer && di.reviewed_at && (
              <p className="text-[11px] text-t3 mt-1">
                {di.review_status === "approved" ? "Approved" : "Rejected"} by{" "}
                <span className="font-medium">{reviewer}</span> · {formatDateTime(di.reviewed_at)}
              </p>
            )}
          </div>
        )}

        {mode === "edit" && (
          <div>
            <label className="block text-[10.5px] font-semibold text-t3 uppercase tracking-wide mb-1">
              Staff value (will ship to courier)
            </label>
            <textarea
              className="w-full text-[12px] border border-bdr rounded-md p-2 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-brand/30"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={busy}
              maxLength={DELIVERY_INSTRUCTIONS_MAX_LEN}
            />
            <p className={`text-[11px] mt-1 ${overLimit ? "text-err" : "text-t3"}`}>
              {draftLen}/{DELIVERY_INSTRUCTIONS_MAX_LEN} characters
            </p>
          </div>
        )}

        {mode === "reject" && (
          <div>
            <label className="block text-[10.5px] font-semibold text-t3 uppercase tracking-wide mb-1">
              Reason for rejection
            </label>
            <textarea
              className="w-full text-[12px] border border-bdr rounded-md p-2 min-h-[60px] focus:outline-none focus:ring-2 focus:ring-brand/30"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
              placeholder="e.g. Asked courier to leave parcel in an unsafe location"
            />
            <p className="text-[11px] text-t3 mt-1">
              Captured in the audit trail. The staff value is cleared so nothing
              is sent to the courier.
            </p>
          </div>
        )}

        {error && <p className="text-[11.5px] text-err">{error}</p>}

        {canWrite && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {mode === "view" && (
              <>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={busy || di.review_status === "approved"}
                >
                  {di.review_status === "approved" ? "Approved" : "Approve"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setMode("edit"); setDraft(di.staff_value ?? ""); }}
                  disabled={busy}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMode("reject")}
                  disabled={busy || di.review_status === "rejected"}
                >
                  Reject
                </Button>
              </>
            )}
            {mode === "edit" && (
              <>
                <Button size="sm" onClick={handleSaveEdit} disabled={busy || overLimit}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleApprove}
                  disabled={busy || overLimit}
                >
                  Save &amp; approve
                </Button>
                <Button size="sm" variant="ghost" onClick={resetMode} disabled={busy}>
                  Cancel
                </Button>
              </>
            )}
            {mode === "reject" && (
              <>
                <Button
                  size="sm"
                  onClick={handleReject}
                  disabled={busy || !reason.trim()}
                >
                  Confirm rejection
                </Button>
                <Button size="sm" variant="ghost" onClick={resetMode} disabled={busy}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </DCard>
  );
}
