"use client";

/**
 * PatientFABSpeedDial — floating + button with per-role shortcuts.
 *
 * Opens a vertical speed-dial above the main FAB.
 * Actions are filtered by CURRENT_USER permissions.
 * Admin note action opens an inline modal.
 * Navigation actions use Next.js router.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, StickyNote, Flag, AlertTriangle, ClipboardPen, Package, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAdminNote } from "@/lib/api/mock";
import { useCurrentUser } from "@/lib/context";
import { MOCK_PATIENTS } from "@/lib/api/fixtures/patients.data";
import { MOCK_ORDERS } from "@/lib/api/fixtures/orders.data";
import { LogIncidentModal } from "@/components/incidents/LogIncidentModal";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { ClinicId, AdminNote } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  clinicId: ClinicId;
  patientId: string;
  latestOrderId: string | null;
}

const TAG_OPTIONS: { value: AdminNote["tag"]; label: string }[] = [
  { value: "handoff",   label: "Handoff"   },
  { value: "follow_up", label: "Follow-up" },
  { value: "context",   label: "Context"   },
  { value: "general",   label: "General"   },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function PatientFABSpeedDial({ clinicId, patientId, latestOrderId }: Props) {
  const CURRENT_USER = useCurrentUser();
  const router = useRouter();

  const [dialOpen,       setDialOpen]       = useState(false);
  const [adminNoteOpen,  setAdminNoteOpen]  = useState(false);
  const [incidentOpen,   setIncidentOpen]   = useState(false);
  const [body,           setBody]           = useState("");
  const [tag,            setTag]            = useState<AdminNote["tag"]>("general");
  const [saving,         setSaving]         = useState(false);
  const [toast,          setToast]          = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Permission gates ──────────────────────────────────────────────────────

  const canAdminNote = can(CURRENT_USER, "write", "admin_notes");
  const canNote      = can(CURRENT_USER, "write", "clinical_notes");
  const canFlag      = can(CURRENT_USER, "write", "clinical_flags");
  const canIncident  = can(CURRENT_USER, "write", "incidents");
  const canOrders    = can(CURRENT_USER, "read",  "orders");

  // ── Helpers ───────────────────────────────────────────────────────────────

  function go(path: string) {
    setDialOpen(false);
    router.push(path);
  }

  function flashToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function saveAdminNote() {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await createAdminNote(clinicId, { patient_id: patientId, body: body.trim(), tag });
      setBody("");
      setTag("general");
      setAdminNoteOpen(false);
      flashToast("Admin note saved", true);
    } catch (err) {
      flashToast(err instanceof Error ? err.message : "Failed to save note", false);
    } finally {
      setSaving(false);
    }
  }

  // ── Action definitions (bottom = first in array, rendered closest to FAB) ──

  interface Action {
    icon: React.ElementType;
    label: string;
    sublabel?: string;
    onClick: () => void;
    disabled?: boolean;
    iconColor: string;
  }

  const actions: Action[] = [
    // Shown at the top of the stack (furthest from FAB)
    ...(canOrders ? [{
      icon: Package,
      label: latestOrderId ? "Review order" : "No orders",
      sublabel: latestOrderId ? "Open latest order" : "No orders placed yet",
      onClick: latestOrderId
        ? () => go(`/${clinicId}/orders/${latestOrderId}`)
        : () => {},
      disabled: !latestOrderId,
      iconColor: "text-brand",
    }] : []),
    ...(canIncident ? [{
      icon: AlertTriangle,
      label: "Log incident",
      sublabel: "Record a patient safety event",
      onClick: () => { setDialOpen(false); setIncidentOpen(true); },
      iconColor: "text-err",
    }] : []),
    ...(canFlag ? [{
      icon: Flag,
      label: "Raise flag",
      sublabel: "Add a clinical flag via notes",
      onClick: () => go(`/${clinicId}/patients/${patientId}?tab=notes`),
      iconColor: "text-warn",
    }] : []),
    ...(canNote ? [{
      icon: ClipboardPen,
      label: "Add clinical note",
      sublabel: "Open the notes tab",
      onClick: () => go(`/${clinicId}/patients/${patientId}?tab=notes`),
      iconColor: "text-teal-600",
    }] : []),
    // Shown at the bottom (closest to FAB)
    ...(canAdminNote ? [{
      icon: StickyNote,
      label: "Add admin note",
      sublabel: "Admin and Owner only",
      onClick: () => { setDialOpen(false); setAdminNoteOpen(true); },
      iconColor: "text-[#7c3aed]",
    }] : []),
  ];

  // Reverse so the first item in array renders at the top
  const dialItems = [...actions].reverse();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg text-[13px] font-medium shadow-lg text-white transition-opacity",
          toast.ok ? "bg-ok" : "bg-err"
        )}>
          {toast.msg}
        </div>
      )}

      {/* Backdrop — click outside to close */}
      {dialOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setDialOpen(false)} />
      )}

      {/* Speed-dial */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">

        {/* Action items */}
        {dialOpen && dialItems.map((action, i) => (
          <div
            key={action.label}
            className="flex items-center gap-2.5"
          >
            {/* Label pill */}
            <div className="flex flex-col items-end">
              <span className="bg-surface border border-bdr rounded-lg px-3 py-1.5 text-[12px] font-semibold text-t1 shadow-sm whitespace-nowrap leading-tight">
                {action.label}
              </span>
              {action.sublabel && (
                <span className="text-[10px] text-t3 mr-1 mt-0.5 whitespace-nowrap">{action.sublabel}</span>
              )}
            </div>

            {/* Icon button */}
            <button
              onClick={action.disabled ? undefined : action.onClick}
              disabled={action.disabled}
              className={cn(
                "w-10 h-10 rounded-full border shadow-md flex items-center justify-center transition-all shrink-0",
                action.disabled
                  ? "bg-page-bg border-bdr text-t3 cursor-not-allowed opacity-50"
                  : "bg-surface border-bdr hover:bg-brand hover:border-brand hover:text-white active:scale-95"
              )}
              title={action.label}
            >
              <action.icon className={cn("w-4 h-4", action.disabled ? "" : action.iconColor, "group-hover:text-white")} />
            </button>
          </div>
        ))}

        {/* Main FAB */}
        <button
          onClick={() => setDialOpen((o) => !o)}
          className={cn(
            "w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 border-2",
            dialOpen
              ? "bg-surface border-bdr text-t1 rotate-45"
              : "bg-brand border-brand text-white"
          )}
          aria-label={dialOpen ? "Close shortcuts" : "Open shortcuts"}
          aria-expanded={dialOpen}
        >
          <Plus className="w-6 h-6 transition-transform" />
        </button>
      </div>

      {/* Admin note modal */}
      {adminNoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-surface border border-bdr rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-bdr">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-[#7c3aed]" />
                <span className="text-[14px] font-bold text-t1">Add admin note</span>
              </div>
              <button
                onClick={() => setAdminNoteOpen(false)}
                className="text-t3 hover:text-t1 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">Tag</label>
                <div className="relative">
                  <select
                    value={tag}
                    onChange={(e) => setTag(e.target.value as AdminNote["tag"])}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-[13px] border border-bdr rounded-lg bg-page-bg text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  >
                    {TAG_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">Note</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  placeholder="Enter admin note..."
                  className="w-full px-3 py-2 text-[13px] border border-bdr rounded-lg bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand resize-none leading-relaxed"
                />
                <p className="text-[10px] text-t3 mt-1">
                  Admin notes are visible to Admin and Owner roles only. Coaches cannot see these notes.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-bdr bg-page-bg rounded-b-xl">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdminNoteOpen(false)}
                disabled={saving}
                className="h-8 text-[12px]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveAdminNote}
                disabled={saving || !body.trim()}
                className="h-8 text-[12px]"
              >
                {saving ? "Saving..." : "Save note"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {incidentOpen && (() => {
        const prefilled = MOCK_PATIENTS.find((p) => p.clinic_id === clinicId && p.id === patientId);
        const patientOrders = MOCK_ORDERS.filter((o) => o.clinic_id === clinicId && o.patient_id === patientId);
        if (!prefilled) return null;
        return (
          <LogIncidentModal
            clinicId={clinicId}
            patients={[]}
            orders={patientOrders}
            prefilledPatient={prefilled}
            onClose={() => setIncidentOpen(false)}
            onSave={() => setIncidentOpen(false)}
          />
        );
      })()}
    </>
  );
}
