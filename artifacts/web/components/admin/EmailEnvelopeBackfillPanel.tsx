/**
 * EmailEnvelopeBackfillPanel — Task-204.
 *
 * Client surface for the staff-only email envelope backfill admin page.
 * Renders the scope picker + "Run backfill" button and, once the server
 * action returns, the result summary (counts + per-row unrecoverable
 * reasons). Mirrors the visual language of the existing settings/exports
 * page so this admin tool feels at home alongside the AUD-04 export.
 */

"use client";

import { useState, useTransition } from "react";
import { Play, AlertTriangle, CheckCircle, Mail } from "lucide-react";
import type { ClinicId } from "@/types";
import type { BackfillResult } from "@/lib/api/jobs/backfillPatientNotificationEnvelopes";

type Scope = "this_clinic" | "all_clinics";

type Props = {
  clinicId: ClinicId;
  onRun: (scope: Scope) => Promise<BackfillResult>;
};

const REASON_LABEL: Record<string, string> = {
  patient_not_found:    "Patient record no longer exists",
  order_not_found:      "Originating order no longer exists",
  no_email_on_file:     "Patient has no email address on file",
  unsupported_template: "Template predates the backfill renderer",
};

export function EmailEnvelopeBackfillPanel({ clinicId, onRun }: Props) {
  const [scope, setScope]         = useState<Scope>("this_clinic");
  const [result, setResult]       = useState<BackfillResult | null>(null);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRun() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const r = await onRun(scope);
        setResult(r);
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
    </div>
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
                      <td className="px-3 py-2 font-mono text-t1">{row.notification_id}</td>
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
