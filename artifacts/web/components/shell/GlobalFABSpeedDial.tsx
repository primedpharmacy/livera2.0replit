"use client";

/**
 * GlobalFABSpeedDial -- workspace-level floating action button.
 *
 * Visible on every workspace page EXCEPT patient detail pages, which have
 * their own PatientFABSpeedDial that covers patient-scoped actions.
 *
 * 4 actions (top = furthest from button):
 *   1. New task         -- inline quick-create modal
 *   2. Log incident     -- navigate to /incidents
 *   3. Log complaint    -- navigate to /complaints
 *   4. Log call         -- navigate to /welcome-calls
 */

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Plus, X, CheckSquare, AlertTriangle, Megaphone, Phone, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTask, CURRENT_USER } from "@/lib/api/mock";
import { MOCK_PATIENTS } from "@/lib/api/fixtures/patients";
import { MOCK_ORDERS } from "@/lib/api/fixtures/orders";
import { LogIncidentModal } from "@/components/incidents/LogIncidentModal";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { ClinicId, TaskPriority } from "@/types";

interface Props { clinicId: string }

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; colour: string }[] = [
  { value: "high", label: "High",   colour: "text-err"  },
  { value: "med",  label: "Medium", colour: "text-warn" },
  { value: "low",  label: "Low",    colour: "text-t2"   },
];

export function GlobalFABSpeedDial({ clinicId }: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  // Suppress on patient detail pages -- those have PatientFABSpeedDial
  const isPatientDetail = /\/patients\/[^/]+/.test(pathname);
  if (isPatientDetail) return null;

  return <FABContent clinicId={clinicId as ClinicId} router={router} />;
}

// Split into inner component so hooks run unconditionally
function FABContent({
  clinicId,
  router,
}: {
  clinicId: ClinicId;
  router: ReturnType<typeof useRouter>;
}) {
  const [dialOpen,    setDialOpen]    = useState(false);
  const [taskOpen,    setTaskOpen]    = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [title,       setTitle]       = useState("");
  const [priority,    setPriority]    = useState<TaskPriority>("med");
  const [dueDate,     setDueDate]     = useState("");
  const [saving,      setSaving]      = useState(false);
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  const canWriteTask      = can(CURRENT_USER, "write", "tasks");
  const canWriteIncident  = can(CURRENT_USER, "write", "incidents");
  const canWriteComplaint = can(CURRENT_USER, "write", "complaints");

  function go(path: string) {
    setDialOpen(false);
    router.push(path);
  }

  function openTaskModal() {
    setDialOpen(false);
    setTitle("");
    setPriority("med");
    setDueDate("");
    setTaskOpen(true);
  }

  function flashToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleCreateTask() {
    if (!title.trim() || !dueDate) return;
    setSaving(true);
    try {
      await createTask(clinicId, {
        title:    title.trim(),
        priority,
        due_date: dueDate,
      });
      setTaskOpen(false);
      flashToast("Task created", true);
    } catch (err) {
      flashToast(err instanceof Error ? err.message : "Failed to create task", false);
    } finally {
      setSaving(false);
    }
  }

  // Actions — top of dial is first in the array (reversed before render)
  const actions = [
    ...(canWriteTask ? [{
      icon:      CheckSquare,
      label:     "New task",
      sublabel:  "Create a follow-up or action item",
      iconColor: "text-teal-600",
      onClick:   openTaskModal,
    }] : []),
    ...(canWriteIncident ? [{
      icon:      AlertTriangle,
      label:     "Log incident",
      sublabel:  "Record a patient safety event",
      iconColor: "text-err",
      onClick:   () => { setDialOpen(false); setIncidentOpen(true); },
    }] : []),
    ...(canWriteComplaint ? [{
      icon:      Megaphone,
      label:     "Log complaint",
      sublabel:  "Open the complaints register",
      iconColor: "text-warn",
      onClick:   () => go(`/${clinicId}/complaints`),
    }] : []),
    {
      icon:      Phone,
      label:     "Log call",
      sublabel:  "Record an outbound welcome call",
      iconColor: "text-brand",
      onClick:   () => go(`/${clinicId}/welcome-calls`),
    },
  ];

  // Render closest-to-FAB first (last item in array)
  const dialItems = [...actions].reverse();

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg text-[13px] font-medium shadow-lg text-white",
          toast.ok ? "bg-ok" : "bg-err"
        )}>
          {toast.msg}
        </div>
      )}

      {/* Backdrop */}
      {dialOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setDialOpen(false)} />
      )}

      {/* Speed-dial */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {dialOpen && dialItems.map((action) => (
          <div key={action.label} className="flex items-center gap-2.5">
            {/* Label pill */}
            <div className="flex flex-col items-end">
              <span className="bg-surface border border-bdr rounded-lg px-3 py-1.5 text-[12px] font-semibold text-t1 shadow-sm whitespace-nowrap leading-tight">
                {action.label}
              </span>
              <span className="text-[10px] text-t3 mr-1 mt-0.5 whitespace-nowrap">
                {action.sublabel}
              </span>
            </div>
            {/* Icon button */}
            <button
              onClick={action.onClick}
              className="w-10 h-10 rounded-full border border-bdr bg-surface shadow-md flex items-center justify-center hover:bg-brand hover:border-brand hover:text-white active:scale-95 transition-all shrink-0"
              title={action.label}
            >
              <action.icon className={cn("w-4 h-4", action.iconColor)} />
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

      {/* New task modal */}
      {taskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-surface border border-bdr rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-bdr">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-teal-600" />
                <span className="text-[14px] font-bold text-t1">New task</span>
              </div>
              <button
                onClick={() => setTaskOpen(false)}
                className="text-t3 hover:text-t1 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">
                  Title <span className="text-err">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  autoFocus
                  className="w-full px-3 py-2 text-[13px] border border-bdr rounded-lg bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              {/* Priority + Due date — side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">
                    Priority
                  </label>
                  <div className="relative">
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as TaskPriority)}
                      className="w-full appearance-none pl-3 pr-8 py-2 text-[13px] border border-bdr rounded-lg bg-page-bg text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    >
                      {PRIORITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">
                    Due date <span className="text-err">*</span>
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min="2026-05-11"
                    className="w-full px-3 py-2 text-[13px] border border-bdr rounded-lg bg-page-bg text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              {/* Priority indicator */}
              <div className="flex items-center gap-2">
                {PRIORITY_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setPriority(o.value)}
                    className={cn(
                      "flex-1 py-1.5 text-[11px] font-bold rounded-md border transition-colors",
                      priority === o.value
                        ? cn("border-current bg-current/10", o.colour)
                        : "border-bdr text-t3 hover:border-bdr"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-bdr bg-page-bg rounded-b-xl">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTaskOpen(false)}
                disabled={saving}
                className="h-8 text-[12px]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateTask}
                disabled={saving || !title.trim() || !dueDate}
                className="h-8 text-[12px]"
              >
                {saving ? "Creating..." : "Create task"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {incidentOpen && (
        <LogIncidentModal
          clinicId={clinicId}
          patients={MOCK_PATIENTS}
          orders={MOCK_ORDERS}
          onClose={() => setIncidentOpen(false)}
          onSave={() => setIncidentOpen(false)}
        />
      )}
    </>
  );
}
