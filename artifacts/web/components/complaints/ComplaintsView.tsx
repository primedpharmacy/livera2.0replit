"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
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
import type { Complaint, Patient, Clinic, ClinicId } from "@/types";

type Filter = Complaint["status"] | "all";

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

// Derive SLA ack due date at render: received_at + 3 working days (PV §8).
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

export function ComplaintsView({ initialComplaints, patients, clinicId }: Props) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<Filter>("all");

  const patientMap = Object.fromEntries(patients.map((p) => [p.id, p]));

  const filtered =
    activeFilter === "all"
      ? initialComplaints
      : initialComplaints.filter((c) => c.status === activeFilter);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "received", label: "Received" },
    { key: "acknowledged", label: "Acknowledged" },
    { key: "investigating", label: "Investigating" },
    { key: "resolved", label: "Resolved" },
    { key: "closed", label: "Closed" },
  ];

  const now = new Date();

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
          <EmptyState icon={Megaphone} title="No complaints found" description="Try adjusting the filter." />
        ) : (
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-page-bg hover:bg-page-bg border-bdr">
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Complaint</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Complainant</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Severity</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Ack due</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Category</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((complaint) => {
                  const patient = complaint.patient_id ? patientMap[complaint.patient_id] : null;
                  // SLA ack due derived at render from received_at + 3 working days (BLD-9.1)
                  const ackDue = addWorkingDays(complaint.received_at, 3);
                  const ackOverdue = !complaint.acknowledged_at && now > ackDue;
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
                      <TableCell className="py-3 text-[12px] text-t2 capitalize">
                        {complaint.category}
                      </TableCell>
                      <TableCell className="py-3 text-[12px] text-t2">{formatDate(complaint.received_at)}</TableCell>
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
