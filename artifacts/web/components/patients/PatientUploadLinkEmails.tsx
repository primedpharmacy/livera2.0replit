"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight, Mail } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { USERS_REGISTRY, getOrderAuditEvents } from "@/lib/api/mock";
import type { ClinicId, Order } from "@/lib/api/types";

type HistoryRow = {
  key: string;
  ts: number;
  when: string;
  kind: "Initial" | "Resend" | "Suppressed";
  actor: string;
  to_email: string;
  outcome: "Delivered" | "Bounced" | "Failed" | "Rate-limited";
  error_message: string | null;
  order_id: string;
};

function buildRowsForOrder(order: Order): HistoryRow[] {
  const link = order.px_upload_link;
  if (!link) return [];
  const rows: HistoryRow[] = [];
  const userName = (id: string | null | undefined) =>
    id ? USERS_REGISTRY[id]?.full_name ?? id : "System (intake)";

  if (link.initial_attempted_at) {
    rows.push({
      key: `${order.id}:initial`,
      ts: new Date(link.initial_attempted_at).getTime(),
      when: link.initial_attempted_at,
      kind: "Initial",
      actor: userName(link.initial_send_by_user_id ?? null),
      to_email: link.initial_to_email ?? link.to_email,
      outcome: link.initial_send_status ?? "Delivered",
      error_message: link.initial_send_error_message ?? null,
      order_id: order.id,
    });
  } else if (link.sent_at) {
    rows.push({
      key: `${order.id}:initial`,
      ts: new Date(link.sent_at).getTime(),
      when: link.sent_at,
      kind: "Initial",
      actor: userName(null),
      to_email: link.to_email,
      outcome: "Delivered",
      error_message: null,
      order_id: order.id,
    });
  }

  (link.resends ?? []).forEach((r, idx) => {
    const when = r.sent_at ?? r.attempted_at;
    if (!when) return;
    rows.push({
      key: `${order.id}:resend-${idx}`,
      ts: new Date(when).getTime(),
      when,
      kind: "Resend",
      actor: userName(r.by_user_id),
      to_email: r.to_email,
      outcome: r.status ?? "Delivered",
      error_message: r.error_message ?? null,
      order_id: order.id,
    });
  });

  getOrderAuditEvents(order.id, ["px_upload_link_resend_suppressed"]).forEach(
    (evt, idx) => {
      if (!evt.occurred_at) return;
      const payload = evt.payload ?? {};
      const cooldownSeconds =
        typeof payload.cooldown_seconds === "number"
          ? payload.cooldown_seconds
          : 60;
      const toEmail =
        typeof payload.to_email === "string" ? payload.to_email : link.to_email;
      rows.push({
        key: `${order.id}:suppressed-${idx}`,
        ts: new Date(evt.occurred_at).getTime(),
        when: evt.occurred_at,
        kind: "Suppressed",
        actor: userName(evt.actor_user_id),
        to_email: toEmail,
        outcome: "Rate-limited",
        error_message: `Cool-down active (${cooldownSeconds}s window) — patient was not emailed.`,
        order_id: order.id,
      });
    },
  );

  return rows;
}

function outcomeClass(o: HistoryRow["outcome"]) {
  switch (o) {
    case "Delivered":
      return "bg-ok-bg text-ok border-ok-bdr";
    case "Bounced":
    case "Failed":
      return "bg-err-bg text-err border-err-bdr";
    case "Rate-limited":
      return "bg-warn-bg text-warn border-warn-bdr";
  }
}

export function PatientUploadLinkEmails({
  clinicId,
  orders,
}: {
  clinicId: ClinicId;
  orders: Order[];
}) {
  const [open, setOpen] = useState(false);

  const rows = orders
    .flatMap(buildRowsForOrder)
    .sort((a, b) => b.ts - a.ts);

  if (rows.length === 0) return null;

  return (
    <div
      className="bg-surface border border-bdr rounded-lg overflow-hidden"
      data-testid="patient-upload-link-emails"
    >
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left bg-page-bg hover:bg-bg2 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-brand" />
          <span className="text-[11px] font-bold text-t2 uppercase tracking-wider">
            Upload-link emails ({rows.length})
          </span>
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-t2" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-t2" />
        )}
      </button>
      {open && (
        <ul className="p-3 space-y-2">
          {rows.map((row) => (
            <li
              key={row.key}
              className="text-[11px] p-2 rounded-md bg-bg2 border border-bdr"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-t1">{row.kind}</span>
                  <span className="text-t3">·</span>
                  <span className="text-t2">{formatDateTime(row.when)}</span>
                  <span className="text-t3">·</span>
                  <Link
                    href={`/${clinicId}/orders/${row.order_id}`}
                    className="font-mono text-brand hover:underline"
                  >
                    {row.order_id}
                  </Link>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${outcomeClass(row.outcome)}`}
                >
                  {row.outcome}
                </span>
              </div>
              <p className="mt-1 text-t2">
                {row.kind === "Suppressed" ? "Attempted by" : "Triggered by"}{" "}
                <span className="text-t1 font-semibold">{row.actor}</span>
                {" · to "}
                <span className="font-mono text-t1">{row.to_email}</span>
              </p>
              {row.error_message && (
                <p className="mt-1 text-t3 italic">{row.error_message}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
