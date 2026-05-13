"use client";

/**
 * BLD-INTERCOM-PHOTO-01 — Intercom tab with photo-attachment viewer
 *
 * Conversation list showing 📎 badges on photo-bearing rows.
 * Clicking a row opens a lightbox with:
 *   • Photo viewer (prev/next navigation)
 *   • Photo metadata panel
 *   • Evidence attachment form (type, incident link, notes)
 *
 * Source: Intercom side — Livera stores reference + clinical context only.
 * Photo files remain in Intercom; action audited to AUD-04.
 */

import { useState } from "react";
import {
  MessageCircle, Paperclip, X, ChevronLeft, ChevronRight,
  ExternalLink, CheckCircle2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CURRENT_USER } from "@/lib/api/mock";
import type { Patient } from "@/lib/api/types";

interface Props {
  patient: Patient;
}

// ── Mock conversation data ────────────────────────────────────────────────────

type PhotoMeta = {
  idx: number;
  label: string;
  timestamp: string;
  source: string;
};

type Conversation = {
  id: string;
  subject: string;
  status: "Open" | "Closed";
  agent: string;
  date: string;
  photos: PhotoMeta[];
  alreadyAttached: boolean;
  highlight?: "amber";
};

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "CONV-00812",
    subject: "Nausea after injection — week 4",
    status: "Closed",
    agent: "Jamie",
    date: "13 Feb 2026",
    photos: [{ idx: 1, label: "Patient-sent photo · injection site", timestamp: "13 Feb 2026 · 09:14", source: "Intercom" }],
    alreadyAttached: false,
  },
  {
    id: "CONV-00824",
    subject: "Injection site reaction",
    status: "Open",
    agent: "Claire M",
    date: "07 May 2026",
    photos: [
      { idx: 1, label: "Patient-sent photo · injection site (front)", timestamp: "07 May 2026 · 11:02", source: "Intercom" },
      { idx: 2, label: "Patient-sent photo · injection site (side)", timestamp: "07 May 2026 · 11:04", source: "Intercom" },
    ],
    alreadyAttached: false,
    highlight: "amber",
  },
  {
    id: "CONV-00798",
    subject: "Weight evidence",
    status: "Closed",
    agent: "Admin",
    date: "04 May 2026",
    photos: [{ idx: 1, label: "Scale photo for monthly check-in", timestamp: "04 May 2026 · 08:33", source: "Intercom" }],
    alreadyAttached: true,
  },
];

const EVIDENCE_TYPES = [
  "BMI photo",
  "Injection site reaction",
  "Adverse event evidence",
  "Weight evidence (scale photo)",
  "Other clinical evidence",
];

// ── Component ─────────────────────────────────────────────────────────────────

