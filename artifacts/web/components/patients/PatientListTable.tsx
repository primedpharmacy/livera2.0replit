"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatAge, formatBMI } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowUpDown, CheckCircle2, XCircle } from "lucide-react";
import type { Patient } from "@/types";

type SortKey = "name" | "status" | "updated_at";
type SortDir = "asc" | "desc";

interface PatientListTableProps {
  patients: Patient[];
  clinicId: string;
}

export function PatientListTable({ patients, clinicId }: PatientListTableProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...patients].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.demographic.full_name.localeCompare(b.demographic.full_name);
      } else if (sortKey === "status") {
        cmp = a.status.localeCompare(b.status);
      } else {
        cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [patients, sortKey, sortDir]);

  function SortHeader({ label, sortable }: { label: string; sortable?: SortKey }) {
    const active = sortable && sortKey === sortable;
    return (
      <TableHead
        className={cn(
          "text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5",
          sortable && "cursor-pointer select-none hover:text-t1"
        )}
        onClick={sortable ? () => toggleSort(sortable) : undefined}
      >
        <span className="flex items-center gap-1">
          {label}
          {sortable && (
            <ArrowUpDown
              className={cn(
                "w-3 h-3 transition-colors",
                active ? "text-brand" : "text-t3"
              )}
            />
          )}
        </span>
      </TableHead>
    );
  }

  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-page-bg hover:bg-page-bg border-bdr">
            <SortHeader label="Patient" sortable="name" />
            <SortHeader label="Status" sortable="status" />
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">DOB / Age</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Latest BMI</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">GP Linked</TableHead>
            <SortHeader label="Last Activity" sortable="updated_at" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((patient) => {
            const initials = patient.demographic.full_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const age = formatAge(patient.demographic.dob);
            const hasB4Flag = patient.flags.some((f) => f.code === "B4");

            return (
              <TableRow
                key={patient.id}
                className="cursor-pointer hover:bg-brand-light border-bdr transition-colors"
                onClick={() => router.push(`/${clinicId}/patients/${patient.id}`)}
              >
                <TableCell className="py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-mid to-brand flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-semibold text-t1 leading-tight">
                          {patient.demographic.full_name}
                        </span>
                        {hasB4Flag && (
                          <span className="text-[9px] font-bold bg-warn-bg text-warn border border-warn-bdr px-1.5 py-px rounded">
                            B4
                          </span>
                        )}
                        {patient.vip && (
                          <span className="text-[9px] font-bold bg-coach-bg text-coach border border-coach-bdr px-1.5 py-px rounded">
                            VIP
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-t3 font-mono mt-0.5">{patient.id}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <StatusBadge value={patient.status} kind="patient" />
                </TableCell>
                <TableCell className="py-3 text-[12.5px] text-t2 tabular-nums">
                  <div>{formatDate(patient.demographic.dob)}</div>
                  <div className="text-[11px] text-t3">{age} yrs</div>
                </TableCell>
                <TableCell className="py-3 text-[12.5px] text-t1 font-medium tabular-nums">
                  {formatBMI(patient.latest.bmi)}
                </TableCell>
                <TableCell className="py-3">
                  {patient.gp ? (
                    <span className="flex items-center gap-1 text-ok text-[12px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="font-medium">Yes</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-t3 text-[12px]">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>No</span>
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-3 text-[12px] text-t2 tabular-nums">
                  {new Date(patient.updated_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
