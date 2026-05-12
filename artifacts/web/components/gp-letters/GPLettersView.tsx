"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, FileText, Search } from "lucide-react";
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
  const [consentFilter, setConsentFilter] = useState<"all" | "verified" | "missing">("all");
  const [search, setSearch] = useState("");

  const patientMap = Object.fromEntries(patients.map((p) => [p.id, p]));

  const draft     = initialLetters.filter((l) => l.status === "draft").length;
  const sent      = initialLetters.filter((l) => l.status === "sent").length;
  const delivered = initialLetters.filter((l) => l.status === "delivered").length;
  const bounced   = initialLetters.filter((l) => l.status === "bounced").length;
  const noConsent = initialLetters.filter((l) => !l.patient_consent_verified).length;

  const kpis = [
    { label: "Draft",            value: draft,     sub: "awaiting send",    alert: false },
    { label: "Sent",             value: sent,      sub: "in transit",       alert: false },
    { label: "Delivered",        value: delivered, sub: "confirmed",        alert: false },
    { label: "Bounced",          value: bounced,   sub: "delivery failed",  alert: bounced > 0 },
    { label: "Consent missing",  value: noConsent, sub: "need consent",     alert: noConsent > 0 },
  ];

  const filters: { key: Filter; label: string }[] = [
    { key: "all",       label: "All" },
    { key: "draft",     label: "Draft" },
    { key: "sent",      label: "Sent" },
    { key: "delivered", label: "Delivered" },
    { key: "bounced",   label: "Bounced" },
  ];

  const filtered = initialLetters.filter((l) => {
    const matchStatus  = activeFilter === "all" || l.status === activeFilter;
    const matchConsent =
      consentFilter === "all" ||
      (consentFilter === "verified" && l.patient_consent_verified) ||
      (consentFilter === "missing" && !l.patient_consent_verified);
    const q           = search.toLowerCase();
    const patient     = patientMap[l.patient_id];
    const matchSearch = !q ||
      l.id.toLowerCase().includes(q) ||
      l.subject.toLowerCase().includes(q) ||
      (patient?.demographic.full_name.toLowerCase().includes(q) ?? false);
    return matchStatus && matchConsent && matchSearch;
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
            placeholder="Search letters…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-[12px] border border-bdr rounded-md bg-page-bg focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-t1 placeholder:text-t3 w-48"
          />
        </div>
        <div className="flex items-center gap-1">
          {filters.map((f) => (
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
        <div className="flex items-center gap-1 ml-2">
          {(["all", "verified", "missing"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setConsentFilter(v)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors",
                consentFilter === v
                  ? "bg-t1 text-white border-t1"
                  : "text-t2 border-bdr hover:border-brand hover:text-brand"
              )}
            >
              {v === "all" ? "All consent" : v === "verified" ? "Verified" : "Missing consent"}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Link href={`/${clinicId}/gp-letters/new`}>
            <Button size="sm" className="h-7 text-[12px] gap-1">
              <Plus className="w-3.5 h-3.5" />
              New letter
            </Button>
          </Link>
        </div>
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
