"use client";

/**
 * RecentNotesCard — BLD-4.3 (Wave 3).
 *
 * Compact card showing the 3 most-recent clinical notes for a patient.
 * Injected into OrderDetailClient (Notes tab) and patient profile.
 * Coach role: hidden (clinical notes are not visible to coaches per DEC-05).
 */

import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { USERS_REGISTRY } from "@/lib/api/mock";
import type { ClinicId, ClinicalNote } from "@/types";

interface RecentNotesCardProps {
  notes: ClinicalNote[];
  clinicId: ClinicId;
  patientId: string;
  maxItems?: number;
}

const AUTHOR_ROLE_COLORS: Record<ClinicalNote["author_role"], string> = {
  Prescriber: "bg-ok-bg text-ok border-ok-bdr",
  Admin:      "bg-info-bg text-info border-info-bdr",
};

export function RecentNotesCard({
  notes,
  clinicId,
  patientId,
  maxItems = 3,
}: RecentNotesCardProps) {
  const sorted  = [...notes].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const visible = sorted.slice(0, maxItems);

  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-bdr bg-page-bg">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-brand" />
          <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider">
            Recent clinical notes
          </h3>
        </div>
        <span className="text-[10px] text-t3 font-semibold tabular-nums">
          {sorted.length} total
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-t3">
          No clinical notes yet.
        </div>
      ) : (
        <div className="divide-y divide-bdr">
          {visible.map((note) => {
            const reverserName = note.reversed_by_user_id
              ? (USERS_REGISTRY[note.reversed_by_user_id]?.full_name ?? note.reversed_by_user_id)
              : null;
            return (
            <div key={note.id} className="px-4 py-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono text-t3">{note.id}</span>
                <span className={`text-[9px] font-bold px-1.5 py-px rounded border ${AUTHOR_ROLE_COLORS[note.author_role]}`}>
                  {note.author_role}
                </span>
                {note.approval_gate_for_order_id && (
                  <span className="text-[9px] font-bold px-1.5 py-px rounded border bg-warn-bg text-warn border-warn-bdr">
                    Approval note
                  </span>
                )}
                {note.reversed_at && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-px rounded border bg-err-bg text-err border-err-bdr"
                    title={`Reversed by ${reverserName ?? "unknown"} · ${formatDateTime(note.reversed_at)}`}
                  >
                    Reversed
                  </span>
                )}
                {note.edit_history.length > 0 && (
                  <span className="text-[9px] text-t3 ml-auto">
                    edited {note.edit_history.length}×
                  </span>
                )}
                <span className="text-[10px] text-t3 ml-auto">{formatDate(note.created_at)}</span>
              </div>
              <p
                className={`text-[12px] leading-relaxed line-clamp-2 ${
                  note.reversed_at ? "text-t3 line-through" : "text-t1"
                }`}
              >
                {note.body}
              </p>
              {note.reversed_at && (
                <p className="text-[10px] text-err">
                  Reversed by {reverserName ?? "unknown"} · {formatDateTime(note.reversed_at)}
                </p>
              )}
              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {note.tags.map((tag) => (
                    <span key={tag} className="text-[9px] px-1.5 py-px rounded bg-page-bg border border-bdr text-t3">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {sorted.length > maxItems && (
        <Link
          href={`/${clinicId}/patients/${patientId}?tab=notes`}
          className="flex items-center justify-center gap-1 w-full py-2.5 text-[12px] font-semibold text-brand bg-page-bg hover:bg-brand hover:text-white border-t border-bdr transition-colors"
        >
          View all {sorted.length} notes <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
