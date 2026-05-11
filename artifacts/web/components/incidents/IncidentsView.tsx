"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Incident, Patient, Clinic, ClinicId } from "@/types";

type Filter = Incident["status"] | "all";

const SEV_COLORS: Record<string, string> = {
  mild: "bg-ok-bg text-ok border border-ok-bdr",
  moderate: "bg-warn-bg text-warn border border-warn-bdr",
  severe: "bg-err-bg text-err border border-err-bdr",
};

const TYPE_LABELS: Record<string, string> = {
  medication_error: "Medication error",
  adverse_event: "Adverse event",
  delayed_dispensing: "Delayed dispensing",
  wrong_dose: "Wrong dose",
  allergic_reaction: "Allergic reaction",
  near_miss: "Near miss",
  other: "Other",
};

interface Props {
  initialIncidents: Incident[];
  patients: Patient[];
  clinicId: ClinicId;
  clinic: Clinic;
}

export function IncidentsView({ initialIncidents, patients, clinicId }: Props) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<Filter>("all");

  const patientMap = Object.fromEntries(patients.map((p) => [p.id, p]));

  const filtered =
    activeFilter === "all"
      ? initialIncidents
      : initialIncidents.filter((i) => i.status === activeFilter);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "investigating", label: "Investigating" },
    { key: "on_hold", label: "On hold" },
    { key: "resolved", label: "Resolved" },
    { key: "closed", label: "Closed" },
  ];

  return (
    <div>
      <div className="px-6 py-2 flex items-center gap-1 border-b border-bdr bg-surface">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={cn(
              "px-3 py-1 text-[12px] font-medium rounded-md transition-colors",
              activeFilter === f.key
                ? "bg-brand text-white"
                : "text-t2 hover:bg-brand-light hover:text-brand"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-6 py-4">
        {filtered.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="No incidents found" description="Try adjusting the filter." />
        ) : (
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-page-bg hover:bg-page-bg border-bdr">
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">ID</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Type</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Patient</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Severity</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Flags</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Reported</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((incident) => {
                  const patient = incident.patient_id ? patientMap[incident.patient_id] : null;
                  return (
                    <TableRow
                      key={incident.id}
                      className={cn(
                        "cursor-pointer border-bdr transition-colors",
                        incident.severity === "severe" && incident.status === "open"
                          ? "bg-err-bg/30 hover:bg-err-bg/50"
                          : "hover:bg-brand-light/40"
                      )}
                      onClick={() => router.push(`/${clinicId}/incidents/${incident.id}`)}
                    >
                      <TableCell className="py-3">
                        <span className="font-mono text-[11px] font-bold text-t1">{incident.id}</span>
                      </TableCell>
                      <TableCell className="py-3 text-[12px] text-t1">
                        {TYPE_LABELS[incident.incident_type] ?? incident.incident_type}
                      </TableCell>
                      <TableCell className="py-3">
                        {patient ? (
                          <div className="text-[12px] font-medium text-t1">{patient.demographic.full_name}</div>
                        ) : (
                          <span className="text-[12px] text-t3 italic">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-px rounded-full whitespace-nowrap",
                          SEV_COLORS[incident.severity]
                        )}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
                          {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <StatusBadge value={incident.status} kind="incident" />
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex gap-1 flex-wrap">
                          {incident.yellow_card_required && !incident.yellow_card_submitted && (
                            <span className="text-[10px] font-bold px-1.5 py-px rounded bg-warn-bg text-warn border border-warn-bdr">YC pending</span>
                          )}
                          {incident.cqc_notification_required && !incident.cqc_notified_at && (
                            <span className="text-[10px] font-bold px-1.5 py-px rounded bg-err-bg text-err border border-err-bdr">CQC</span>
                          )}
                          {incident.sync_status !== "in_sync" && (
                            <span className="text-[10px] font-bold px-1.5 py-px rounded bg-warn-bg text-warn border border-warn-bdr">Sync</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-[12px] text-t2">{formatDate(incident.reported_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
