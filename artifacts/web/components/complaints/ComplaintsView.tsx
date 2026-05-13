"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Complaint, ComplaintSeverity, Patient, Clinic, ClinicId } from "@/types";

type StatusFilter = Complaint["status"] | "all";
type SeverityFilter = ComplaintSeverity | "all";

// BLD-9.1: severity vocab migrated from low/medium/high → informal/formal/serious
const SEV_COLORS: Record<string, string> = {
  informal: "bg-ok-bg text-ok border border-ok-bdr",
  formal:   "bg-warn-bg text-warn border border-warn-bdr",
  serious:  "bg-err-bg text-err border border-err-bdr",
};

interface Props {
  initialComplaints: Complaint[];
  patients: Patient[];
  clinicId: ClinicId;
  clinic: Clinic;
}

// Derive SLA ack due date at render: received_at + clinic_config.default_slas.complaint_ack_wd
// Due dates are NOT stored on the record (BLD-9.1 schema decision).
function addWorkingDays(startIso: string, wdCount: number): Date {
  const d = new Date(startIso);
  let added = 0;
  while (added < wdCount) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

const MONDAY_BASE = "https://primedpharmacy-company.monday.com/boards";

export function ComplaintsView({ initialComplaints, patients, clinicId, clinic }: Props) {
  const router = useRouter();
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");
  const [activeSeverity, setActiveSeverity] = useState<SeverityFilter>("all");

  const patientMap = Object.fromEntries(patients.map((p) => [p.id, p]));

  // BLD-9.2: read SLA from clinic config — never hardcoded
  const ackWd = clinic.config.default_slas.complaint_ack_wd;

  const filtered = initialComplaints
    .filter((c) => activeStatus   === "all" || c.status   === activeStatus)
    .filter((c) => activeSeverity === "all" || c.severity === activeSeverity);

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: "all",           label: "All" },
    { key: "received",      label: "Received" },
    { key: "acknowledged",  label: "Acknowledged" },
    { key: "investigating", label: "Investigating" },
    { key: "resolved",      label: "Resolved" },
    { key: "closed",        label: "Closed" },
  ];

  const severityFilters: { key: SeverityFilter; label: string }[] = [
    { key: "all",      label: "All severities" },
    { key: "informal", label: "Informal" },
    { key: "formal",   label: "Formal" },
    { key: "serious",  label: "Serious" },
  ];

  const now = new Date();

  return (
    <div>
      {/* Status filter tabs */}
      <div className="px-6 py-2 flex items-center gap-1 border-b border-bdr bg-surface">
        {statusFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveStatus(f.key)}
            className={cn(
              "px-3 py-1 text-[12px] font-medium rounded-md transition-colors",
              activeStatus === f.key
                ? "bg-brand text-white"
                : "text-t2 hover:bg-brand-light hover:text-brand"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Severity filter row */}
      <div className="px-6 py-1.5 flex items-center gap-1 border-b border-bdr bg-page-bg">
        {severityFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveSeverity(f.key)}
            className={cn(
              "px-2.5 py-0.5 text-[11px] font-medium rounded-md transition-colors",
              activeSeverity === f.key
                ? "bg-brand text-white"
                : "text-t3 hover:bg-brand-light hover:text-brand"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-6 py-4">
        {filtered.length === 0 ? (
          <EmptyState icon={Megaphone} title="No complaints found" description="Try adjusting the filters." />
        ) : (
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-page-bg hover:bg-page-bg border-bdr">
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Complaint</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Complainant</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Severity</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Ack due ({ackWd}wd)</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Received</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Last update</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Monday</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((complaint) => {
                  const patient = complaint.patient_id ? patientMap[complaint.patient_id] : null;
                  // SLA ack due derived at render from clinic config (BLD-9.2)
                  const ackDue = addWorkingDays(complaint.received_at, ackWd);
                  const ackOverdue = !complaint.acknowledged_at && now > ackDue;
                  const mondayUrl = complaint.monday_item_id
                    ? `${MONDAY_BASE}/${complaint.monday_board_id}/pulses/${complaint.monday_item_id}`
                    : null;
                  return (
                    <TableRow
                      key={complaint.id}
                      className={cn(
                        "cursor-pointer border-bdr transition-colors",
                        ackOverdue ? "bg-err-bg/40 hover:bg-err-bg/60" : "hover:bg-brand-light/40"
                      )}
                      onClick={() => router.push(`/${clinicId}/complaints/${complaint.id}`)}
                    >
                      <TableCell className="py-3">
                        <div className="font-mono text-[11px] font-bold text-t1">{complaint.id}</div>
                        <div className="text-[11px] text-t2 mt-0.5 truncate max-w-[200px] capitalize">{complaint.category}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="text-[12px] font-medium text-t1">{complaint.complainant_name}</div>
                        {patient && (
                          <div className="text-[11px] text-t3 mt-0.5">{patient.demographic.full_name}</div>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-px rounded-full whitespace-nowrap",
                          SEV_COLORS[complaint.severity]
                        )}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
                          {complaint.severity.charAt(0).toUpperCase() + complaint.severity.slice(1)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <StatusBadge value={complaint.status} kind="complaint" />
                      </TableCell>
                      <TableCell className="py-3">
                        <span className={cn("text-[12px]", ackOverdue ? "text-err font-semibold" : "text-t2")}>
                          {formatDate(ackDue.toISOString())}
                          {ackOverdue && " ⚠"}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-[12px] text-t2">
                        {formatDate(complaint.received_at)}
                      </TableCell>
                      <TableCell className="py-3 text-[12px] text-t3">
                        {complaint.updated_at ? formatRelativeTime(complaint.updated_at) : "—"}
                      </TableCell>
                      <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                        {mondayUrl ? (
                          <a
                            href={mondayUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-brand hover:text-brand-dark font-medium"
                            title="View in Monday.com"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View
                          </a>
                        ) : (
                          <span className="text-[11px] text-t3 italic">Pending sync</span>
                        )}
                      </TableCell>
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
