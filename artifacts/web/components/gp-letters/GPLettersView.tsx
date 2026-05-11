"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GPLetter, Patient, Clinic, ClinicId } from "@/types";

type Filter = GPLetter["status"] | "all";

interface GPLettersViewProps {
  initialLetters: GPLetter[];
  patients: Patient[];
  clinicId: ClinicId;
  clinic: Clinic;
}

export function GPLettersView({ initialLetters, patients, clinicId }: GPLettersViewProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<Filter>("all");

  const patientMap = Object.fromEntries(patients.map((p) => [p.id, p]));

  const filtered =
    activeFilter === "all"
      ? initialLetters
      : initialLetters.filter((l) => l.status === activeFilter);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "sent", label: "Sent" },
    { key: "delivered", label: "Delivered" },
    { key: "bounced", label: "Bounced" },
  ];

  return (
    <div>
      <div className="px-6 py-2 flex items-center justify-between border-b border-bdr bg-surface">
        <div className="flex gap-1">
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
        <Link href={`/${clinicId}/gp-letters/new`}>
          <Button size="sm" className="h-7 text-[12px] gap-1">
            <Plus className="w-3.5 h-3.5" />
            New letter
          </Button>
        </Link>
      </div>

      <div className="px-6 py-4">
        {filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No letters found" description="Try adjusting the filter." />
        ) : (
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-page-bg hover:bg-page-bg border-bdr">
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Letter</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Patient</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Consent</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Created</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((letter) => {
                  const patient = patientMap[letter.patient_id];
                  return (
                    <TableRow
                      key={letter.id}
                      className="cursor-pointer border-bdr hover:bg-brand-light/40 transition-colors"
                      onClick={() => router.push(`/${clinicId}/gp-letters/${letter.id}`)}
                    >
                      <TableCell className="py-3">
                        <div className="font-mono text-[11px] font-bold text-t1">{letter.id}</div>
                        <div className="text-[11px] text-t2 mt-0.5 truncate max-w-[240px]">{letter.subject}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="text-[12px] font-medium text-t1">
                          {patient?.demographic.full_name ?? letter.patient_id}
                        </div>
                        <div className="text-[11px] text-t3">{letter.patient_id}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <StatusBadge value={letter.status} kind="gp_letter" />
                      </TableCell>
                      <TableCell className="py-3">
                        {letter.patient_consent_verified ? (
                          <span className="text-[11px] text-ok font-medium">Verified</span>
                        ) : (
                          <span className="text-[11px] text-err font-medium">Missing</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-[12px] text-t2">{formatDate(letter.created_at)}</TableCell>
                      <TableCell className="py-3 text-[12px] text-t2">
                        {letter.sent_at ? formatDateTime(letter.sent_at) : <span className="text-t3">—</span>}
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
