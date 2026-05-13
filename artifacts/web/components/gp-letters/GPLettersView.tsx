"use client";

/**
 * GPLettersView -- BLD-7.5 / BLD-7.7 (Wave 5) + gap-fix (prototype alignment).
 *
 * UI redesign: prototype-aligned filter tabs with coloured dots, TREATMENT +
 * TRIGGERED + ACTION columns. All functional code preserved: cancel modal,
 * compose modal, toast, canWrite permission gate.
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, Search, Ban, X, AlertCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { GPLetterComposeModal } from "@/components/gp-letters/GPLetterComposeModal";
import { formatDate, formatDateTime } from "@/lib/format";
import { cancelGPLetter, CURRENT_USER } from "@/lib/api/mock";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { GPLetter, Patient, Clinic, ClinicId, GPLetterTemplate } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────
type LifecycleFilter = GPLetter["lifecycle_status"] | "all";
interface Toast { message: string; type: "ok" | "err" }

// ── Filter tab config ─────────────────────────────────────────────────────────
const FILTER_TABS: {
  key: LifecycleFilter;
  label: string;
  dot: string;
  activeBg: string;
  activeText: string;
}[] = [
  { key: "owed",             label: "Owed",             dot: "bg-warn",       activeBg: "bg-warn-bg border-warn-bdr",    activeText: "text-warn"      },
  { key: "awaiting_consent", label: "Awaiting consent", dot: "bg-[#94a3b8]",  activeBg: "bg-[#f1f5f9] border-[#cbd5e1]", activeText: "text-[#475569]" },
  { key: "sent",             label: "Sent",             dot: "bg-ok",         activeBg: "bg-ok-bg border-ok-bdr",        activeText: "text-ok"        },
  { key: "cancelled",        label: "Cancelled",        dot: "bg-[#334155]",  activeBg: "bg-[#f1f5f9] border-[#94a3b8]", activeText: "text-[#334155]" },
  { key: "ad_hoc",           label: "Ad-hoc",           dot: "bg-brand",      activeBg: "bg-brand-light border-brand/30",activeText: "text-brand"     },
  { key: "all",              label: "All",              dot: "",              activeBg: "bg-t1 border-t1",               activeText: "text-white"     },
];

// ── Lifecycle badge style ─────────────────────────────────────────────────────
const LIFECYCLE_CLS: Record<GPLetter["lifecycle_status"], string> = {
  owed:             "bg-warn-bg text-warn border-warn-bdr",
  awaiting_consent: "bg-err-bg text-err border-err-bdr",
  sent:             "bg-ok-bg text-ok border-ok-bdr",
  cancelled:        "bg-page-bg text-t3 border-bdr",
  ad_hoc:           "bg-brand-light text-brand border-brand/30",
};
const LIFECYCLE_LABEL: Record<GPLetter["lifecycle_status"], string> = {
  awaiting_consent: "Awaiting consent",
  owed:             "Owed",
  sent:             "Sent",
  cancelled:        "Cancelled",
  ad_hoc:           "Ad-hoc",
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface GPLettersViewProps {
  initialLetters: GPLetter[];
  patients:       Patient[];
  templates:      GPLetterTemplate[];
  clinicId:       ClinicId;
  clinic:         Clinic;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function GPLettersView({
  initialLetters, patients, templates, clinicId, clinic,
}: GPLettersViewProps) {
  const router = useRouter();

  const [letters,         setLetters]         = useState<GPLetter[]>(initialLetters);
  const [lifecycleFilter, setLifecycleFilter]  = useState<LifecycleFilter>("owed");
  const [search,          setSearch]           = useState("");
  const [composeOpen,     setComposeOpen]      = useState(false);
  const [toast,           setToast]            = useState<Toast | null>(null);

  const [cancelTarget, setCancelTarget] = useState<GPLetter | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling,   setCancelling]   = useState(false);

  const patientMap  = useMemo(() => Object.fromEntries(patients.map((p) => [p.id, p])), [patients]);
  const templateMap = useMemo(() => Object.fromEntries(templates.map((t) => [t.id, t])), [templates]);
  const canWrite    = can(CURRENT_USER, "write", "gp_letters");

  function showToast(message: string, type: Toast["type"]) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── KPI strip ────────────────────────────────────────────────────────────
  const kpi = useMemo(() => ({
    awaiting:  letters.filter((l) => l.lifecycle_status === "awaiting_consent").length,
    owed:      letters.filter((l) => l.lifecycle_status === "owed").length,
    sent:      letters.filter((l) => l.lifecycle_status === "sent").length,
    cancelled: letters.filter((l) => l.lifecycle_status === "cancelled").length,
    noConsent: letters.filter((l) => !l.patient_consent_verified).length,
  }), [letters]);

  // ── Tab counts ────────────────────────────────────────────────────────────
  const tabCounts = useMemo((): Record<LifecycleFilter, number> => ({
    all:              letters.length,
    owed:             letters.filter((l) => l.lifecycle_status === "owed").length,
    awaiting_consent: letters.filter((l) => l.lifecycle_status === "awaiting_consent").length,
    sent:             letters.filter((l) => l.lifecycle_status === "sent").length,
    cancelled:        letters.filter((l) => l.lifecycle_status === "cancelled").length,
    ad_hoc:           letters.filter((l) => l.lifecycle_status === "ad_hoc").length,
  }), [letters]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return letters.filter((l) => {
      if (lifecycleFilter !== "all" && l.lifecycle_status !== lifecycleFilter) return false;
      if (search.trim()) {
        const q       = search.toLowerCase();
        const patient = patientMap[l.patient_id];
        if (
          !l.id.toLowerCase().includes(q) &&
          !l.subject.toLowerCase().includes(q) &&
          !(patient?.demographic.full_name.toLowerCase().includes(q) ?? false)
        ) return false;
      }
      return true;
    });
  }, [letters, lifecycleFilter, search, patientMap]);

  // ── Cancel ────────────────────────────────────────────────────────────────
  function openCancelModal(e: React.MouseEvent, letter: GPLetter) {
    e.stopPropagation();
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

  function isCancellable(l: GPLetter) {
    return l.lifecycle_status !== "cancelled" && l.lifecycle_status !== "sent";
  }

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

      {/* Compose modal */}
      {composeOpen && (
        <GPLetterComposeModal
          clinicId={clinicId}
          patients={patients}
          templates={templates}
          clinic={clinic}
          onClose={() => setComposeOpen(false)}
        />
      )}

      {/* Cancel modal */}
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
                This action is permanent. Letter {cancelTarget.id} will be marked as cancelled.
              </div>
              <div>
                <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">
                  Reason (min. 20 characters)
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-[13px] border border-bdr rounded-lg bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand resize-none"
                  placeholder="Document the reason for cancelling this letter..."
                />
                <p className={cn("text-[10px] mt-1", cancelReason.trim().length >= 20 ? "text-ok" : "text-t3")}>
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
                {cancelling ? "Cancelling..." : "Confirm cancel"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Compact KPI strip ─────────────────────────────────────────────── */}
      <div className="px-6 py-2.5 border-b border-bdr bg-surface flex items-center gap-8">
        {[
          { label: "Awaiting consent", value: kpi.awaiting, alert: kpi.awaiting > 0 },
          { label: "Owed",             value: kpi.owed,     alert: kpi.owed > 0     },
          { label: "Sent",             value: kpi.sent,     alert: false             },
          { label: "Cancelled",        value: kpi.cancelled,alert: false             },
          { label: "Consent missing",  value: kpi.noConsent,alert: kpi.noConsent > 0 },
        ].map((k) => (
          <div key={k.label} className="flex items-center gap-2">
            <span className={cn("text-[20px] font-bold tabular-nums leading-none", k.alert ? "text-err" : "text-t1")}>
              {k.value}
            </span>
            <span className="text-[11px] text-t2">{k.label}</span>
          </div>
        ))}
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="px-6 py-2 border-b border-bdr bg-surface flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t3" />
          <input
            type="text"
            placeholder="Search patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-[12px] border border-bdr rounded-md bg-page-bg focus:outline-none focus:border-brand text-t1 placeholder:text-t3 w-44"
          />
        </div>

        {/* Dot-tabs */}
        <div className="flex items-center gap-0.5 flex-1">
          {FILTER_TABS.map((tab) => {
            const active = lifecycleFilter === tab.key;
            const count  = tabCounts[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setLifecycleFilter(tab.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-semibold rounded-full border transition-colors",
                  active
                    ? cn(tab.activeBg, tab.activeText)
                    : "border-transparent text-t2 hover:bg-page-bg"
                )}
              >
                {tab.dot && (
                  <span className={cn("w-2 h-2 rounded-full shrink-0", tab.dot, active && "opacity-70")} />
                )}
                {tab.label}
                {tab.key !== "all" && (
                  <span className={cn("text-[10px] font-bold tabular-nums", active ? "opacity-70" : "opacity-40")}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => router.push(`/${clinicId}/settings/gp-letter-templates`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md border border-bdr bg-surface text-t1 hover:border-brand hover:text-brand transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Manage templates
          </button>
          {canWrite && (
            <Button size="sm" onClick={() => setComposeOpen(true)} className="h-8 text-[12px] gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              New ad-hoc letter
            </Button>
          )}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4">
        {filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No letters found" description="Try adjusting the filter." />
        ) : (
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[215px_1fr_145px_230px_165px] px-4 py-2.5 border-b border-bdr bg-page-bg">
              {["Patient", "Treatment", "Status", "Triggered", "Action"].map((h) => (
                <span key={h} className="text-[10px] font-bold uppercase tracking-wider text-t3">{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-bdr">
              {filtered.map((letter) => {
                const patient     = patientMap[letter.patient_id];
                const template    = templateMap[letter.template_id];
                const isCancelled = letter.lifecycle_status === "cancelled";
                const canCancel   = canWrite && isCancellable(letter);

                const treatmentLabel = template?.name ?? letter.subject;
                const consentDate    = formatDate(letter.created_at);
                const consentSource  = letter.auto_triggered ? "Registration" : "Manual";

                const triggeredText = letter.anchor_order_id
                  ? `Order ${letter.anchor_order_id} approved`
                  : letter.auto_triggered
                    ? "Auto-triggered"
                    : "Manual compose";

                return (
                  <div
                    key={letter.id}
                    onClick={() => !isCancelled && router.push(`/${clinicId}/gp-letters/${letter.id}`)}
                    className={cn(
                      "grid grid-cols-[215px_1fr_145px_230px_165px] px-4 py-3 transition-colors",
                      isCancelled
                        ? "opacity-50 bg-page-bg cursor-default"
                        : "cursor-pointer hover:bg-brand-light/40"
                    )}
                  >
                    {/* PATIENT */}
                    <div className="flex items-center gap-2.5 pr-2">
                      <InitialsAvatar name={patient?.demographic.full_name ?? letter.patient_id} size={32} />
                      <div className="min-w-0">
                        <div className={cn(
                          "text-[12.5px] font-semibold text-t1 leading-tight truncate",
                          isCancelled && "line-through text-t3"
                        )}>
                          {patient?.demographic.full_name ?? letter.patient_id}
                        </div>
                        <div className="text-[10px] font-mono text-t3 mt-0.5">{letter.patient_id}</div>
                      </div>
                    </div>

                    {/* TREATMENT */}
                    <div className="pr-4">
                      <div className="text-[12.5px] font-medium text-t1 leading-tight">
                        {treatmentLabel}
                      </div>
                      <div className="text-[10.5px] text-t3 mt-0.5">
                        Consent: {consentDate} &middot; {consentSource}
                      </div>
                      {isCancelled && letter.cancel_reason && (
                        <div className="text-[10px] text-err mt-1 truncate max-w-[260px]" title={letter.cancel_reason}>
                          Reason: {letter.cancel_reason}
                        </div>
                      )}
                    </div>

                    {/* STATUS */}
                    <div className="flex items-center">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold rounded border whitespace-nowrap",
                        LIFECYCLE_CLS[letter.lifecycle_status]
                      )}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
                        {LIFECYCLE_LABEL[letter.lifecycle_status]}
                      </span>
                    </div>

                    {/* TRIGGERED */}
                    <div className="pr-3">
                      <div className="text-[12px] text-t1 leading-tight">{triggeredText}</div>
                      <div className="text-[10px] text-t3 mt-0.5 tabular-nums">
                        {formatDateTime(letter.created_at)}
                      </div>
                    </div>

                    {/* ACTION */}
                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {letter.lifecycle_status === "sent" ? (
                        <button
                          onClick={() => router.push(`/${clinicId}/gp-letters/${letter.id}`)}
                          className="text-[12px] font-semibold text-brand hover:underline"
                        >
                          View &rarr;
                        </button>
                      ) : !isCancelled ? (
                        <>
                          <button
                            onClick={() => setComposeOpen(true)}
                            className="inline-flex items-center px-3 py-1.5 text-[12px] font-semibold rounded-md bg-brand text-white hover:bg-brand/90 transition-colors whitespace-nowrap"
                          >
                            Compose &rarr;
                          </button>
                          {canCancel && (
                            <button
                              onClick={(e) => openCancelModal(e, letter)}
                              className="text-[12px] text-t3 hover:text-err transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Initials avatar ───────────────────────────────────────────────────────────
function InitialsAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  const COLORS = [
    "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
    "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
  ];
  const color = COLORS[name.charCodeAt(0) % COLORS.length];

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}
