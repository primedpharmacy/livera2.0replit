"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Search } from "lucide-react";
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

const NOW = new Date("2026-05-12T08:00:00Z");

type Filter = Complaint["status"] | "all";
type SevFilter = Complaint["severity"] | "all";

const SEV_COLORS: Record<string, string> = {
  low:    "bg-ok-bg text-ok border border-ok-bdr",
  medium: "bg-warn-bg text-warn border border-warn-bdr",
  high:   "bg-err-bg text-err border border-err-bdr",
};

interface Props {
  initialComplaints: Complaint[];
  patients: Patient[];
  clinicId: ClinicId;
  clinic: Clinic;
}

export function ComplaintsView({ initialComplaints, patients, clinicId }: Props) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [sevFilter, setSevFilter] = useState<SevFilter>("all");
  const [search, setSearch] = useState("");

  const patientMap = Object.fromEntries(patients.map((p) => [p.id, p]));

  const openComplaints    = initialComplaints.filter((c) => !["resolved", "closed"].includes(c.status));
  const overdueAck        = initialComplaints.filter((c) => !c.acknowledgement_sent_at && new Date(c.acknowledgement_due_at) < NOW);
  const highSeverity      = initialComplaints.filter((c) => c.severity === "high");
  const mondaySynced      = initialComplaints.filter((c) => c.sync_status === "in_sync");

  const kpis = [
    { label: "Open",           value: openComplaints.length, sub: "active cases",        alert: openComplaints.length > 0 },
    { label: "Overdue ack",    value: overdueAck.length,     sub: "acknowledgement SLA",  alert: overdueAck.length > 0 },
    { label: "High severity",  value: highSeverity.length,   sub: "cases",                alert: highSeverity.length > 0 },
    { label: "Monday synced",  value: mondaySynced.length,   sub: `of ${initialComplaints.length} total`, alert: false },
    { label: "Total",          value: initialComplaints.length, sub: "all time",          alert: false },
  ];

  const statusFilters: { key: Filter; label: string }[] = [
    { key: "all",            label: "All" },
    { key: "received",       label: "Received" },
    { key: "acknowledged",   label: "Acknowledged" },
    { key: "investigating",  label: "Investigating" },
    { key: "resolved",       label: "Resolved" },
    { key: "closed",         label: "Closed" },
  ];

  const sevFilters: { key: SevFilter; label: string }[] = [
    { key: "all",    label: "All severity" },
    { key: "high",   label: "High" },
    { key: "medium", label: "Medium" },
    { key: "low",    label: "Low" },
  ];

  const filtered = initialComplaints.filter((c) => {
    const matchStatus = activeFilter === "all" || c.status === activeFilter;
    const matchSev    = sevFilter === "all" || c.severity === sevFilter;
    const q           = search.toLowerCase();
    const patient     = c.patient_id ? patientMap[c.patient_id] : null;
    const matchSearch = !q ||
      c.id.toLowerCase().includes(q) ||
      c.subject.toLowerCase().includes(q) ||
      (patient?.demographic.full_name.toLowerCase().includes(q) ?? false);
    return matchStatus && matchSev && matchSearch;
  });

  return (
    <div>
      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-px bg-bdr border-b border-bdr">
        {kpis.map((k) => (
          <div key={k.label} className={cn("bg-surface px-5 py-3.5 flex flex-col gap-1", k.alert && "bg-err-bg")}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-t2">{k.label}</span>
            <span className={cn("text-[22px] font-bold leading-none tabular-nums", k.alert ? "text-err" : "text-t1")}>
              {k.value}
            </span>
            <span className={cn("text-[10px] font-semibold", k.alert ? "text-err" : "text-t3")}>{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="px-6 py-2.5 flex items-center gap-3 border-b border-bdr bg-surface flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t3" />
          <input
            type="text"
            placeholder="Search complaints…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-[12px] border border-bdr rounded-md bg-page-bg focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-t1 placeholder:text-t3 w-52"
          />
        </div>
        <div className="flex items-center gap-1">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={cn(
                "px-3 py-1 text-[12px] font-medium rounded-md transition-colors",
                activeFilter === f.key ? "bg-brand text-white" : "text-t2 hover:bg-brand-light hover:text-brand"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {sevFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setSevFilter(f.key)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors",
                sevFilter === f.key
                  ? "bg-t1 text-white border-t1"
                  : "text-t2 border-bdr hover:border-brand hover:text-brand"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
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
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Patient</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Severity</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Ack due</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Source</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((complaint) => {
                  const patient    = complaint.patient_id ? patientMap[complaint.patient_id] : null;
                  const ackDue     = new Date(complaint.acknowledgement_due_at);
                  const ackOverdue = !complaint.acknowledgement_sent_at && NOW > ackDue;
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
                        <div className="text-[11px] text-t2 mt-0.5 truncate max-w-[200px]">{complaint.subject}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        {patient ? (
                          <div className="text-[12px] font-medium text-t1">{patient.demographic.full_name}</div>
                        ) : (
                          <span className="text-[12px] text-t3 italic">Anonymous</span>
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
                          {formatDate(complaint.acknowledgement_due_at)}
                          {ackOverdue && " ⚠"}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-[12px] text-t2 capitalize">
                        {complaint.source.replace("_", " ")}
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
