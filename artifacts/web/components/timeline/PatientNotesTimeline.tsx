"use client";

/**
 * PatientNotesTimeline — BLD-4.3, BLD-4.6 (Wave 3).
 *
 * Full unified timeline for a patient's Notes tab.
 * Renders TimelineEntry[] from aggregateTimeline().
 * Filter controls: type filter + date range + author (BLD-4.6).
 *
 * Click-to-edit (BLD-4.5): Prescriber/Admin clicking a clinical_note entry
 *   opens ClinicalNoteEditor in edit mode inline. Coach/Owner sees read-only expand.
 *
 * Role visibility (enforced in aggregateTimeline, reflected here):
 *   Coach → only coaching_log + order_event entries shown.
 *   All others → all entry types.
 */

import { useState, useMemo } from "react";
import { Clock, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { aggregateTimeline } from "@/lib/timeline/aggregateTimeline";
import { ClinicalNoteEditor } from "@/components/clinical-notes/ClinicalNoteEditor";
import type { TimelineEntryType } from "@/lib/timeline/types";
import type { ClinicId, ClinicalNote, CoachingLog, Order, GPLetter, AdminNote, User } from "@/types";

interface PatientNotesTimelineProps {
  clinicId:      ClinicId;
  clinicalNotes: ClinicalNote[];
  coachingLogs:  CoachingLog[];
  orders:        Order[];
  gpLetters:     GPLetter[];
  adminNotes:    AdminNote[];  // BLD-4.5.3 — hidden from Coach via aggregateTimeline
  actor:         User;
  minChars:      number;
  userNames?:    Record<string, string>;
}

const TYPE_LABELS: Record<TimelineEntryType, string> = {
  clinical_note: "Clinical notes",
  coaching_log:  "Coaching logs",
  order_event:   "Orders",
  gp_letter:     "GP letters",
  admin_note:    "Admin notes",  // BLD-4.5.3
};

const BADGE_CLASSES: Record<string, string> = {
  green:   "bg-ok-bg border-ok-bdr text-ok",
  purple:  "bg-coach-bg border-coach-bdr text-coach",
  blue:    "bg-info-bg border-info-bdr text-info",
  neutral: "bg-page-bg border-bdr text-t2",
};

const TYPE_DOT: Record<string, string> = {
  green:   "bg-ok",
  purple:  "bg-coach",
  blue:    "bg-info",
  neutral: "bg-t3",
};

export function PatientNotesTimeline({
  clinicId,
  clinicalNotes,
  coachingLogs,
  orders,
  gpLetters,
  adminNotes,
  actor,
  minChars,
  userNames,
}: PatientNotesTimelineProps) {
  const [typeFilter, setTypeFilter] = useState<TimelineEntryType[]>([]);
  const [fromDate, setFromDate]     = useState("");
  const [toDate, setToDate]         = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes]           = useState<ClinicalNote[]>(clinicalNotes);

  const canEdit = actor.roles.some((r) => r === "Prescriber" || r === "Admin");

  const entries = useMemo(
    () =>
      aggregateTimeline(
        { clinicalNotes: notes, coachingLogs, orders, gpLetters, adminNotes, clinicId, actor, userNames },
        {
          type:      typeFilter.length > 0 ? typeFilter : undefined,
          from_date: fromDate || undefined,
          to_date:   toDate   || undefined,
        },
      ),
    [clinicId, notes, coachingLogs, orders, gpLetters, adminNotes, actor, userNames, typeFilter, fromDate, toDate],
  );

  // Unique authors from all entries (before author filter) for the dropdown
  const allAuthors = useMemo(() => {
    const set = new Set(entries.map((e) => e.author_label).filter(Boolean));
    return Array.from(set).sort();
  }, [entries]);

  const filteredEntries = useMemo(
    () => (!authorFilter ? entries : entries.filter((e) => e.author_label === authorFilter)),
    [entries, authorFilter],
  );

  function toggleType(t: TimelineEntryType) {
    setTypeFilter((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  function handleNoteClick(entryId: string) {
    if (canEdit) {
      setEditingNoteId((prev) => (prev === entryId ? null : entryId));
      setExpandedId(null);
    } else {
      setExpandedId((prev) => (prev === entryId ? null : entryId));
      setEditingNoteId(null);
    }
  }

  const isCoach = actor.roles.includes("Coach") && !actor.roles.some((r) => r === "Prescriber" || r === "Admin" || r === "Owner");
  const availableTypes: TimelineEntryType[] = isCoach
    ? ["coaching_log", "order_event"]
    : ["clinical_note", "coaching_log", "order_event", "gp_letter", "admin_note"];  // admin_note added BLD-4.5.3

  return (
    <div className="px-6 py-5 space-y-4">
      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap bg-surface border border-bdr rounded-lg px-4 py-3">
        <Filter className="w-3.5 h-3.5 text-t3 shrink-0" />
        <div className="flex flex-wrap gap-2">
          {availableTypes.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`px-3 py-1 text-[11px] font-semibold rounded-full border transition-colors ${
                typeFilter.includes(t)
                  ? "bg-brand text-white border-brand"
                  : "border-bdr text-t2 hover:border-brand hover:text-brand"
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Author filter */}
        {allAuthors.length > 1 && (
          <select
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
            className="text-[11px] border border-bdr rounded px-2 py-1 bg-page-bg text-t2 focus:outline-none focus:border-brand"
          >
            <option value="">All authors</option>
            {allAuthors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="text-[11px] border border-bdr rounded px-2 py-1 bg-page-bg text-t2 focus:outline-none focus:border-brand"
          />
          <span className="text-[11px] text-t3">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="text-[11px] border border-bdr rounded px-2 py-1 bg-page-bg text-t2 focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      {/* ── Timeline entries ─────────────────────────────────────────────── */}
      {filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-t3">
          <Clock className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-[13px]">No timeline entries match the current filter.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[11px] top-0 bottom-0 w-px bg-bdr" />

          <div className="space-y-4">
            {filteredEntries.map((entry) => {
              const isClinicalNote = entry.type === "clinical_note";
              const sourceNote     = isClinicalNote ? notes.find((n) => n.id === entry.id) : undefined;
              const isEditing      = editingNoteId === entry.id;
              const isExpanded     = expandedId === entry.id;

              return (
                <div key={entry.id} className="flex gap-3 items-start">
                  {/* Dot */}
                  <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border border-bdr bg-surface mt-0.5 z-10">
                    <div className={`w-2 h-2 rounded-full ${TYPE_DOT[entry.badge_color] ?? "bg-t3"}`} />
                  </div>

                  {/* Card */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-px text-[9px] font-bold rounded border ${BADGE_CLASSES[entry.badge_color] ?? BADGE_CLASSES["neutral"]}`}>
                        {TYPE_LABELS[entry.type] ?? entry.type}
                      </span>
                      <span className="text-[11px] text-t3 ml-auto tabular-nums">
                        {formatDateTime(entry.occurred_at)}
                      </span>
                    </div>
                    <p className="text-[12px] text-t1 mt-1 leading-relaxed">{entry.summary}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-[11px] text-t3">{entry.author_label}</p>
                      {isClinicalNote && sourceNote && (
                        <button
                          onClick={() => handleNoteClick(entry.id)}
                          className="flex items-center gap-0.5 text-[10px] font-semibold text-brand hover:underline"
                        >
                          {isEditing || isExpanded
                            ? <><ChevronUp className="w-3 h-3" /> Collapse</>
                            : canEdit
                            ? <><ChevronDown className="w-3 h-3" /> Edit</>
                            : <><ChevronDown className="w-3 h-3" /> View</>
                          }
                        </button>
                      )}
                    </div>

                    {entry.link_url && !isClinicalNote && (
                      <a
                        href={entry.link_url}
                        className="inline-block mt-1 text-[11px] text-brand hover:underline"
                      >
                        View →
                      </a>
                    )}

                    {/* Edit mode — Prescriber/Admin */}
                    {isEditing && sourceNote && (
                      <div className="mt-3">
                        <ClinicalNoteEditor
                          clinicId={clinicId}
                          patientId={sourceNote.patient_id}
                          orderId={sourceNote.order_id}
                          minChars={minChars}
                          canWrite={canEdit}
                          existingNote={sourceNote}
                          onNoteUpdated={(updated) => {
                            setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
                            setEditingNoteId(null);
                          }}
                        />
                      </div>
                    )}

                    {/* Read-only expand — Coach/Owner */}
                    {isExpanded && sourceNote && (
                      <div className="mt-2 px-3 py-2 bg-page-bg border border-bdr rounded-md text-[12px] text-t1 leading-relaxed whitespace-pre-wrap">
                        {sourceNote.body}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
