/**
 * Settings → SLAs page — BLD-3.4 (Wave 3).
 *
 * Displays the SLA threshold editor (SlaThresholdEditor) for Owner/Admin.
 * Also lists the clinic's SLA breach history (open + acknowledged).
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { SlaThresholdEditor } from "@/components/settings/SlaThresholdEditor";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { getClinic, listSlaBreaches } from "@/lib/api/mock";
import { CURRENT_USER } from "@/lib/api/constants";
import type { ClinicId, SlaBreach } from "@/types";

type SlaSettingsPageProps = { params: Promise<{ clinic_id: string }> };

export default async function SlaSettingsPage({ params }: SlaSettingsPageProps) {
  const { clinic_id } = await params;
  return (
    <Suspense key={clinic_id} fallback={<LoadingState.Detail />}>
      <SlaContent clinicId={clinic_id as ClinicId} />
    </Suspense>
  );
}

async function SlaContent({ clinicId }: { clinicId: ClinicId }) {
  if (!CURRENT_USER.roles.some((r) => r === 'Admin' || r === 'Owner')) {
    redirect(`/${clinicId}/dashboard`);
  }

  try {
    const [clinic, breaches] = await Promise.all([
      getClinic(clinicId),
      listSlaBreaches(clinicId),
    ]);

    const openBreaches = breaches.filter((b) => !b.acknowledged_at);
    const ackBreaches  = breaches.filter((b) =>  b.acknowledged_at);

    return (
      <div className="px-6 py-5 max-w-3xl space-y-6">
        {/* Threshold editor */}
        <SlaThresholdEditor config={clinic.config} clinicId={clinicId} actorId={CURRENT_USER.id} />

        {/* Open breaches table */}
        {openBreaches.length > 0 && (
          <BreachTable title="Open SLA breaches" breaches={openBreaches} />
        )}

        {/* Acknowledged breaches table */}
        {ackBreaches.length > 0 && (
          <BreachTable title="Acknowledged breaches" breaches={ackBreaches} dimmed />
        )}

        {breaches.length === 0 && (
          <div className="flex flex-col items-center py-12 text-t3">
            <Clock className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-[13px]">No SLA breaches recorded.</p>
          </div>
        )}
      </div>
    );
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : "Failed to load SLA settings"} />;
  }
}

function BreachTable({
  title,
  breaches,
  dimmed = false,
}: {
  title: string;
  breaches: SlaBreach[];
  dimmed?: boolean;
}) {
  return (
    <div className={`bg-surface border border-bdr rounded-lg overflow-hidden ${dimmed ? "opacity-70" : ""}`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
        <Clock className="w-3.5 h-3.5 text-brand" />
        <h2 className="text-[11px] font-bold text-t2 uppercase tracking-wider">{title}</h2>
        <span className="ml-auto text-[10px] font-semibold tabular-nums text-t3">{breaches.length}</span>
      </div>
      <div className="divide-y divide-bdr">
        {breaches.map((b) => (
          <div key={b.id} className="px-4 py-3 grid grid-cols-4 gap-3 items-center text-[12px]">
            <div>
              <p className="font-mono text-t3 text-[10px]">{b.id}</p>
              <p className="font-semibold text-t1 mt-0.5 capitalize">{b.entity_type.replace(/_/g, " ")}</p>
              <p className="font-mono text-brand text-[11px]">{b.entity_id}</p>
            </div>
            <div>
              <p className="text-t3">SLA type</p>
              <p className="text-t1 font-medium">{b.sla_type.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-t3">Detected</p>
              <p className="text-t1 font-medium">{formatDateTime(b.breach_detected_at)}</p>
              {b.acknowledged_at && (
                <p className="text-ok text-[11px] mt-0.5">Ack: {formatDateTime(b.acknowledged_at)}</p>
              )}
            </div>
            <div className="flex items-center justify-end">
              <StatusBadge
                value={b.acknowledged_at ? "acknowledged" : "open"}
                kind="breach"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
