/**
 * EmailEnvelopeBackfillPanel — Task-204, history list Task-298.
 *
 * Client surface for the staff-only email envelope backfill admin page.
 * Renders the scope picker + "Run backfill" button and, once the server
 * action returns, the result summary (counts + per-row unrecoverable
 * reasons). Mirrors the visual language of the existing settings/exports
 * page so this admin tool feels at home alongside the AUD-04 export.
 *
 * Task-298 adds a "Recent runs" history list sourced from the existing
 * `audit_events` table. The page hands us the initial list server-side
 * (so the first paint already shows it) plus an `onReloadHistory` server
 * action we call after each fresh run so the new row shows up without
 * a full page refresh.
 */

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Play, AlertTriangle, CheckCircle, Mail, History, ExternalLink } from "lucide-react";
import type { ClinicId } from "@/types";
import type {
  BackfillEntry,
  BackfillResult,
} from "@/lib/api/jobs/backfillPatientNotificationEnvelopes";

type Scope = "this_clinic" | "all_clinics";

export type BackfillRunListItem = {
  id: string;
  occurred_at: string;
  actor_name: string;
  actor_role: string;
  scope: "this_clinic" | "all_clinics" | "unknown";
  considered: number;
  backfilled_count: number;
  unrecoverable_count: number;
  html_backfilled: number;
  html_unsupported: number;
  skipped: number;
};

type Props = {
  clinicId: ClinicId;
  onRun: (scope: Scope) => Promise<BackfillResult>;
  initialHistory: BackfillRunListItem[];
  onReloadHistory: () => Promise<BackfillRunListItem[]>;
};

const REASON_LABEL: Record<string, string> = {
  patient_not_found:    "Patient record no longer exists",
  order_not_found:      "Originating order no longer exists",
  no_email_on_file:     "Patient has no email address on file",
  unsupported_template: "Template predates the backfill renderer",
};

