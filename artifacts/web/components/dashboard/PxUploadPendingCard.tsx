"use client";

/**
 * Task-125 — Px Upload Pending widget for the Owner Dashboard.
 *
 * Surfaces every order that requires a patient prescription upload but
 * hasn't received one yet (contextual_flags includes "Px upload pending"
 * AND px_upload is null), so staff don't have to open each order one by
 * one to notice a stale link.
 *
 * Each row shows:
 *   - patient name + order id
 *   - days since the upload link was first sent
 *   - whether the latest token is expired
 *   - resend count (initial send + each resend)
 *   - inline "Resend link" button that calls resendPxUploadLink so staff
 *     can re-issue without opening the order.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mail, RefreshCw, AlertTriangle, Send, Phone, PhoneCall } from "lucide-react";
import { CURRENT_USER, resendPxUploadLink } from "@/lib/api/mock";
import { can } from "@/lib/permissions";
import { NOW } from "@/lib/api/constants";
import type { ClinicId, Order } from "@/types";

interface Props {
  clinicId:    ClinicId;
  orders:      Order[];
  patientMap:  Record<string, string>;
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function daysBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function PxUploadPendingCard({ clinicId, orders, patientMap }: Props) {
  const [rows, setRows]                     = useState<Order[]>(orders);
  const [pendingId, setPendingId]           = useState<string | null>(null);
  const [reminderPendingId, setReminderPendingId] = useState<string | null>(null);
  const [markCalledPendingId, setMarkCalledPendingId] = useState<string | null>(null);
  const [toast, setToast]                   = useState<{ message: string; type: "ok" | "err" } | null>(null);
  const canWriteOrders = can(CURRENT_USER, "write", "orders");
  // Task-263 — synchronous re-entrancy guard. The `pendingId` state above
  // doesn't update until React commits, so two rapid clicks (same row OR
  // different rows) on a slow network could both pass the disabled check
  // and each fire a Postmark send + push a `resends[]` entry. This ref
  // flips immediately inside handleResend so the second click bails before
  // resendPxUploadLink is invoked.
  const resendInFlightRef = useRef(false);

  // Keep in sync if the parent re-fetches (e.g. router refresh) — without this,
  // a brand-new pending order added after mount would never appear in the list.
  useEffect(() => {
    setRows(orders);
  }, [orders]);

  async function handleResend(orderId: string) {
    // Task-263 — bail synchronously if a resend is already in flight, so
    // double-clicks (same row or another row) before React re-renders can't
    // fire `resendPxUploadLink` twice.
    if (resendInFlightRef.current) return;
    resendInFlightRef.current = true;
    setPendingId(orderId);
    try {
      const updated = await resendPxUploadLink(clinicId, orderId);
      setRows((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      const sentTo = updated.px_upload_link?.to_email ?? "the patient";
      setToast({
        message: `Upload link re-sent to ${sentTo}. The previous link is no longer valid.`,
        type: "ok",
      });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Could not resend upload link.",
        type: "err",
      });
    } finally {
      resendInFlightRef.current = false;
      setPendingId(null);
    }
  }

  // Task-269 — Clear the auto-chase escalation once staff have phoned the
  // patient. Drops the "Px upload chase escalated" contextual flag, clears
  // `auto_chase_escalated_at` and resets `auto_resends` server-side so the
  // cron is allowed to resume. We patch the row in place so the red
  // "Call patient" treatment disappears immediately and the header count
  // recalculates without a refetch.
  async function handleMarkCalled(orderId: string) {
    setMarkCalledPendingId(orderId);
    try {
      const res = await fetch(
        `/api/orders/${clinicId}/${orderId}/px-upload/mark-called`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        contextual_flags?: string[];
        px_upload_link?: Order["px_upload_link"];
      };
      if (!res.ok) {
        throw new Error(body.message || `Could not mark patient as called (${res.status}).`);
      }
      setRows((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                contextual_flags: body.contextual_flags ?? o.contextual_flags,
                px_upload_link: body.px_upload_link ?? o.px_upload_link,
              }
            : o,
        ),
      );
      setToast({
        message: "Marked as called — the auto-chase will resume if no upload arrives.",
        type: "ok",
      });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Could not mark patient as called.",
        type: "err",
      });
    } finally {
      setMarkCalledPendingId(null);
    }
  }

  // Task-183 — Manual "Send reminder now" parity with Order Detail. Hits the
  // same server route that flips the cron's idempotency flag, so the next
  // scheduled sweep won't double-send. Eligibility (link active, unconsumed,
  // unexpired, not both reminders already sent) is mirrored in the row below.
  async function handleSendReminder(orderId: string) {
    setReminderPendingId(orderId);
    try {
      const res = await fetch(
        `/api/orders/${clinicId}/${orderId}/px-upload-reminder`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        kind?: "first" | "final";
        status?: "Delivered" | "Bounced" | "Failed";
        px_upload_link?: Order["px_upload_link"];
      };
      if (!res.ok || body.status !== "Delivered") {
        throw new Error(body.message || `Reminder failed (${res.status}).`);
      }
      // Patch the row so reminder flags + counts update without a refetch.
      setRows((prev) =>
        prev.map((o) =>
          o.id === orderId && body.px_upload_link
            ? { ...o, px_upload_link: body.px_upload_link }
            : o,
        ),
      );
      const sentTo = body.px_upload_link?.to_email ?? "the patient";
      const label = body.kind === "final" ? "Final reminder" : "Reminder";
      setToast({
        message: `${label} sent to ${sentTo}.`,
        type: "ok",
      });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Could not send reminder.",
        type: "err",
      });
    } finally {
      setReminderPendingId(null);
    }
  }

  // Task-269 — Count of rows where the auto-chase cron has escalated. Surfaced
  // in the header so staff see at a glance how many patients need a phone
  // call instead of another email tap.
  const escalatedCount = rows.filter(
    (o) => o.px_upload_link?.auto_chase_escalated_at != null,
  ).length;

  return (
    <div className="bg-surface border border-warn-bdr rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-warn-bdr bg-warn-bg/40">
        <Mail className="w-3.5 h-3.5 text-warn shrink-0" />
        <h3 className="text-[11px] font-bold text-warn uppercase tracking-wider flex-1">
          Awaiting Px upload
        </h3>
        {escalatedCount > 0 && (
          <span
            data-testid="px-upload-escalated-count"
            className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-px rounded bg-err text-white"
            title="Auto-chase has given up on these orders — staff need to call the patient."
          >
            <PhoneCall className="w-2.5 h-2.5" aria-hidden />
            {escalatedCount} TO CALL
          </span>
        )}
        <span className="text-[9px] font-bold px-1.5 py-px rounded bg-warn text-white">
          {rows.length} {rows.length === 1 ? "ORDER" : "ORDERS"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-5 text-[12px] text-t3 text-center">
          No orders waiting on a prescription upload
        </div>
      ) : (
        <div className="divide-y divide-bdr">
          {rows.map((order) => {
            const name      = patientMap[order.patient_id] ?? order.patient_id;
            const link      = order.px_upload_link;
            // "First sent" anchors on the immutable first_sent_at stamp set on
            // the very first successful email delivery; it survives token
            // rotation in resendPxUploadLink, so age stays accurate across
            // resends. For records that pre-date first_sent_at (rolled-out
            // before Task-125), fall back to the current token's sent_at so
            // staff still see a meaningful age. If the link was never
            // delivered at all we surface that explicitly.
            const firstSent = link?.first_sent_at ?? link?.sent_at ?? null;
            const ageDays   = firstSent ? daysBetween(firstSent, NOW) : null;
            const expired   = link ? Date.parse(link.expires_at) < Date.parse(NOW) : false;
            // resends array tracks every re-issue; +1 for the initial send
            // (counted once we have any evidence of a successful delivery).
            const hasInitialSend = Boolean(link?.first_sent_at ?? link?.sent_at);
            const resendCount = (link?.resends?.length ?? 0) + (hasInitialSend ? 1 : 0);
            const isBusy    = pendingId === order.id;
            const isReminderBusy = reminderPendingId === order.id;
            const isMarkCalledBusy = markCalledPendingId === order.id;
            // Task-263 — any in-flight resend disables every row's Resend
            // button so staff can't fire a second send on a different row
            // while the first one is still mid-flight.
            const anyResendInFlight = pendingId !== null;

            // Task-269 — Auto-chase has burned through MAX_AUTO_RESENDS and
            // wants staff to phone the patient. We trust the link timestamp
            // as the source of truth (the contextual flag is added at the
            // same time but the timestamp is what the cron checks to skip).
            const escalated = link?.auto_chase_escalated_at != null;

            // Task-183 — Mirror the server-side eligibility from
            // sendPxUploadReminderNow so the "Send reminder" affordance only
            // appears when the cron would actually have something to send.
            const linkConsumed       = link?.consumed_at != null;
            const firstReminderSent  = link?.reminder_sent_at != null;
            const finalReminderSent  = link?.final_reminder_sent_at != null;
            const canSendManualReminder =
              canWriteOrders &&
              link != null &&
              order.px_upload == null &&
              !expired &&
              !linkConsumed &&
              !(firstReminderSent && finalReminderSent);
            const reminderKindNext: "first" | "final" | null =
              !canSendManualReminder
                ? null
                : !firstReminderSent
                ? "first"
                : !finalReminderSent
                ? "final"
                : null;
            const reminderLabel =
              reminderKindNext === "final" ? "Send final reminder" : "Send reminder";

            // Severity tint: red once the link is expired OR sat for 5+ days,
            // OR the auto-chase has escalated (in which case the row already
            // sports the red treatment regardless of age).
            const tone =
              escalated || expired || (ageDays !== null && ageDays >= 5)
                ? "text-err"
                : ageDays !== null && ageDays >= 3
                ? "text-warn"
                : "text-t3";

            const ageLabel =
              ageDays === null
                ? "Link not yet sent"
                : ageDays === 0
                ? "Sent today"
                : `${ageDays}d since first sent`;

            return (
              <div
                key={order.id}
                data-testid={escalated ? "px-upload-row-escalated" : "px-upload-row"}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                  escalated
                    ? "bg-err-bg/40 hover:bg-err-bg/60 border-l-4 border-err"
                    : "hover:bg-brand/5"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${
                    escalated
                      ? "bg-gradient-to-br from-err to-err"
                      : "bg-gradient-to-br from-brand-mid to-brand"
                  }`}
                >
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/${clinicId}/orders/${order.id}`}
                      className="block text-[12px] font-semibold text-t1 truncate hover:text-brand"
                    >
                      {name}
                    </Link>
                    {escalated && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded bg-err text-white"
                        title="The auto-chase has stopped emailing this patient — call them directly."
                      >
                        <Phone className="w-2.5 h-2.5" aria-hidden /> Call patient
                      </span>
                    )}
                  </div>
                  <div className="text-[10.5px] text-t3 truncate flex items-center gap-1.5">
                    <span>{order.id}</span>
                    <span aria-hidden>·</span>
                    <span className={`font-semibold ${tone}`}>
                      {ageLabel}
                    </span>
                    {expired && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-0.5 font-semibold text-err">
                          <AlertTriangle className="w-2.5 h-2.5" /> Link expired
                        </span>
                      </>
                    )}
                    <span aria-hidden>·</span>
                    <span>
                      {resendCount === 1 ? "1 send" : `${resendCount} sends`}
                    </span>
                    {escalated && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="font-semibold text-err">
                          Auto-chase gave up
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  {escalated && canWriteOrders ? (
                    // Task-269 — On escalated rows the email avenue has been
                    // exhausted; replace the inline Resend with a "Mark called"
                    // action that drops the escalation flag, resets
                    // auto_resends and lets the cron resume nudging.
                    <button
                      type="button"
                      onClick={() => handleMarkCalled(order.id)}
                      disabled={isMarkCalledBusy}
                      title="Confirm you've spoken to the patient. Clears the escalation and re-enables the auto-chase."
                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 rounded bg-err text-white hover:bg-err/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <PhoneCall className={`w-3 h-3 ${isMarkCalledBusy ? "animate-pulse" : ""}`} />
                      {isMarkCalledBusy ? "Saving…" : "Mark called"}
                    </button>
                  ) : (
                    <>
                      {canSendManualReminder && (
                        <button
                          type="button"
                          onClick={() => handleSendReminder(order.id)}
                          disabled={isReminderBusy || isBusy}
                          title={
                            reminderKindNext === "final"
                              ? "Send the final reminder email now instead of waiting for the scheduled sweep."
                              : "Send the first reminder email now instead of waiting for the scheduled sweep."
                          }
                          className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 rounded border border-brand/40 text-brand hover:bg-brand/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Send className={`w-3 h-3 ${isReminderBusy ? "animate-pulse" : ""}`} />
                          {isReminderBusy ? "Sending…" : reminderLabel}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleResend(order.id)}
                        disabled={anyResendInFlight || isReminderBusy}
                        className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 rounded border border-brand/40 text-brand hover:bg-brand/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${isBusy ? "animate-spin" : ""}`} />
                        {isBusy ? "Sending…" : "Resend link"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`px-4 py-2 text-[11px] border-t ${
            toast.type === "ok"
              ? "bg-ok-bg text-ok border-ok-bdr"
              : "bg-err-bg text-err border-err-bdr"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
