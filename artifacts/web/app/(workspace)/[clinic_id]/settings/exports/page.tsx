/**
 * Settings → Exports page — BLD-4.7 (Wave 3).
 *
 * AUD-04 clinical notes CSV export.
 * Admin / Owner only (enforced server-side in exportClinicalNotesAud04).
 *
 * Wave 3: UI-only export trigger that generates and downloads a CSV blob
 * in the browser (no server streaming required for mocked data).
 */

"use client";

import { useState } from "react";
import { Download, FileText, AlertTriangle, CheckCircle } from "lucide-react";
import { listClinicalNotes, CURRENT_USER, getClinicSync } from "@/lib/api/mock";
import { exportClinicalNotesAud04 } from "@/lib/exports/clinicalNotesAud04";
import type { ClinicId } from "@/types";
import { useParams } from "next/navigation";

export default function ExportsPage() {
  const params        = useParams<{ clinic_id: string }>();
  const clinicId      = params.clinic_id as ClinicId;

  const today         = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState("2026-01-01");
  const [toDate, setToDate]     = useState(today);
  const [status, setStatus]     = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const clinic = getClinicSync(clinicId);

  async function handleExport() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const notes = await listClinicalNotes(clinicId);
      const csv   = exportClinicalNotesAud04(notes, clinicId, fromDate, toDate, CURRENT_USER);

      // Browser-side download
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `AUD-04_${clinicId}_${fromDate}_to_${toDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setStatus("done");
      setTimeout(() => setStatus("idle"), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Export failed");
      setStatus("error");
    }
  }

  const canExport = CURRENT_USER.roles.some((r) => r === "Admin" || r === "Owner");

  return (
    <div className="px-6 py-5 max-w-2xl space-y-6">
      {/* AUD-04 export card */}
      <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
          <FileText className="w-3.5 h-3.5 text-brand" />
          <h2 className="text-[11px] font-bold text-t2 uppercase tracking-wider">
            AUD-04 — Clinical Notes Patient Outcomes Audit
          </h2>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-[13px] text-t2 leading-relaxed">
            Exports a CSV of all clinical notes for <strong>{clinic.config.clinic_name}</strong> within
            the selected date range. Used for the CQC AUD-04 Patient Outcomes audit trail.
          </p>

          {!canExport && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-warn-bg border border-warn-bdr rounded-lg text-[12px] text-warn">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Your role does not have permission to export clinical data.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-t2 mb-1">From date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                disabled={!canExport}
                className="w-full border border-bdr bg-page-bg rounded-md px-3 py-2 text-[13px] text-t1 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-t2 mb-1">To date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                disabled={!canExport}
                className="w-full border border-bdr bg-page-bg rounded-md px-3 py-2 text-[13px] text-t1 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              disabled={!canExport || status === "loading"}
              className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white bg-brand hover:bg-brand/90 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {status === "loading" ? "Generating…" : "Download CSV"}
            </button>

            {status === "done" && (
              <span className="flex items-center gap-1.5 text-[12px] text-ok font-semibold">
                <CheckCircle className="w-4 h-4" /> Downloaded
              </span>
            )}
            {status === "error" && (
              <span className="flex items-center gap-1.5 text-[12px] text-err">
                <AlertTriangle className="w-3.5 h-3.5" /> {errorMsg}
              </span>
            )}
          </div>

          <div className="text-[11px] text-t3 border-t border-bdr pt-3">
            <p className="font-semibold mb-1">CSV columns:</p>
            <p className="font-mono">note_id, patient_id, author, role, created_at, order_id, body_length, ai_drafted, has_edits</p>
          </div>
        </div>
      </div>
    </div>
  );
}
