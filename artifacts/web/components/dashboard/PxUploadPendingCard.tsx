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

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, RefreshCw, AlertTriangle } from "lucide-react";
import { resendPxUploadLink } from "@/lib/api/mock";
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
  const [rows, setRows]           = useState<Order[]>(orders);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast]         = useState<{ message: string; type: "ok" | "err" } | null>(null);

  // Keep in sync if the parent re-fetches (e.g. router refresh) — without this,
  // a brand-new pending order added after mount would never appear in the list.
  useEffect(() => {
    setRows(orders);
  }, [orders]);

  async function handleResend(orderId: string) {
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
      setPendingId(null);
    }
  }

  return (
    <div className="bg-surface border border-warn-bdr rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-warn-bdr bg-warn-bg/40">
        <Mail className="w-3.5 h-3.5 text-warn shrink-0" />
        <h3 className="text-[11px] font-bold text-warn uppercase tracking-wider flex-1">
          Awaiting Px upload
        </h3>
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

            // Severity tint: red once the link is expired OR sat for 5+ days.
            const tone =
              expired || (ageDays !== null && ageDays >= 5)
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
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand/5 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-mid to-brand flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/${clinicId}/orders/${order.id}`}
                    className="block text-[12px] font-semibold text-t1 truncate hover:text-brand"
                  >
                    {name}
                  </Link>
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
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleResend(order.id)}
                  disabled={isBusy}
                  className="shrink-0 inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 rounded border border-brand/40 text-brand hover:bg-brand/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${isBusy ? "animate-spin" : ""}`} />
                  {isBusy ? "Sending…" : "Resend link"}
                </button>
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
