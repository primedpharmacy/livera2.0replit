"use client";

/**
 * PharmacyCommsPanel — BLD-16.1 / BLD-16.9 / BLD-16.10
 *
 * Order-anchored OR patient-anchored two-way messaging thread panel.
 * Renders a thread list, thread detail, reply composer, and new thread form.
 * Fully self-contained — fetches via mock API, no parent state required.
 *
 * Usage:
 *   <PharmacyCommsPanel clinicId="feeltru" anchorType="order" anchorId="ORD-00441" />
 *   <PharmacyCommsPanel clinicId="feeltru" anchorType="patient" anchorId="PT-00198" />
 */

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare, ChevronLeft, Send, Plus, CheckCircle, Clock, AlertTriangle,
} from "lucide-react";
import {
  listPharmacyCommThreads,
  replyToPharmacyCommThread,
  createPharmacyCommThread,
} from "@/lib/api/mock";
import { CURRENT_USER } from "@/lib/api/constants";
import { can } from "@/lib/permissions";
import { formatRelativeTime } from "@/lib/format";
import type { PharmacyCommThread, ClinicId, PharmacyCommAnchorType } from "@/types";

interface Props {
  clinicId: ClinicId;
  anchorType: PharmacyCommAnchorType;
  anchorId: string;
}

const TOPICS: { value: string; label: string }[] = [
  { value: "amendment_address_change", label: "Address change"          },
  { value: "clinical_query",           label: "Clinical query"          },
  { value: "controlled_drug",          label: "Controlled drug record"  },
  { value: "dispensing_query",         label: "Dispensing query"        },
  { value: "urgent_clinical",          label: "Urgent clinical matter"  },
];

function topicLabel(topic: string): string {
  return TOPICS.find((t) => t.value === topic)?.label ?? topic.replace(/_/g, " ");
}

function ThreadStatusBadge({ status }: { status: PharmacyCommThread["status"] }) {
  if (status === "resolved") {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ok-bg border border-ok-bdr text-ok uppercase tracking-wide">
        Resolved
      </span>
    );
  }
  if (status === "awaiting_response") {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warn-bg border border-warn-bdr text-warn uppercase tracking-wide">
        Awaiting
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-light border border-brand/20 text-brand uppercase tracking-wide">
      Open
    </span>
  );
}

