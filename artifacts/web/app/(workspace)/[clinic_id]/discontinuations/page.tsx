/**
 * Discontinuations list page — BLD-13.5
 *
 * Lists all discontinuation protocols for the clinic with status, patient,
 * reason, and SLA indicators. Owner/Admin/Prescriber only.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { XCircle } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { formatDate, formatDateTime } from "@/lib/format";
import { listDiscontinuations, listPatients } from "@/lib/api/mock";
import { CURRENT_USER } from "@/lib/api/constants";
import type { ClinicId, DiscontinuationProtocol, DiscontinuationReason, DiscontinuationStatus } from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function DiscontinuationsPage({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <>
      <PageHeader
        icon={XCircle}
        title="Discontinuations"
        subtitle="Treatment discontinuation protocols"
      />
      <Suspense key={clinic_id} fallback={<LoadingState.Table />}>
        <Content clinicId={clinic_id as ClinicId} />
      </Suspense>
    </>
  );
}

const REASON_LABELS: Record<DiscontinuationReason, string> = {
  patient_request:    "Patient request",
  clinical_decision:  "Clinical decision",
  non_compliance:     "Non-compliance",
  adverse_event:      "Adverse event",
  lost_to_follow_up:  "Lost to follow-up",
};

const STATUS_CONFIG: Record<DiscontinuationStatus, { label: string; bg: string; text: string; border: string }> = {
  initiated:        { label: "Initiated",         bg: "bg-info-bg",  text: "text-info",  border: "border-info-bdr" },
  gp_notified:      { label: "GP notified",       bg: "bg-warn-bg",  text: "text-warn",  border: "border-warn-bdr" },
  follow_up_pending:{ label: "Follow-up pending", bg: "bg-err-bg",   text: "text-err",   border: "border-err-bdr" },
  closed:           { label: "Closed",            bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200" },
};

async function Content({ clinicId }: { clinicId: ClinicId }) {
  if (!CURRENT_USER.roles.some((r) => ["Owner", "Admin", "Prescriber"].includes(r))) {
    redirect(`/${clinicId}/dashboard`);
  }

  try {
    const [discs, patients] = await Promise.all([
      listDiscontinuations(clinicId),
      listPatients(clinicId),
    ]);

    const patientMap: Record<string, string> = {};
    patients.forEach((p) => { patientMap[p.id] = p.demographic.full_name; });

    const open   = discs.filter((d) => d.status !== "closed");
    const closed = discs.filter((d) => d.status === "closed");

    return (
      <div className="px-6 py-6 space-y-6 max-w-5xl">
        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total" value={discs.length} />
          <StatCard label="Open" value={open.length} accent="warn" />
          <StatCard label="Follow-up pending" value={discs.filter((d) => d.status === "follow_up_pending").length} accent="err" />
        </div>

        {/* Open protocols */}
        {open.length > 0 && (
          <section>
            <h2 className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-3">Open protocols ({open.length})</h2>
            <DiscTable rows={open} patientMap={patientMap} clinicId={clinicId} />
          </section>
        )}

        {/* Closed protocols */}
        {closed.length > 0 && (
          <section>
            <h2 className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-3">Closed ({closed.length})</h2>
            <DiscTable rows={closed} patientMap={patientMap} clinicId={clinicId} dimmed />
          </section>
        )}

        {discs.length === 0 && (
          <div className="bg-surface border border-bdr rounded-xl px-6 py-14 flex flex-col items-center gap-3 text-center">
            <XCircle className="w-10 h-10 text-t3" />
            <p className="text-[14px] font-semibold text-t2">No discontinuation protocols</p>
            <p className="text-[12px] text-t3 max-w-sm">
              Discontinuation protocols are created when a patient&apos;s treatment is stopped.
              They appear here with GP notification and follow-up SLA tracking.
            </p>
          </div>
        )}
      </div>
    );
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : "Failed to load discontinuations"} />;
  }
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: "warn" | "err" }) {
  return (
    <div className={`bg-surface border rounded-xl px-4 py-3 ${accent === "err" && value > 0 ? "border-err-bdr" : accent === "warn" && value > 0 ? "border-warn-bdr" : "border-bdr"}`}>
      <p className={`text-2xl font-bold tabular-nums ${accent === "err" && value > 0 ? "text-err" : accent === "warn" && value > 0 ? "text-warn" : "text-t1"}`}>{value}</p>
      <p className="text-[11px] text-t2 font-medium mt-0.5">{label}</p>
    </div>
  );
}

function DiscTable({ rows, patientMap, clinicId, dimmed }: {
  rows: DiscontinuationProtocol[];
  patientMap: Record<string, string>;
  clinicId: string;
  dimmed?: boolean;
}) {
  return (
    <div className={`bg-surface border border-bdr rounded-xl overflow-hidden ${dimmed ? "opacity-70" : ""}`}>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-bdr bg-page-bg">
            <th className="px-4 py-2.5 text-[11px] font-bold text-t3 uppercase tracking-wider">Patient</th>
            <th className="px-4 py-2.5 text-[11px] font-bold text-t3 uppercase tracking-wider">Reason</th>
            <th className="px-4 py-2.5 text-[11px] font-bold text-t3 uppercase tracking-wider">Status</th>
            <th className="px-4 py-2.5 text-[11px] font-bold text-t3 uppercase tracking-wider">GP notified</th>
            <th className="px-4 py-2.5 text-[11px] font-bold text-t3 uppercase tracking-wider">SLA follow-up</th>
            <th className="px-4 py-2.5 text-[11px] font-bold text-t3 uppercase tracking-wider">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-bdr">
          {rows.map((d) => {
            const cfg = STATUS_CONFIG[d.status];
            const slaDate = new Date(d.created_at);
            slaDate.setDate(slaDate.getDate() + d.sla_follow_up_days);
            const slaOverdue = d.status !== "closed" && !d.follow_up_call_at && new Date(slaDate) < new Date("2026-05-11");

            return (
              <tr key={d.id} className="hover:bg-page-bg transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/${clinicId}/patients/${d.patient_id}`} className="text-[13px] font-semibold text-brand hover:underline">
                    {patientMap[d.patient_id] ?? d.patient_id}
                  </Link>
                  <Link href={`/${clinicId}/discontinuations/${d.id}`} className="block text-[11px] text-t3 font-mono hover:text-brand transition-colors">{d.id}</Link>
                </td>
                <td className="px-4 py-3">
                  <p className="text-[12px] font-semibold text-t1">{REASON_LABELS[d.reason]}</p>
                  <p className="text-[11px] text-t3 line-clamp-1 max-w-xs">{d.reason_detail}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px] text-t2">
                  {d.gp_notified_at ? formatDateTime(d.gp_notified_at) : <span className="text-err font-semibold">Pending</span>}
                </td>
                <td className="px-4 py-3">
                  {d.follow_up_call_at ? (
                    <span className="text-[12px] text-ok font-semibold">Completed {formatDate(d.follow_up_call_at)}</span>
                  ) : (
                    <span className={`text-[12px] font-semibold ${slaOverdue ? "text-err" : "text-warn"}`}>
                      Due {formatDate(slaDate.toISOString())} {slaOverdue && "⚠ overdue"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[12px] text-t2">{formatDate(d.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