export function IntercomPhotoTab({ patient }: Props) {
  const [openConv, setOpenConv] = useState<Conversation | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [evidenceType, setEvidenceType] = useState(EVIDENCE_TYPES[0]);
  const [incidentLink, setIncidentLink] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [attachedConvIds, setAttachedConvIds] = useState<Set<string>>(
    new Set(MOCK_CONVERSATIONS.filter((c) => c.alreadyAttached).map((c) => c.id))
  );

  function openModal(conv: Conversation) {
    setOpenConv(conv);
    setPhotoIdx(0);
    setEvidenceType(EVIDENCE_TYPES[0]);
    setIncidentLink("");
    setEvidenceNote("");
  }

  function closeModal() {
    setOpenConv(null);
  }

  async function handleAttach() {
    if (!openConv) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 700));
    setAttachedConvIds((prev) => new Set([...prev, openConv.id]));
    console.log("[AUDIT]", {
      action: "intercom_photo.attached_as_evidence",
      conversation_id: openConv.id,
      photo_idx: photoIdx + 1,
      evidence_type: evidenceType,
      incident_link: incidentLink || null,
      note: evidenceNote || null,
      patient_id: patient.id,
      user_id: CURRENT_USER.id,
      timestamp: new Date().toISOString(),
    });
    setSaving(false);
    closeModal();
  }

  if (!patient.intercom_user_id) {
    return (
      <div className="p-5">
        <div className="bg-surface border border-bdr rounded-lg p-8 text-center">
          <MessageCircle className="w-8 h-8 text-t3 mx-auto mb-2" />
          <p className="text-[13px] font-semibold text-t1 mb-1">Patient not yet linked to Intercom</p>
          <p className="text-[12px] text-t2">
            Once the patient's Intercom user ID is set via the webhook integration, conversation threads and photo attachments will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-5 flex flex-col gap-4">
        {/* Linked status banner */}
        <div className="bg-ok-bg border border-ok-bdr rounded-lg px-4 py-3 flex items-center gap-3">
          <MessageCircle className="w-4 h-4 text-ok shrink-0" />
          <div>
            <p className="text-[12px] font-semibold text-ok">Patient linked to Intercom</p>
            <p className="text-[12px] text-t2 mt-px font-mono">{patient.intercom_user_id}</p>
          </div>
        </div>

        {/* Conversation list */}
        <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-bdr flex items-center justify-between">
            <div>
              <p className="text-[12px] font-bold text-t1">Intercom conversations</p>
              <p className="text-[11px] text-t3 mt-0.5">Live feed · 📎 indicates patient-sent photo evidence</p>
            </div>
            <span className="text-[11px] bg-page-bg border border-bdr rounded px-2 py-0.5 text-t2 font-mono">
              {MOCK_CONVERSATIONS.length} conversations
            </span>
          </div>

          <div className="divide-y divide-bdr">
            {MOCK_CONVERSATIONS.map((conv) => {
              const isAttached = attachedConvIds.has(conv.id);
              const hasPhotos = conv.photos.length > 0;

              return (
                <button
                  key={conv.id}
                  onClick={() => hasPhotos && openModal(conv)}
                  className={cn(
                    "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors",
                    hasPhotos ? "cursor-pointer hover:bg-page-bg" : "cursor-default",
                    conv.highlight === "amber" && "bg-warn-bg/50 border-l-2 border-warn pl-[14px]"
                  )}
                >
                  <MessageCircle className={cn(
                    "w-4 h-4 mt-0.5 shrink-0",
                    conv.status === "Open" ? "text-ok" : "text-t3"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-t1">{conv.id}</span>
                      <span className="text-[12px] text-t1">— {conv.subject}</span>
                      {hasPhotos && (
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                          isAttached
                            ? "bg-brand text-white"
                            : conv.highlight === "amber"
                            ? "bg-warn text-white"
                            : "bg-info text-white"
                        )}>
                          <Paperclip className="w-2.5 h-2.5" />
                          {conv.photos.length === 1
                            ? isAttached ? "photo · attached as evidence" : "photo"
                            : `${conv.photos.length} photos`}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-t3 mt-0.5">
                      {hasPhotos
                        ? conv.photos.length === 1
                          ? conv.photos[0].label
                          : `Patient sent ${conv.photos.length} photos`
                        : `${conv.subject}`}
                      {" · "}
                      <span className={conv.status === "Open" ? "text-ok font-medium" : "text-t3"}>
                        {conv.status}
                      </span>
                      {" · "}{conv.agent} · {conv.date}
                    </p>
                  </div>
                  {hasPhotos && (
                    <ChevronRight className="w-3.5 h-3.5 text-t3 shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Photo lightbox modal ─────────────────────────────────────────────── */}
      {openConv && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-surface rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-bdr">
              <div>
                <p className="text-[13px] font-bold text-t1">
                  Intercom photo ·{" "}
                  <span className="font-mono text-t2">{openConv.id}</span>
                </p>
                <p className="text-[11px] text-t3 mt-0.5">
                  Source: Intercom · photo retained on Intercom side · Livera stores reference + clinical context only
                </p>
              </div>
              <button onClick={closeModal} className="text-t3 hover:text-t1 transition-colors p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Photo viewer + metadata */}
              <div className="grid grid-cols-5 gap-4">
                {/* Photo display */}
                <div className="col-span-3">
                  <div className="bg-gray-900 rounded-lg overflow-hidden aspect-[4/3] flex items-center justify-center relative">
                    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                      <rect width="320" height="240" fill="#1a1a2e" />
                      <rect x="80" y="60" width="160" height="120" rx="8" fill="#2d2d44" />
                      <circle cx="160" cy="110" r="30" fill="#3d3d55" />
                      <rect x="100" y="150" width="120" height="8" rx="4" fill="#3d3d55" />
                      <text
                        x="160" y="210"
                        textAnchor="middle"
                        fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
                        fontSize="10"
                        fill="#92400e"
                        fontWeight="600"
                      >
                        [{openConv.photos[photoIdx]?.label ?? "photo"}]
                      </text>
                    </svg>
                  </div>

                  {/* Navigation */}
                  {openConv.photos.length > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-2">
                      <button
                        onClick={() => setPhotoIdx(Math.max(0, photoIdx - 1))}
                        disabled={photoIdx === 0}
                        className="px-3 py-1.5 text-[12px] border border-bdr rounded-md text-t2 hover:text-t1 disabled:opacity-40 transition-colors flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Previous
                      </button>
                      <span className="text-[12px] text-t3 font-mono">
                        {photoIdx + 1} / {openConv.photos.length}
                      </span>
                      <button
                        onClick={() => setPhotoIdx(Math.min(openConv.photos.length - 1, photoIdx + 1))}
                        disabled={photoIdx === openConv.photos.length - 1}
                        className="px-3 py-1.5 text-[12px] border border-bdr rounded-md text-t2 hover:text-t1 disabled:opacity-40 transition-colors flex items-center gap-1"
                      >
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="col-span-2 space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-t3 mb-2">Photo metadata</p>
                    <dl className="space-y-1.5">
                      {[
                        ["Conversation", openConv.id],
                        ["Source", openConv.photos[photoIdx]?.source ?? "Intercom"],
                        ["Received", openConv.photos[photoIdx]?.timestamp ?? "—"],
                        ["Agent", openConv.agent],
                        ["Status", openConv.status],
                      ].map(([k, v]) => (
                        <div key={k} className="flex flex-col">
                          <dt className="text-[10px] text-t3">{k}</dt>
                          <dd className="text-[12px] text-t1 font-medium">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  {/* Evidence status */}
                  {attachedConvIds.has(openConv.id) ? (
                    <div className="bg-ok-bg border border-ok-bdr rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-ok" />
                        <p className="text-[10px] uppercase tracking-wider font-bold text-ok">Attached as evidence</p>
                      </div>
                      <p className="text-[11px] text-t2">
                        This photo has been attached as clinical evidence. Reference stored in patient notes.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-warn-bg border border-warn-bdr rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <AlertCircle className="w-3.5 h-3.5 text-warn" />
                        <p className="text-[10px] uppercase tracking-wider font-bold text-warn">Not yet attached</p>
                      </div>
                      <p className="text-[11px] text-t2">Not yet attached as clinical evidence.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Attach-to-evidence form — hidden if already attached */}
              {!attachedConvIds.has(openConv.id) && (
                <div className="border border-bdr rounded-lg p-4 space-y-3">
                  <p className="text-[12px] font-semibold text-t1">Attach to evidence</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-t3 mb-1">Evidence type</label>
                      <select
                        value={evidenceType}
                        onChange={(e) => setEvidenceType(e.target.value)}
                        className="w-full text-[12px] border border-bdr rounded-md px-2.5 py-1.5 bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                      >
                        {EVIDENCE_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-t3 mb-1">Link to incident (optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. INC-002"
                        value={incidentLink}
                        onChange={(e) => setIncidentLink(e.target.value)}
                        className="w-full text-[12px] font-mono border border-bdr rounded-md px-2.5 py-1.5 bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-t3 mb-1">Notes</label>
                    <textarea
                      placeholder="Brief context — what does this photo show, what action is required..."
                      value={evidenceNote}
                      onChange={(e) => setEvidenceNote(e.target.value)}
                      rows={3}
                      className="w-full text-[12px] border border-bdr rounded-md px-2.5 py-2 bg-surface focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                    />
                  </div>

                  <p className="text-[11px] text-t3 leading-relaxed">
                    Attaching writes a structured Note entry referencing this Intercom asset. Photo file remains in Intercom — Livera stores the reference, evidence type, link target, and your note. Action audited to AUD-04.
                  </p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-bdr">
              <Button size="sm" variant="outline" onClick={closeModal} className="h-8 text-[12px]">
                Cancel
              </Button>
              <a
                href={`https://app.intercom.com/a/apps/${patient.intercom_user_id}/conversations/${openConv.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] border border-bdr rounded-md text-t2 hover:text-t1 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Intercom
              </a>
              {!attachedConvIds.has(openConv.id) && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleAttach}
                  disabled={saving}
                  className="h-8 text-[12px]"
                >
                  {saving ? "Saving…" : "Attach as evidence"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
