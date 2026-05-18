/**
 * Ops → Retry Sweeps — Task-105.
 *
 * Surfaces the in-memory ring buffer maintained by the in-process job
 * scheduler so operators can confirm the failed-email retry loop is healthy
 * without tailing server logs.
 *
 * Each row corresponds to one clinic within one sweep tick. Sweeps that
 * threw (outcome='error') are highlighted in red so problems jump out.
 */

import { RefreshCw, AlertTriangle, Clock, Globe, User as UserIcon } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Breadcrumb } from "@/components/shell/Breadcrumb";
import { getRecentRetrySweeps, type SweepRecord } from "@/lib/api/jobs/scheduler";
import { findUserByUid } from "@/lib/users/registry";
import { RunSweepButton } from "./RunSweepButton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ clinic_id: string }> };

function formatRelative(ts: string, nowMs: number): string {
  const diffMs = nowMs - new Date(ts).getTime();
  if (diffMs < 0) return "just now";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} UTC`;
}

export default async function RetrySweepsPage({ params }: Props) {
  const { clinic_id } = await params;
  const rows = getRecentRetrySweeps(50);
  const nowMs = Date.now();

  const totalSweeps = new Set(rows.map((r) => r.sweep_id)).size;
  const failedRows  = rows.filter((r) => r.outcome === "error");
  const latest      = rows[0];

  return (
    <>
      <Breadcrumb items={[{ label: "Ops" }, { label: "Retry Sweeps" }]} />
      <PageHeader
        icon={RefreshCw}
        title="Retry Sweeps"
        subtitle={
          `In-process scheduler · failed patient-email retry job · runs every 5 minutes per clinic · ` +
          `last ${rows.length} rows from ${totalSweeps} sweep${totalSweeps === 1 ? "" : "s"}`
        }
        actions={<RunSweepButton clinicId={clinic_id} />}
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Last sweep"
            value={latest ? formatRelative(latest.timestamp, nowMs) : "—"}
            sub={latest ? `${latest.clinic_id} · ${formatTime(latest.timestamp)}` : "No sweeps recorded yet"}
          />
          <StatCard
            label="Sweeps in buffer"
            value={String(totalSweeps)}
            sub={`${rows.length} clinic rows`}
          />
          <StatCard
            label="Failed sweeps"
            value={String(failedRows.length)}
            sub={failedRows.length === 0 ? "All sweeps healthy" : "Job threw — see rows below"}
            tone={failedRows.length > 0 ? "err" : "ok"}
          />
        </div>

        <div className="bg-surface border border-bdr rounded-lg overflow-hidden" data-clinic-id={clinic_id}>
          <table className="w-full text-[13px]">
            <thead className="bg-page-bg border-b border-bdr text-t3 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left  font-semibold px-3 py-2">When</th>
                <th className="text-left  font-semibold px-3 py-2">Triggered by</th>
                <th className="text-left  font-semibold px-3 py-2">Clinic</th>
                <th className="text-left  font-semibold px-3 py-2">Outcome</th>
                <th className="text-right font-semibold px-3 py-2">Considered</th>
                <th className="text-right font-semibold px-3 py-2">Attempted</th>
                <th className="text-right font-semibold px-3 py-2">Delivered</th>
                <th className="text-right font-semibold px-3 py-2">Bounced</th>
                <th className="text-right font-semibold px-3 py-2">Still failing</th>
                <th className="text-right font-semibold px-3 py-2">Exhausted</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-t3">
                    No retry sweeps recorded yet. The scheduler runs every 5 minutes;
                    the first sweep fires ~10s after server boot.
                  </td>
                </tr>
              )}
              {rows.map((row, idx) => (
                <SweepRow key={`${row.sweep_id}_${row.clinic_id}_${idx}`} row={row} nowMs={nowMs} />
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-t3">
          History is kept in-process (last 100 rows) and resets on server restart. Audit lines
          continue to be written to server logs for permanent retention.
        </p>
      </div>
    </>
  );
}

function SweepRow({ row, nowMs }: { row: SweepRecord; nowMs: number }) {
  const isError = row.outcome === "error";
  return (
    <tr className={isError ? "bg-err-bg/40 border-b border-err-bdr" : "border-b border-bdr last:border-b-0"}>
      <td className="px-3 py-2 align-top">
        <div className="font-medium text-t1">{formatRelative(row.timestamp, nowMs)}</div>
        <div className="text-[11px] text-t3">{formatTime(row.timestamp)}</div>
      </td>
      <td className="px-3 py-2 align-top">
        <TriggerBadge source={row.trigger_source} actorId={row.actor_id} />
      </td>
      <td className="px-3 py-2 align-top font-medium text-t1">{row.clinic_id}</td>
      <td className="px-3 py-2 align-top">
        {isError ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-px rounded-full bg-err-bg text-err border border-err-bdr">
            <AlertTriangle className="w-3 h-3" aria-hidden /> Failed
          </span>
        ) : (
          <span className="inline-flex items-center text-[11px] font-bold px-2 py-px rounded-full bg-ok-bg text-ok border border-ok-bdr">
            OK
          </span>
        )}
        {isError && row.error_message && (
          <div className="text-[11px] text-err mt-1 max-w-[36ch] truncate" title={row.error_message}>
            {row.error_message}
          </div>
        )}
      </td>
      <Num n={row.considered} />
      <Num n={row.attempted} />
      <Num n={row.delivered} tone={row.delivered > 0 ? "ok" : "muted"} />
      <Num n={row.bounced}   tone={row.bounced   > 0 ? "warn" : "muted"} />
      <Num n={row.still_failing} tone={row.still_failing > 0 ? "warn" : "muted"} />
      <Num n={row.exhausted}     tone={row.exhausted     > 0 ? "err"  : "muted"} />
    </tr>
  );
}

function TriggerBadge({
  source,
  actorId,
}: {
  source: SweepRecord["trigger_source"];
  actorId: string;
}) {
  if (source === "manual") {
    const user = findUserByUid(actorId);
    const label = user?.full_name ?? actorId;
    return (
      <div className="flex flex-col gap-0.5" data-trigger-source="manual">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-px rounded-full bg-brand/15 text-brand border border-brand/40 w-fit">
          <UserIcon className="w-3 h-3" aria-hidden /> Manual
        </span>
        <span className="text-[11px] text-t2 truncate max-w-[16ch]" title={label}>
          {label}
        </span>
      </div>
    );
  }
  if (source === "cron") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-px rounded-full bg-page-bg text-t2 border border-bdr w-fit"
        data-trigger-source="cron"
      >
        <Globe className="w-3 h-3" aria-hidden /> Cron
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-px rounded-full bg-page-bg text-t3 border border-bdr w-fit"
      data-trigger-source="scheduler"
    >
      <Clock className="w-3 h-3" aria-hidden /> Scheduler
    </span>
  );
}

function Num({ n, tone = "muted" }: { n: number; tone?: "ok" | "warn" | "err" | "muted" }) {
  const colour =
    n === 0
      ? "text-t3"
      : tone === "ok"
        ? "text-ok"
        : tone === "warn"
          ? "text-warn"
          : tone === "err"
            ? "text-err"
            : "text-t1";
  return <td className={`px-3 py-2 align-top text-right tabular-nums ${colour}`}>{n}</td>;
}

function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "ok" | "err";
}) {
  const valueColour =
    tone === "ok" ? "text-ok" : tone === "err" ? "text-err" : "text-t1";
  return (
    <div className="bg-surface border border-bdr rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wider text-t3 font-bold">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${valueColour}`}>{value}</div>
      <div className="text-[11px] text-t3 mt-1">{sub}</div>
    </div>
  );
}
