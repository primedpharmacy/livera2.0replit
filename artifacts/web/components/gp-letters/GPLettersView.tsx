"use client";

/**
 * GPLettersView — BLD-7.5 / BLD-7.7 (Wave 5).
 *
 * BLD-7.7: Full DEC-22 lifecycle display — all 5 states shown with distinct
 * styling. Lifecycle filter replaces legacy status filter. Cancelled rows
 * styled muted. Cancel action (min 20 chars reason) available for
 * non-terminal, non-sent letters. Prescriber/Admin can cancel.
 *
 * BLD-7.5: "New letter" button opens GPLetterComposeModal inline (no
 * navigation to /new). The /new page still exists as a fallback.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, Search, Ban, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { GPLetterComposeModal } from "@/components/gp-letters/GPLetterComposeModal";
import { formatDate, formatDateTime } from "@/lib/format";
import { cancelGPLetter, CURRENT_USER } from "@/lib/api/mock";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GPLetter, Patient, Clinic, ClinicId, GPLetterTemplate } from "@/types";

type LifecycleFilter = GPLetter["lifecycle_status"] | "all";

interface GPLettersViewProps {
  initialLetters: GPLetter[];
  patients:        Patient[];
  templates:       GPLetterTemplate[];
  clinicId:        ClinicId;
  clinic:          Clinic;
}

interface Toast { message: string; type: "ok" | "err" }

const LIFECYCLE_LABEL: Record<GPLetter["lifecycle_status"], string> = {
  awaiting_consent: "Awaiting consent",
  owed:             "Owed",
  sent:             "Sent",
  cancelled:        "Cancelled",
  ad_hoc:           "Ad-hoc",
};

export function GPLettersView({ initialLetters, patients, templates, clinicId, clinic }: GPLettersViewProps) {
  const router = useRouter();

  const [letters, setLetters]               = useState<GPLetter[]>(initialLetters);
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>("all");
  const [consentFilter, setConsentFilter]   = useState<"all" | "verified" | "missing">("all");
  const [search, setSearch]                 = useState("");
  const [composeOpen, setComposeOpen]       = useState(false);
  const [toast, setToast]                   = useState<Toast | null>(null);

  // Cancel modal state
  const [cancelTarget, setCancelTarget]     = useState<GPLetter | null>(null);
  const [cancelReason, setCancelReason]     = useState("");
  const [cancelling, setCancelling]         = useState(false);

  const patientMap = Object.fromEntries(patients.map((p) => [p.id, p]));
  const canWrite   = can(CURRENT_USER, "write", "gp_letters");

  function showToast(message: string, type: Toast["type"]) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  // KPI strip counts from live letters state
  const awaiting  = letters.filter((l) => l.lifecycle_status === "awaiting_consent").length;
  const owed      = letters.filter((l) => l.lifecycle_status === "owed").length;
  const sent      = letters.filter((l) => l.lifecycle_status === "sent").length;
  const cancelled = letters.filter((l) => l.lifecycle_status === "cancelled").length;
  const noConsent = letters.filter((l) => !l.patient_consent_verified).length;

  const kpis = [
    { label: "Awaiting consent", value: awaiting,  alert: awaiting > 0 },
    { label: "Owed",             value: owed,       alert: owed > 0 },
    { label: "Sent",             value: sent,       alert: false },
    { label: "Cancelled",        value: cancelled,  alert: false },
    { label: "Consent missing",  value: noConsent,  alert: noConsent > 0 },
  ];

  const lifecycleFilters: { key: LifecycleFilter; label: string }[] = [
    { key: "all",              label: "All" },
    { key: "owed",             label: "Owed" },
    { key: "awaiting_consent", label: "Awaiting consent" },
    { key: "ad_hoc",           label: "Ad-hoc" },
    { key: "sent",             label: "Sent" },
    { key: "cancelled",        label: "Cancelled" },
  ];

  const filtered = letters.filter((l) => {
    const matchLifecycle = lifecycleFilter === "all" || l.lifecycle_status === lifecycleFilter;
    const matchConsent   =
      consentFilter === "all" ||
      (consentFilter === "verified" && l.patient_consent_verified) ||
      (consentFilter === "missing" && !l.patient_consent_verified);
    const q            = search.toLowerCase();
    const patient      = patientMap[l.patient_id];
    const matchSearch  = !q ||
      l.id.toLowerCase().includes(q) ||
      l.subject.toLowerCase().includes(q) ||
      (patient?.demographic.full_name.toLowerCase().includes(q) ?? false);
    return matchLifecycle && matchConsent && matchSearch;
  });

  // Cancel action
  function openCancelModal(letter: GPLetter) {
    setCancelTarget(letter);
    setCancelReason("");
  }

  async function handleCancel() {
    if (!cancelTarget || cancelReason.trim().length < 20) return;
    setCancelling(true);
    try {
      const updated = await cancelGPLetter(clinicId, cancelTarget.id, cancelReason.trim());
      setLetters((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      showToast("Letter cancelled", "ok");
      setCancelTarget(null);
      setCancelReason("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to cancel", "err");
    } finally {
      setCancelling(false);
    }
  }

  const isCancellable = (l: GPLetter) =>
    l.lifecycle_status !== "cancelled" && l.lifecycle_status !== "sent";

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-[13px] font-medium shadow-lg text-white",
          toast.type === "ok" ? "bg-ok" : "bg-err"
        )}>
          {toast.message}
        </div>
      )}

      {/* BLD-7.5 — Compose modal */}
      {composeOpen && (
        <GPLetterComposeModal
          clinicId={clinicId}
          patients={patients}
          templates={templates}
          clinic={clinic}
          onClose={() => setComposeOpen(false)}
        />
      )}

      {/* Cancel reason modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-surface border border-bdr rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-bdr">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-err" />
                <span className="text-[14px] font-bold text-t1">Cancel letter</span>
              </div>
              <button onClick={() => setCancelTarget(null)} className="text-t3 hover:text-t1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-start gap-2 bg-warn-bg border border-warn-bdr rounded-lg px-3 py-2.5 text-[12px] text-warn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                This action is permanent and cannot be reversed. Letter {cancelTarget.id} will be marked as cancelled.
              </div>
              <div>
                <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">
                  Reason for cancellation (min. 20 characters)
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-[13px] border border-bdr rounded-lg bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand resize-none"
                  placeholder="Document the reason for cancelling this letter…"
                />
                <p className={cn(
                  "text-[10px] mt-1",
                  cancelReason.trim().length >= 20 ? "text-ok" : "text-t3"
                )}>
                  {cancelReason.trim().length}/20 min characters
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-bdr bg-page-bg rounded-b-xl">
              <Button variant="outline" size="sm" onClick={() => setCancelTarget(null)} disabled={cancelling} className="h-8 text-[12px]">
                Keep letter
              </Button>
              <Button
                size="sm"
                onClick={handleCancel}
                disabled={cancelling || cancelReason.trim().length < 20}
                className="h-8 text-[12px] bg-err hover:bg-err/90 focus-visible:ring-err"
              >
                {cancelling ? "Cancelling…" : "Confirm cancel"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* KPI strip — DEC-22 lifecycle counts */}
      <div className="grid grid-cols-5 gap-px bg-bdr border-b border-bdr">
        {kpis.map((k) => (
          <div key={k.label} className={cn("bg-surface px-5 py-3.5 flex flex-col gap-1", k.alert && "bg-err-bg")}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-t2">{k.label}</span>
            <span className={cn("text-[22px] font-bold leading-none tabular-nums", k.alert ? "text-err" : "text-t1")}>
              {k.value}
            </span>
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

        {/* Lifecycle filter chips */}
        <div className="flex items-center gap-1 flex-wrap">
          {lifecycleFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setLifecycleFilter(f.key)}
              className={cn(
                "px-3 py-1 text-[11px] font-medium rounded-md transition-colors",
                lifecycleFilter === f.key ? "bg-brand text-white" : "text-t2 hover:bg-brand-light hover:text-brand"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Consent filter */}
        <div className="flex items-center gap-1">
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
              {v === "all" ? "All consent" : v === "verified" ? "Verified" : "Missing"}
            </button>
          ))}
        </div>

        {/* BLD-7.5 — compose modal trigger */}
        {canWrite && (
          <div className="ml-auto">
            <Button size="sm" onClick={() => setComposeOpen(true)} className="h-7 text-[12px] gap-1">
              <Plus className="w-3.5 h-3.5" />
              New letter
            </Button>
          </div>
        )}
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
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Lifecycle</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Consent</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Created</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5">Sent</TableHead>
                  {canWrite && (
                    <TableHead className="text-[10px] uppercase tracking-wider font-bold text-t3 py-2.5 w-10" />
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((letter) => {
                  const patient    = patientMap[letter.patient_id];
                  const isCancelled = letter.lifecycle_status === "cancelled";
                  const canCancel  = canWrite && isCancellable(letter);

                  return (
                    <TableRow
                      key={letter.id}
                      className={cn(
                        "border-bdr transition-colors",
                        isCancelled
                          ? "opacity-50 bg-page-bg cursor-default"
                          : "cursor-pointer hover:bg-brand-light/40"
                      )}
                      onClick={() => !isCancelled && router.push(`/${clinicId}/gp-letters/${letter.id}`)}
                    >
                      <TableCell className="py-3">
                        <div className={cn("font-mono text-[11px] font-bold text-t1", isCancelled && "line-through text-t3")}>
                          {letter.id}
                        </div>
                        <div className="text-[11px] text-t2 mt-0.5 truncate max-w-[220px]">{letter.subject}</div>
                        {isCancelled && letter.cancel_reason && (
                          <div className="text-[10px] text-err mt-0.5 truncate max-w-[220px]" title={letter.cancel_reason}>
                            Reason: {letter.cancel_reason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="text-[12px] font-medium text-t1">
                          {patient?.demographic.full_name ?? letter.patient_id}
                        </div>
                        <div className="text-[11px] text-t3">{letter.patient_id}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className={cn(
                          "inline-flex items-center px-2 py-px text-[9px] font-bold rounded border",
                          letter.lifecycle_status === "sent"             && "bg-ok-bg border-ok-bdr text-ok",
                          letter.lifecycle_status === "owed"             && "bg-warn-bg border-warn-bdr text-warn",
                          letter.lifecycle_status === "awaiting_consent" && "bg-err-bg border-err-bdr text-err",
                          letter.lifecycle_status === "cancelled"        && "bg-page-bg border-bdr text-t3",
                          letter.lifecycle_status === "ad_hoc"           && "bg-info-bg border-info-bdr text-info",
                        )}>
                          {LIFECYCLE_LABEL[letter.lifecycle_status]}
                        </span>
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
                      {canWrite && (
                        <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                          {canCancel && (
                            <button
                              onClick={() => openCancelModal(letter)}
                              className="p-1.5 rounded text-t3 hover:text-err hover:bg-err-bg transition-colors"
                              title="Cancel letter"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </TableCell>
                      )}
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