export function PharmacyCommsPanel({ clinicId, anchorType, anchorId }: Props) {
  const canWrite = can(CURRENT_USER, "write", "pharmacy_comms");

  const [threads,     setThreads]     = useState<PharmacyCommThread[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [replyBody,   setReplyBody]   = useState("");
  const [isSending,   setIsSending]   = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [newTopic,    setNewTopic]    = useState(TOPICS[0].value);
  const [newPriority, setNewPriority] = useState<"routine" | "urgent">("routine");
  const [newBody,     setNewBody]     = useState("");
  const [isCreating,  setIsCreating]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPharmacyCommThreads(clinicId, {
        anchor_type: anchorType,
        anchor_id:   anchorId,
      });
      setThreads(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load threads");
    } finally {
      setLoading(false);
    }
  }, [clinicId, anchorType, anchorId]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  const selectedThread = threads.find((t) => t.id === selectedId) ?? null;

  async function handleReply() {
    if (!selectedThread || !replyBody.trim() || isSending) return;
    setIsSending(true);
    try {
      await replyToPharmacyCommThread(clinicId, selectedThread.id, replyBody.trim());
      setReplyBody("");
      await fetchThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reply failed");
    } finally {
      setIsSending(false);
    }
  }

  async function handleCreate() {
    if (!newBody.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const thread = await createPharmacyCommThread(clinicId, {
        anchor_type: anchorType,
        anchor_id:   anchorId,
        topic:       newTopic,
        priority:    newPriority,
        body:        newBody.trim(),
      });
      setShowNew(false);
      setNewBody("");
      setNewTopic(TOPICS[0].value);
      setNewPriority("routine");
      await fetchThreads();
      setSelectedId(thread.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create thread");
    } finally {
      setIsCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-t3 text-[13px] gap-2">
        <div className="animate-spin w-4 h-4 border-2 border-brand border-t-transparent rounded-full" />
        Loading threads...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-5 my-4 px-4 py-3 bg-err-bg border border-err-bdr rounded-lg flex items-center gap-2 text-[12px] text-err">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        {error}
      </div>
    );
  }

  // ── Thread detail ─────────────────────────────────────────────────────────
  if (selectedThread) {
    const canReply = canWrite && selectedThread.status !== "resolved";
    return (
      <div>
        {/* Back + meta header */}
        <div className="px-5 py-3.5 border-b border-bdr">
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-1.5 text-[12px] text-brand font-semibold hover:underline mb-3"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to threads
          </button>
          <div className="flex items-start gap-2 flex-wrap mb-1">
            <span className="font-mono text-[11px] text-t3 bg-page-bg px-1.5 py-0.5 rounded">
              {selectedThread.id}
            </span>
            <ThreadStatusBadge status={selectedThread.status} />
            {selectedThread.priority === "urgent" && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-err-bg text-err">
                Urgent
              </span>
            )}
          </div>
          <p className="text-[14px] font-bold text-t1">{topicLabel(selectedThread.topic)}</p>
          <p className="text-[11px] text-t3 mt-0.5">
            Opened by {selectedThread.created_by_user_id} · {formatRelativeTime(selectedThread.created_at)}
          </p>
        </div>

        {/* Messages */}
        <div className="px-5 py-4 space-y-3">
          {selectedThread.messages.map((msg) => {
            const isOut = msg.direction === "outbound";
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 p-3 rounded-lg border ${
                  isOut ? "bg-brand-light border-brand/20" : "bg-ok-bg border-ok-bdr"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5 ${
                    isOut ? "bg-brand" : "bg-ok"
                  }`}
                >
                  {isOut ? "CL" : "RX"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-t3 mb-1">
                    <span className="font-bold text-t1 text-[12px]">
                      {isOut ? "Clinic" : "Primed Pharmacy"}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-px rounded text-white ${
                        isOut ? "bg-brand" : "bg-ok"
                      }`}
                    >
                      {isOut ? "OUTBOUND" : "INBOUND"}
                    </span>
                    <span className="ml-auto tabular-nums">{formatRelativeTime(msg.sent_at)}</span>
                  </div>
                  <p className="text-[12.5px] text-t1 leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply composer or resolved notice */}
        {canReply ? (
          <div className="mx-5 mb-5 bg-brand-light border border-brand/20 rounded-lg p-3.5">
            <p className="text-[10px] font-bold text-brand uppercase tracking-wider mb-2">
              Reply
              <span className="text-t3 font-normal normal-case tracking-normal ml-2">
                Signed as {CURRENT_USER.id}
              </span>
            </p>
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={3}
              placeholder="Type a message to Primed Pharmacy..."
              className="w-full text-[12.5px] px-3 py-2 border border-bdr rounded-md bg-surface resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-t3">{replyBody.length} chars</span>
              <button
                onClick={handleReply}
                disabled={!replyBody.trim() || isSending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold bg-brand text-white disabled:opacity-40 transition-opacity"
              >
                <Send className="w-3.5 h-3.5" />
                {isSending ? "Sending..." : "Send to pharmacy"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-5 mb-5 px-4 py-3 rounded-lg bg-ok-bg border border-ok-bdr text-[12px] text-ok flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Thread resolved — no further replies.
          </div>
        )}
      </div>
    );
  }

  // ── Thread list ───────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-bdr flex items-center gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand" />
          <span className="text-[13px] font-semibold text-t1">
            {threads.length} thread{threads.length !== 1 ? "s" : ""}
          </span>
        </div>
        {canWrite && !showNew && (
          <button
            onClick={() => setShowNew(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold bg-brand text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            New thread
          </button>
        )}
      </div>

      {/* New thread inline form */}
      {showNew && (
        <div className="mx-5 mt-4 bg-brand-light border border-brand/20 rounded-lg p-4">
          <p className="text-[12px] font-bold text-brand mb-3">New pharmacy comms thread</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-bold text-t3 uppercase tracking-wider block mb-1">
                Topic
              </label>
              <select
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                className="w-full text-[12px] px-2.5 py-1.5 border border-bdr rounded bg-surface focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                {TOPICS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-t3 uppercase tracking-wider block mb-1">
                Priority
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as "routine" | "urgent")}
                className="w-full text-[12px] px-2.5 py-1.5 border border-bdr rounded bg-surface focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={4}
            placeholder="Describe the issue or request for Primed Pharmacy..."
            className="w-full text-[12.5px] px-3 py-2 border border-bdr rounded-md bg-surface resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => { setShowNew(false); setNewBody(""); }}
              className="px-3 py-1.5 rounded-md text-[12px] font-semibold border border-bdr bg-surface text-t2"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newBody.trim() || isCreating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold bg-brand text-white disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              {isCreating ? "Opening..." : "Open thread"}
            </button>
          </div>
        </div>
      )}

      {/* Thread rows */}
      {threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-5">
          <MessageSquare className="w-8 h-8 text-t3 mb-3" />
          <p className="text-[13px] font-semibold text-t2">No threads yet</p>
          <p className="text-[12px] text-t3 mt-1">
            Use the button above to start a conversation with Primed Pharmacy.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-bdr">
          {threads.map((thread) => {
            const lastMsg = thread.messages[thread.messages.length - 1];
            return (
              <button
                key={thread.id}
                onClick={() => setSelectedId(thread.id)}
                className="w-full text-left px-5 py-4 hover:bg-brand-light transition-colors flex gap-3 items-start"
              >
                <div
                  className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                    thread.status === "resolved"
                      ? "bg-ok-bg text-ok border border-ok-bdr"
                      : thread.status === "awaiting_response"
                      ? "bg-warn-bg text-warn border border-warn-bdr"
                      : "bg-brand-light text-brand border border-brand/20"
                  }`}
                >
                  {thread.status === "resolved" ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : thread.status === "awaiting_response" ? (
                    <Clock className="w-4 h-4" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-[12.5px] font-semibold text-t1 truncate">
                      {topicLabel(thread.topic)}
                    </span>
                    <ThreadStatusBadge status={thread.status} />
                    {thread.priority === "urgent" && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-px rounded bg-err-bg text-err">
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-t2 truncate">
                    {lastMsg?.body ?? "No messages"}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10.5px] text-t3">
                    <span className="font-mono">{thread.id}</span>
                    <span>·</span>
                    <span>{formatRelativeTime(thread.updated_at)}</span>
                    <span>·</span>
                    <span>{thread.messages.length} msg{thread.messages.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