export function EmailEnvelopeBackfillPanel({
  clinicId,
  onRun,
  initialHistory,
  onReloadHistory,
}: Props) {
  const [scope, setScope]         = useState<Scope>("this_clinic");
  const [result, setResult]       = useState<BackfillResult | null>(null);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [history, setHistory]     = useState<BackfillRunListItem[]>(initialHistory);
  const [historyStale, setHistoryStale] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleRun() {
    setErrorMsg(null);
    setHistoryStale(false);
    startTransition(async () => {
      try {
        const r = await onRun(scope);
        setResult(r);
        // Refresh the history so the run we just kicked off appears at
        // the top. Failure here is non-fatal — the run itself succeeded
        // and the next page load will pick the row up anyway — but we
        // surface a lightweight notice so staff know the list may be
        // stale instead of silently hiding the problem.
        try {
          const fresh = await onReloadHistory();
          setHistory(fresh);
        } catch {
          setHistoryStale(true);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Backfill failed");
        setResult(null);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
          <Mail className="w-3.5 h-3.5 text-brand" />
          <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider">
            Backfill email snapshots
          </h3>
        </div>

        <div className="p-5 space-y-4">
          <fieldset className="space-y-2">
            <legend className="block text-[11px] font-semibold text-t2 mb-1">Scope</legend>
            <label className="flex items-center gap-2 text-[13px] text-t1 cursor-pointer">
              <input
                type="radio"
                name="scope"
                value="this_clinic"
                checked={scope === "this_clinic"}
                onChange={() => setScope("this_clinic")}
                disabled={pending}
                className="accent-brand"
              />
              This clinic only (<span className="font-mono">{clinicId}</span>)
            </label>
            <label className="flex items-center gap-2 text-[13px] text-t1 cursor-pointer">
              <input
                type="radio"
                name="scope"
                value="all_clinics"
                checked={scope === "all_clinics"}
                onChange={() => setScope("all_clinics")}
                disabled={pending}
                className="accent-brand"
              />
              All clinics
            </label>
          </fieldset>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRun}
              disabled={pending}
              className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white bg-brand hover:bg-brand/90 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              {pending ? "Running…" : "Run backfill"}
            </button>

            {errorMsg && (
              <span className="flex items-center gap-1.5 text-[12px] text-err">
                <AlertTriangle className="w-3.5 h-3.5" /> {errorMsg}
              </span>
            )}
          </div>

          <p className="text-[11px] text-t3 leading-relaxed border-t border-bdr pt-3">
            The job is idempotent — rows already backfilled or already flagged
            unrecoverable are skipped. Every run is recorded as an audit event
            (<span className="font-mono">patient_notification_envelope_backfill_run</span>).
          </p>
        </div>
      </div>

      {result && <ResultSummary result={result} />}

      <RunHistory history={history} stale={historyStale} />
    </div>
  );
}

function RunHistory({
  history,
  stale,
}: {
  history: BackfillRunListItem[];
  stale: boolean;
}) {
  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
        <History className="w-3.5 h-3.5 text-t2" />
        <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider">
          Recent runs {history.length > 0 && <span className="text-t3">({history.length})</span>}
        </h3>
        {stale && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-err">
            <AlertTriangle className="w-3 h-3" />
            Couldn&rsquo;t refresh — list may be out of date. Reload the page to retry.
          </span>
        )}
      </div>

      {history.length === 0 ? (
        <div className="p-5">
          <p className="text-[12px] text-t2">
            No runs yet for this clinic.
          </p>
          <p className="text-[11px] text-t3 mt-1 leading-relaxed">
            The audit trail starts the first time someone runs the backfill from
            this page — each run will appear here with who triggered it, when,
            the scope, and what was recovered.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-page-bg">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-t2">When</th>
                <th className="text-left px-3 py-2 font-semibold text-t2">Who</th>
                <th className="text-left px-3 py-2 font-semibold text-t2">Scope</th>
                <th className="text-right px-3 py-2 font-semibold text-t2" title="Rows considered">
                  Considered
                </th>
                <th className="text-right px-3 py-2 font-semibold text-ok">Backfilled</th>
                <th className="text-right px-3 py-2 font-semibold text-err">Unrecov.</th>
                <th className="text-right px-3 py-2 font-semibold text-t2" title="HTML snapshots backfilled">
                  HTML ok
                </th>
                <th className="text-right px-3 py-2 font-semibold text-t2" title="Templates without a known HTML renderer">
                  HTML n/a
                </th>
                <th className="text-right px-3 py-2 font-semibold text-t2">Skipped</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className="border-t border-bdr">
                  <td className="px-3 py-2 text-t1 whitespace-nowrap">
                    {formatWhen(row.occurred_at)}
                  </td>
                  <td className="px-3 py-2 text-t1">
                    {row.actor_name}
                    <span className="text-t3"> · {row.actor_role}</span>
                  </td>
                  <td className="px-3 py-2 text-t2">{formatScope(row.scope)}</td>
                  <td className="px-3 py-2 text-right font-mono text-t1">{row.considered}</td>
                  <td className="px-3 py-2 text-right font-mono text-ok">{row.backfilled_count}</td>
                  <td className="px-3 py-2 text-right font-mono text-err">{row.unrecoverable_count}</td>
                  <td className="px-3 py-2 text-right font-mono text-t2">{row.html_backfilled}</td>
                  <td className="px-3 py-2 text-right font-mono text-t2">{row.html_unsupported}</td>
                  <td className="px-3 py-2 text-right font-mono text-t2">{row.skipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatScope(scope: BackfillRunListItem["scope"]): string {
  if (scope === "this_clinic") return "This clinic";
  if (scope === "all_clinics") return "All clinics";
  return "—";
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Compact, sortable, locale-stable — avoids hydration drift between SSR
  // and client locale by using ISO-style fields rather than toLocaleString.
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}

function ResultSummary({ result }: { result: BackfillResult }) {
  const totalActed = result.backfilled.length + result.unrecoverable.length;
  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
        <CheckCircle className="w-3.5 h-3.5 text-ok" />
        <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider">
          Run complete
        </h3>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Considered"        value={result.considered}              tone="t1" />
          <Stat label="Backfilled"        value={result.backfilled.length}       tone="ok" />
          <Stat label="Unrecoverable"     value={result.unrecoverable.length}    tone="err" />
          <Stat label="HTML backfilled"   value={result.html_backfilled.length}  tone="ok" />
          <Stat label="HTML unsupported"  value={result.html_unsupported.length} tone="t2" />
          <Stat label="Skipped"           value={result.skipped}                 tone="t2" />
        </div>

        {totalActed === 0 && (
          <p className="text-[12px] text-t2">
            Nothing to do — every eligible row already has a snapshot or has
            been flagged in a previous run.
          </p>
        )}

        {result.unrecoverable.length > 0 && (
          <div>
            <h4 className="text-[11px] font-bold text-t2 uppercase tracking-wider mb-2">
              Unrecoverable rows ({result.unrecoverable.length})
            </h4>
            <div className="border border-bdr rounded-md overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-page-bg">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-t2">Notification ID</th>
                    <th className="text-left px-3 py-2 font-semibold text-t2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.unrecoverable.map((row) => (
                    <tr key={row.notification_id} className="border-t border-bdr">
                      <td className="px-3 py-2 font-mono text-t1">
                        <UnrecoverableIdCell row={row} />
                      </td>
                      <td className="px-3 py-2 text-t2">
                        {row.reason
                          ? (REASON_LABEL[row.reason] ?? row.reason)
                          : "Unknown"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-t3 mt-2">
              These rows now carry an{" "}
              <span className="font-mono">email_envelope_unavailable_reason</span>{" "}
              so the per-patient notification log can explain the missing preview
              instead of silently hiding it.
            </p>
          </div>
        )}

        {result.html_unsupported.length > 0 && (
          <div>
            <h4 className="text-[11px] font-bold text-t2 uppercase tracking-wider mb-2">
              HTML left text-only ({result.html_unsupported.length})
            </h4>
            <p className="text-[11px] text-t3 mb-2">
              These templates have no known HTML renderer, so the snapshot is
              left as plain text — we never invent markup the patient didn&rsquo;t see.
            </p>
            <div className="border border-bdr rounded-md overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-page-bg">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-t2">Notification ID</th>
                    <th className="text-left px-3 py-2 font-semibold text-t2">Template</th>
                  </tr>
                </thead>
                <tbody>
                  {result.html_unsupported.map((row) => (
                    <tr key={row.notification_id} className="border-t border-bdr">
                      <td className="px-3 py-2 font-mono text-t1">{row.notification_id}</td>
                      <td className="px-3 py-2 font-mono text-t2">{row.template}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Task-299 — turn each unrecoverable notification_id into a deep link to the
// per-patient notification log entry it refers to, so staff don't have to
// hand-hunt the row in another tab. The link targets the patient's
// Notifications tab and includes a `#notification-<id>` hash that scrolls
// straight to the matching NotificationRow.
//
// Every unrecoverable row is linkable — including `patient_not_found`. In
// that case the patient page renders its own "patient not found" empty
// state, which is the graceful destination we want (staff confirm the
// record really is gone rather than hand-hunting). We surface a small
// inline hint so they know what to expect before clicking. The defensive
// plain-text fallback only kicks in if the job somehow omits the IDs.
function UnrecoverableIdCell({ row }: { row: BackfillEntry }) {
  if (!row.clinic_id || !row.patient_id) {
    return <span>{row.notification_id}</span>;
  }
  const href =
    `/${row.clinic_id}/patients/${row.patient_id}` +
    `?tab=notifications#notification-${row.notification_id}`;
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-brand hover:underline"
        title={
          row.reason === "patient_not_found"
            ? "Open the patient log — note the record itself is gone"
            : "Open this notification in the patient's notification log"
        }
      >
        {row.notification_id}
        <ExternalLink className="w-3 h-3" />
      </Link>
      {row.reason === "patient_not_found" && (
        <span className="text-[10px] font-normal text-t3 italic">
          (patient record deleted — link shows the empty state)
        </span>
      )}
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "t1" | "t2" | "ok" | "err";
}) {
  const toneClass =
    tone === "ok"  ? "text-ok"
    : tone === "err" ? "text-err"
    : tone === "t2"  ? "text-t2"
    : "text-t1";
  return (
    <div className="bg-page-bg border border-bdr rounded-md p-3">
      <p className={`text-[22px] font-bold font-mono leading-tight ${toneClass}`}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider font-bold text-t3 mt-1">
        {label}
      </p>
    </div>
  );
}
