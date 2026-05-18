"use client";

/**
 * AdminNoteFABModal — BLD-4.5.2 (Wave 5).
 *
 * Floating action button (bottom-right of the Notes tab) that opens a modal
 * for creating an admin note. Visible only to Admin / Owner (Layer 1 gate).
 *
 * Layer 1 (UI gate): button hidden if !can(CURRENT_USER, 'write', 'admin_notes').
 * Layer 2 (server gate): enforced in createAdminNote fixture.
 * Layer 3 (audit log):   [AUDIT] entry written by createAdminNote fixture.
 *
 * On success: calls onCreated() so the parent can re-fetch / append the note.
 */

import { useState } from "react";
import { StickyNote, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAdminNote } from "@/lib/api/mock";
import { useCurrentUser } from "@/lib/context";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { ClinicId, AdminNote } from "@/types";

interface Props {
  clinicId:  ClinicId;
  patientId: string;
  onCreated?: (note: AdminNote) => void;
}

const TAG_OPTIONS: { value: AdminNote["tag"]; label: string }[] = [
  { value: "handoff",   label: "Handoff" },
  { value: "follow_up", label: "Follow-up" },
  { value: "context",   label: "Context" },
  { value: "general",   label: "General" },
];

interface Toast { message: string; type: "ok" | "err" }

export function AdminNoteFABModal({ clinicId, patientId, onCreated = () => {} }: Props) {
  const CURRENT_USER = useCurrentUser();
  const [open, setOpen]       = useState(false);
  const [body, setBody]       = useState("");
  const [tag, setTag]         = useState<AdminNote["tag"]>("general");
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<Toast | null>(null);

  const canWrite = can(CURRENT_USER, "write", "admin_notes");
  if (!canWrite) return null;

  function showToast(message: string, type: Toast["type"]) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSave() {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const note = await createAdminNote(clinicId, { patient_id: patientId, body: body.trim(), tag });
      onCreated(note);
      setBody("");
      setTag("general");
      setOpen(false);
      showToast("Admin note saved", "ok");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save note", "err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg text-[13px] font-medium shadow-lg text-white",
          toast.type === "ok" ? "bg-ok" : "bg-err"
        )}>
          {toast.message}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-brand hover:bg-brand-dark text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        title="Add admin note"
        aria-label="Add admin note"
      >
        <StickyNote className="w-5 h-5" />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-surface border border-bdr rounded-xl shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-bdr">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-brand" />
                <span className="text-[14px] font-bold text-t1">Add admin note</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-t3 hover:text-t1 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Tag */}
              <div>
                <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">
                  Tag
                </label>
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

              {/* Body */}
              <div>
                <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">
                  Note
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  placeholder="Enter admin note…"
                  className="w-full px-3 py-2 text-[13px] border border-bdr rounded-lg bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand resize-none leading-relaxed"
                />
                <p className="text-[10px] text-t3 mt-1">
                  Admin notes are visible to Admin and Owner roles only. Coaches cannot see these notes.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-bdr bg-page-bg rounded-b-xl">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="h-8 text-[12px]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !body.trim()}
                className="h-8 text-[12px]"
              >
                {saving ? "Saving…" : "Save note"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
