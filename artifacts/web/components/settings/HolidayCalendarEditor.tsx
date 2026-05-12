"use client";

/**
 * HolidayCalendarEditor — BLD-4.6.7 (Wave 4).
 *
 * Allows Owner/RM to add and remove holiday entries from the clinic's
 * holiday_calendar. Changes are reflected immediately in dispatchCalculator
 * and addWorkingHours (in-memory mock; backend persistence is post-launch).
 *
 * Permissions: write → settings (Owner/RM only).
 */

import { useState } from "react";
import { Calendar, Plus, Trash2, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/permissions";
import { CURRENT_USER } from "@/lib/api/mock";
import type { ClinicId } from "@/types";

interface HolidayEntry {
  date: string;   // YYYY-MM-DD
  name: string;
}

interface HolidayCalendarEditorProps {
  clinicId: ClinicId;
  initialHolidays: HolidayEntry[];
  onUpdate: (action: "add" | "remove", entry: HolidayEntry) => Promise<void>;
}

interface Toast { message: string; type: "ok" | "err" }

export function HolidayCalendarEditor({
  clinicId,
  initialHolidays,
  onUpdate,
}: HolidayCalendarEditorProps) {
  const [holidays, setHolidays]   = useState<HolidayEntry[]>(
    [...initialHolidays].sort((a, b) => a.date.localeCompare(b.date))
  );
  const [newDate, setNewDate]     = useState("");
  const [newName, setNewName]     = useState("");
  const [isAdding, setIsAdding]   = useState(false);
  const [removing, setRemoving]   = useState<string | null>(null);
  const [toast, setToast]         = useState<Toast | null>(null);

  const canEdit = can(CURRENT_USER, "write", "settings");

  function showToast(message: string, type: "ok" | "err") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleAdd() {
    if (!newDate || !newName.trim()) return;
    if (holidays.some((h) => h.date === newDate)) {
      showToast("A holiday already exists on this date.", "err");
      return;
    }
    setIsAdding(true);
    try {
      const entry: HolidayEntry = { date: newDate, name: newName.trim() };
      await onUpdate("add", entry);
      setHolidays((prev) =>
        [...prev, entry].sort((a, b) => a.date.localeCompare(b.date))
      );
      setNewDate("");
      setNewName("");
      showToast(`Added: ${entry.name} (${entry.date})`, "ok");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to add holiday.", "err");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemove(entry: HolidayEntry) {
    setRemoving(entry.date);
    try {
      await onUpdate("remove", entry);
      setHolidays((prev) => prev.filter((h) => h.date !== entry.date));
      showToast(`Removed: ${entry.name}`, "ok");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove holiday.", "err");
    } finally {
      setRemoving(null);
    }
  }

  function formatDisplayDate(dateStr: string) {
    try {
      return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-GB", {
        weekday: "short", day: "numeric", month: "long", year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium ${
          toast.type === "ok"
            ? "bg-ok-bg border border-ok-bdr text-ok"
            : "bg-err-bg border border-err-bdr text-err"
        }`}>
          {toast.type === "ok"
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Add form */}
      {canEdit && (
        <div className="bg-surface border border-bdr rounded-lg p-4">
          <h3 className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-3">
            Add holiday
          </h3>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-40 text-[13px]"
              min="2026-01-01"
              max="2027-12-31"
            />
            <Input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Holiday name (e.g. Christmas Day)"
              className="flex-1 text-[13px]"
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newDate || !newName.trim() || isAdding}
              className="gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              {isAdding ? "Adding…" : "Add"}
            </Button>
          </div>
          <p className="text-[10px] text-t3 mt-2">
            Changes take effect immediately for dispatch calculations and working-hours SLAs. Backend persistence is post-launch.
          </p>
        </div>
      )}

      {/* Holiday list */}
      <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
          <Calendar className="w-3.5 h-3.5 text-brand" />
          <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider">
            Holidays ({holidays.length})
          </h3>
        </div>

        {holidays.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px] text-t3 italic">
            No holidays configured. UK public holidays are imported by default.
          </div>
        ) : (
          <ul className="divide-y divide-bdr">
            {holidays.map((h) => (
              <li key={h.date} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-t3 w-24 shrink-0">{h.date}</span>
                  <div>
                    <span className="text-[13px] font-medium text-t1">{h.name}</span>
                    <span className="ml-2 text-[11px] text-t3">{formatDisplayDate(h.date)}</span>
                  </div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleRemove(h)}
                    disabled={removing === h.date}
                    className="text-t3 hover:text-err transition-colors p-1 rounded hover:bg-err-bg"
                    title="Remove holiday"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
