"use client";

/**
 * OrderIntercomTab — Phase 1 (read-only).
 *
 * Replaces the hardcoded stub thread that used to live inside OrderDetailClient.
 * Fetches real Intercom conversations for the patient from the API server
 * (/api/intercom/:clinic_id/contacts/:patient_id/conversations) and subscribes
 * to /api/intercom/:clinic_id/events (Server-Sent Events) so new inbound
 * messages appear within a few seconds without a manual refresh.
 *
 * Sending / replying are explicitly out of scope until Phase 2.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Mail,
  MessageSquare,
  Loader2,
  AlertTriangle,
  Link2,
  RefreshCw,
  Send,
  Plus,
  X,
} from "lucide-react";
import type { Patient, Clinic, ClinicId } from "@/types";
import { useCurrentUser } from "@/lib/context";
import type { Role, User } from "@/lib/api/types";

// Phase 2 — until the web→api auth proxy lands (follow-up #88) the browser
// supplies its own clinician identity for the audit log. We derive it from
// the signed-in demo persona (cookie-resolved via useCurrentUser) so each
// outbound message is attributed to the real clinician viewing the order.
//
// api-server's readClinicianContext allow-lists three role values: owner,
// admin, clinician. Map the web app's richer Role union down to that.
function mapRoleToApi(roles: Role[]): "owner" | "admin" | "clinician" {
  if (roles.includes("Owner")) return "owner";
  if (roles.includes("Admin")) return "admin";
  // Prescriber, Coach, and the deprecated clinical roles all act as
  // clinicians for the purposes of outbound Intercom writes.
  return "clinician";
}

function clinicianHeaders(user: User): Record<string, string> {
  return {
    "X-Livera-Role": mapRoleToApi(user.roles),
    "X-Livera-User-Id": user.id,
    "X-Livera-User-Name": user.full_name,
  };
}

function primaryRoleLabel(roles: Role[]): string {
  // Prefer the most senior/visible role for the compose footer.
  const priority: Role[] = ["Owner", "Admin", "Prescriber", "Coach"];
  for (const r of priority) if (roles.includes(r)) return r;
  return roles[0] ?? "Clinician";
}

type IntercomAuthor = {
  type: "user" | "admin" | "bot";
  id: string;
  name: string;
  email?: string;
};

type IntercomMessagePart = {
  id: string;
  part_type: "comment" | "note" | "assignment" | "close" | "open";
  body: string;
  created_at: number;
  author: IntercomAuthor;
  attachments: Array<{ name: string; url: string; content_type: string }>;
};

type IntercomConversation = {
  id: string;
  contact_id: string;
  subject: string;
  preview: string;
  state: "open" | "closed" | "snoozed";
  read: boolean;
  created_at: number;
  updated_at: number;
  last_author: IntercomAuthor;
  assignee: { id: string; name: string } | null;
  parts: IntercomMessagePart[];
};

type ListResponse = {
  patient_id: string;
  clinic_id: string;
  intercom_contact_id: string | null;
  linked: boolean;
  conversations: IntercomConversation[];
};

interface OrderIntercomTabProps {
  clinicId: ClinicId;
  clinic: Clinic;
  patient: Patient;
  onUnreadChange?: (unread: number) => void;
}

function formatRelative(unixSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatAbsolute(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrderIntercomTab({ clinicId, clinic, patient, onUnreadChange }: OrderIntercomTabProps) {
  const currentUser = useCurrentUser();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState("");
  const [linking, setLinking] = useState(false);
  // Per-conversation detail overlay — populated lazily when a conversation
  // is expanded, fetched from the patient-scoped detail endpoint so the list
  // payload stays light and authorization is re-checked on the server.
  const [detailById, setDetailById] = useState<Record<string, IntercomConversation>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  // Compose state — keyed by conversation id so each thread keeps its own draft.
  const [composeBody, setComposeBody] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  // New-conversation modal state.
  const [newOpen, setNewOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  const integrationConfigured = useMemo(
    () => Boolean(clinic.config.integrations?.intercom?.workspace_id),
    [clinic.config.integrations],
  );

  const loadConversations = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/intercom/${clinicId}/contacts/${patient.id}/conversations`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
        throw new Error(detail.error ?? `request_failed_${res.status}`);
      }
      const json = (await res.json()) as ListResponse;
      setData(json);
      // Auto-expand the most recently updated conversation so the user lands on
      // useful content rather than a list of summaries they have to click.
      const firstId = json.conversations[0]?.id ?? null;
      setExpandedId((current) => current ?? firstId);
      // Surface unread counts to the parent so the Intercom tab strip badge
      // can stay in sync without re-fetching independently.
      if (onUnreadChange) {
        const unread = json.conversations.filter(
          (c) => c.state === "open" && !c.read,
        ).length;
        onUnreadChange(unread);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "request_failed");
    } finally {
      setLoading(false);
    }
  }, [clinicId, patient.id, onUnreadChange]);

  // Fetch one conversation's full detail from the patient-scoped endpoint and
  // cache it. Triggered when the user expands a row. Re-checks authorization
  // server-side and returns the canonical part list (including attachments).
  const fetchDetail = useCallback(async (conversationId: string) => {
    setDetailLoadingId(conversationId);
    try {
      const res = await fetch(
        `/api/intercom/${clinicId}/contacts/${patient.id}/conversations/${conversationId}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const json = (await res.json()) as IntercomConversation;
      setDetailById((prev) => ({ ...prev, [conversationId]: json }));
    } catch {
      // Silent — the list payload's parts remain the fallback view.
    } finally {
      setDetailLoadingId((current) => (current === conversationId ? null : current));
    }
  }, [clinicId, patient.id]);

  useEffect(() => {
    setLoading(true);
    void loadConversations();
  }, [loadConversations]);

  // Whenever the expanded conversation changes, lazily fetch its full detail
  // if we don't already have it cached.
  useEffect(() => {
    if (expandedId && !detailById[expandedId]) {
      void fetchDetail(expandedId);
    }
  }, [expandedId, detailById, fetchDetail]);

  // Live updates — subscribe to the per-clinic SSE channel.
  const sseRef = useRef<EventSource | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    const source = new EventSource(`/api/intercom/${clinicId}/events`);
    sseRef.current = source;
    const refresh = () => {
      // Invalidate any cached detail for the touched conversation so the
      // expanded view re-fetches fresh parts.
      setDetailById({});
      void loadConversations();
    };
    source.addEventListener("conversation.user.created", refresh);
    source.addEventListener("conversation.user.replied", refresh);
    source.addEventListener("conversation.admin.replied", refresh);
    source.addEventListener("conversation.admin.closed", refresh);
    source.onerror = () => {
      // Auto-reconnect is built into EventSource; we just log so failures are
      // visible during development without spamming toasts.
      console.warn("[intercom-sse] connection error — browser will retry");
    };
    return () => {
      source.close();
      sseRef.current = null;
    };
  }, [clinicId, loadConversations]);

  // ── Send an admin reply with optimistic UI + rollback ──────────────────────
  async function handleSendReply(conv: IntercomConversation) {
    const draft = (composeBody[conv.id] ?? "").trim();
    if (!draft || sendingId) return;
    setSendingId(conv.id);
    setComposeError(null);

    // Optimistic part stamped with a temporary id so we can roll it back if
    // the request fails. The server's response replaces it on success.
    const tempId = `ipart_optimistic_${Date.now()}`;
    const nowSec = Math.floor(Date.now() / 1000);
    const optimistic: IntercomMessagePart = {
      id: tempId,
      part_type: "comment",
      body: draft,
      created_at: nowSec,
      author: {
        type: "admin",
        id: currentUser.id,
        name: currentUser.full_name,
      },
      attachments: [],
    };
    const baseDetail = detailById[conv.id] ?? conv;
    setDetailById((prev) => ({
      ...prev,
      [conv.id]: { ...baseDetail, parts: [...baseDetail.parts, optimistic] },
    }));
    setComposeBody((prev) => ({ ...prev, [conv.id]: "" }));

    try {
      const res = await fetch(
        `/api/intercom/${clinicId}/contacts/${patient.id}/conversations/${conv.id}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...clinicianHeaders(currentUser) },
          body: JSON.stringify({ body: draft }),
        },
      );
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
        throw new Error(detail.error ?? `reply_failed_${res.status}`);
      }
      const json = (await res.json()) as { part: IntercomMessagePart };
      // Replace the optimistic part with the server-canonical one in place,
      // preserving message ordering.
      setDetailById((prev) => {
        const current = prev[conv.id];
        if (!current) return prev;
        return {
          ...prev,
          [conv.id]: {
            ...current,
            parts: current.parts.map((p) => (p.id === tempId ? json.part : p)),
          },
        };
      });
    } catch (err) {
      // Rollback: drop the optimistic part and restore the draft text so the
      // clinician can retry without re-typing.
      setDetailById((prev) => {
        const current = prev[conv.id];
        if (!current) return prev;
        return {
          ...prev,
          [conv.id]: {
            ...current,
            parts: current.parts.filter((p) => p.id !== tempId),
          },
        };
      });
      setComposeBody((prev) => ({ ...prev, [conv.id]: draft }));
      setComposeError(err instanceof Error ? err.message : "reply_failed");
    } finally {
      setSendingId((current) => (current === conv.id ? null : current));
    }
  }

  async function handleCreateConversation() {
    const body = newBody.trim();
    const subject = newSubject.trim();
    if (!body || creating) return;
    setCreating(true);
    setNewError(null);

    // Optimistic insert: a synthetic conversation appears at the top of the
    // list immediately and is auto-expanded. The temp id is replaced with
    // the server-assigned one on success, or the whole row is rolled back
    // on failure.
    const tempConvId = `iconv_optimistic_${Date.now()}`;
    const nowSec = Math.floor(Date.now() / 1000);
    const optimisticAuthor: IntercomAuthor = {
      type: "admin",
      id: currentUser.id,
      name: currentUser.full_name,
    };
    const optimisticConv: IntercomConversation = {
      id: tempConvId,
      contact_id: data?.intercom_contact_id ?? "",
      subject: subject || "(no subject)",
      preview: body.slice(0, 140),
      state: "open",
      read: true,
      created_at: nowSec,
      updated_at: nowSec,
      last_author: optimisticAuthor,
      assignee: { id: optimisticAuthor.id, name: optimisticAuthor.name },
      parts: [
        {
          id: `ipart_${tempConvId}_1`,
          part_type: "comment",
          body,
          created_at: nowSec,
          author: optimisticAuthor,
          attachments: [],
        },
      ],
    };
    const previousExpanded = expandedId;
    setData((prev) =>
      prev ? { ...prev, conversations: [optimisticConv, ...prev.conversations] } : prev,
    );
    setDetailById((prev) => ({ ...prev, [tempConvId]: optimisticConv }));
    setExpandedId(tempConvId);
    setNewOpen(false);

    try {
      const res = await fetch(
        `/api/intercom/${clinicId}/contacts/${patient.id}/conversations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...clinicianHeaders(currentUser) },
          body: JSON.stringify({ subject, body }),
        },
      );
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
        throw new Error(detail.error ?? `create_failed_${res.status}`);
      }
      const json = (await res.json()) as { conversation_id: string };
      // Swap the temp row's id (and its cached detail) over to the real one
      // so the upcoming list refresh deduplicates cleanly instead of
      // showing a flash of two entries.
      setData((prev) =>
        prev
          ? {
              ...prev,
              conversations: prev.conversations.map((c) =>
                c.id === tempConvId ? { ...c, id: json.conversation_id } : c,
              ),
            }
          : prev,
      );
      setDetailById((prev) => {
        const next: Record<string, IntercomConversation> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (k === tempConvId) {
            next[json.conversation_id] = { ...v, id: json.conversation_id };
          } else {
            next[k] = v;
          }
        }
        return next;
      });
      setExpandedId(json.conversation_id);
      setNewSubject("");
      setNewBody("");
      await loadConversations();
    } catch (err) {
      // Rollback: drop the synthetic row, restore the previous expansion,
      // and re-open the modal with the user's text preserved so they can
      // retry without re-typing.
      setData((prev) =>
        prev
          ? {
              ...prev,
              conversations: prev.conversations.filter((c) => c.id !== tempConvId),
            }
          : prev,
      );
      setDetailById((prev) => {
        const { [tempConvId]: _dropped, ...rest } = prev;
        return rest;
      });
      setExpandedId(previousExpanded);
      setNewOpen(true);
      setNewError(err instanceof Error ? err.message : "create_failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleLink() {
    if (!linkEmail.trim()) return;
    setLinking(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/intercom/${clinicId}/contacts/${patient.id}/link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Phase 1 stub for the Owner/Admin authz guard on the api-server.
            // A proper server-side proxy will inject this from the session in
            // a follow-up (#88) so the browser can't spoof it. Until then we
            // pass through the signed-in clinician so non-admins are correctly
            // rejected by the api-server's requireAdminRole guard.
            ...clinicianHeaders(currentUser),
          },
          body: JSON.stringify({ email: linkEmail.trim() }),
        },
      );
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
        throw new Error(detail.error ?? `link_failed_${res.status}`);
      }
      setLinkEmail("");
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "link_failed");
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="flex flex-col" style={{ minHeight: "520px" }}>
      {/* Context strip */}
      <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-page-bg border border-bdr rounded-lg">
        <Mail className="w-4 h-4 text-brand shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold text-t1">
            {patient.demographic.full_name}
          </p>
          <p className="text-[11px] text-t3">
            Intercom conversations · {integrationConfigured
              ? `workspace ${clinic.config.integrations?.intercom?.workspace_id}`
              : "no Intercom workspace configured"}
            {data?.intercom_contact_id ? ` · contact ${data.intercom_contact_id}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void loadConversations(); }}
          className="flex items-center gap-1 text-[11px] text-t3 hover:text-brand transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center text-t3 text-[12px]">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading conversations…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-start gap-2 px-3 py-2 bg-err-bg border border-err-bdr text-err rounded-md text-[12px]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Couldn&apos;t load Intercom data</p>
            <p className="text-[11px] mt-0.5 text-err/80">{error}</p>
          </div>
        </div>
      )}

      {/* Empty — patient not linked */}
      {!loading && !error && data && !data.linked && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 bg-page-bg border border-bdr rounded-lg">
          <Link2 className="w-6 h-6 text-t3 mb-3" />
          <p className="text-[13px] font-semibold text-t1">
            No Intercom conversations linked to this patient
          </p>
          <p className="text-[11.5px] text-t3 mt-1 max-w-sm">
            Link an existing Intercom contact by email to see this patient&apos;s real
            conversation thread inline.
          </p>
          <div className="mt-4 flex items-center gap-2 w-full max-w-sm">
            <input
              type="email"
              placeholder={patient.contact.email}
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              className="flex-1 text-[12px] border border-bdr rounded-md px-3 py-2 bg-surface text-t1 placeholder:text-t3 focus:outline-none focus:border-brand"
            />
            <button
              onClick={handleLink}
              disabled={linking || !linkEmail.trim()}
              className="px-3 py-2 text-[12px] font-semibold text-white bg-brand hover:bg-brand/90 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {linking ? "Linking…" : "Link contact"}
            </button>
          </div>
        </div>
      )}

      {/* Empty — linked, but no conversations */}
      {!loading && !error && data?.linked && data.conversations.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 bg-page-bg border border-bdr rounded-lg">
          <MessageSquare className="w-6 h-6 text-t3 mb-3" />
          <p className="text-[13px] font-semibold text-t1">No Intercom conversations yet</p>
          <p className="text-[11.5px] text-t3 mt-1">
            New conversations from {patient.demographic.full_name.split(" ")[0]} will appear here automatically.
          </p>
        </div>
      )}

      {/* List + thread */}
      {!loading && !error && data && data.conversations.length > 0 && (
        <div className="flex-1 space-y-2 overflow-y-auto">
          {data.conversations.map((conv) => {
            const expanded = expandedId === conv.id;
            return (
              <div key={conv.id} className="border border-bdr rounded-lg bg-surface">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : conv.id)}
                  className="w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-page-bg/50 transition-colors rounded-lg"
                >
                  <div className="w-7 h-7 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-brand">
                      {conv.last_author.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12.5px] font-semibold text-t1 truncate">
                        {conv.subject || "(no subject)"}
                      </span>
                      <span className={`text-[9.5px] font-bold px-1.5 py-px rounded uppercase tracking-wider ${
                        conv.state === "open"
                          ? "bg-ok-bg text-ok border border-ok-bdr"
                          : conv.state === "snoozed"
                          ? "bg-warn-bg text-warn border border-warn-bdr"
                          : "bg-page-bg text-t3 border border-bdr"
                      }`}>
                        {conv.state}
                      </span>
                      {!conv.read && conv.state === "open" && (
                        <span className="text-[9.5px] font-bold bg-brand text-white px-1.5 py-px rounded uppercase">
                          new
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-t2 mt-0.5 truncate">
                      {conv.preview}
                    </p>
                    <p className="text-[10.5px] text-t3 mt-1">
                      {conv.last_author.type === "admin" ? "Replied" : "From"} {conv.last_author.name} ·{" "}
                      {formatRelative(conv.updated_at)}
                      {conv.assignee ? ` · assigned ${conv.assignee.name}` : ""}
                    </p>
                  </div>
                </button>

                {/* Expanded thread — prefer the dedicated detail endpoint's
                    parts (re-authorized server-side, includes attachments)
                    over the lighter list-payload version. */}
                {expanded && (() => {
                  const detail = detailById[conv.id];
                  const parts = detail?.parts ?? conv.parts;
                  const isDetailLoading = detailLoadingId === conv.id && !detail;
                  return (
                  <div className="border-t border-bdr px-3 py-3 space-y-3 bg-page-bg/40">
                    {isDetailLoading && (
                      <div className="flex items-center justify-center text-t3 text-[11px] py-2">
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" /> Loading thread…
                      </div>
                    )}
                    {!isDetailLoading && parts.length === 0 && (
                      <p className="text-[11.5px] text-t3 text-center py-3">
                        No message parts yet.
                      </p>
                    )}
                    {parts.map((part) => {
                      const isAdmin = part.author.type === "admin";
                      const isSystem = part.part_type === "close" || part.part_type === "open";
                      if (isSystem) {
                        return (
                          <div key={part.id} className="text-center">
                            <span className="text-[10px] font-semibold text-t3 bg-surface border border-bdr px-2.5 py-1 rounded-full">
                              {part.body} · {formatAbsolute(part.created_at)}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={part.id}
                          className={`flex gap-2 ${isAdmin ? "justify-end" : ""}`}
                        >
                          {!isAdmin && (
                            <div className="w-7 h-7 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-[10px] font-bold text-brand">
                                {part.author.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                              </span>
                            </div>
                          )}
                          <div
                            className={`rounded-xl px-3 py-2 max-w-[320px] ${
                              isAdmin
                                ? "bg-brand text-white rounded-tr-none"
                                : "bg-surface border border-bdr text-t1 rounded-tl-none"
                            }`}
                          >
                            <p className="text-[12px] leading-relaxed whitespace-pre-wrap">
                              {part.body}
                            </p>
                            <p className={`text-[10px] mt-1 ${isAdmin ? "text-white/70" : "text-t3"}`}>
                              {part.author.name} · {formatAbsolute(part.created_at)}
                            </p>
                            {part.attachments.length > 0 && (
                              <ul className="mt-1.5 space-y-0.5">
                                {part.attachments.map((a) => (
                                  <li key={a.url}>
                                    <a
                                      href={a.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`text-[10.5px] underline ${isAdmin ? "text-white" : "text-brand"}`}
                                    >
                                      📎 {a.name}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Inline compose for the currently expanded conversation */}
      {!loading && !error && data?.linked && expandedId && (() => {
        const conv = data.conversations.find((c) => c.id === expandedId);
        if (!conv) return null;
        const draft = composeBody[conv.id] ?? "";
        const sending = sendingId === conv.id;
        return (
          <div className="mt-3 border border-bdr rounded-lg bg-surface p-3">
            <label className="block text-[11px] font-semibold text-t2 mb-1.5">
              Reply to {conv.subject || "this conversation"}
            </label>
            <textarea
              value={draft}
              onChange={(e) =>
                setComposeBody((prev) => ({ ...prev, [conv.id]: e.target.value }))
              }
              placeholder="Type a reply to the patient…"
              rows={3}
              maxLength={10_000}
              disabled={sending}
              className="w-full text-[12.5px] border border-bdr rounded-md px-3 py-2 bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand resize-y disabled:opacity-50"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void handleSendReply(conv);
                }
              }}
            />
            {composeError && (
              <p className="mt-1.5 text-[11px] text-err flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Couldn&apos;t send: {composeError}
              </p>
            )}
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[10.5px] text-t3">
                Sends as {currentUser.full_name} ({primaryRoleLabel(currentUser.roles)}) · ⌘/Ctrl + Enter to send
              </p>
              <button
                type="button"
                onClick={() => void handleSendReply(conv)}
                disabled={sending || !draft.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-brand hover:bg-brand/90 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Send reply
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Start a brand-new conversation with this patient */}
      {!loading && !error && data?.linked && (
        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-t3">
          <span>
            Outbound messages are logged for audit (who, when, conversation, byte length).
          </span>
          <button
            type="button"
            onClick={() => {
              setNewOpen(true);
              setNewError(null);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] font-semibold text-brand border border-brand/40 hover:bg-brand/10 rounded-md"
          >
            <Plus className="w-3.5 h-3.5" /> Start new conversation
          </button>
        </div>
      )}

      {/* New-conversation modal */}
      {newOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface border border-bdr rounded-lg shadow-lg w-full max-w-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13.5px] font-semibold text-t1">
                New conversation with {patient.demographic.full_name}
              </h3>
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                className="text-t3 hover:text-t1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-[11px] font-semibold text-t2 mb-1">
              Subject <span className="text-t3 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              maxLength={200}
              placeholder="e.g. Follow-up on your check-in"
              className="w-full text-[12.5px] border border-bdr rounded-md px-3 py-2 bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand mb-3"
              disabled={creating}
            />
            <label className="block text-[11px] font-semibold text-t2 mb-1">
              Message
            </label>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={5}
              maxLength={10_000}
              placeholder="Write your message…"
              disabled={creating}
              className="w-full text-[12.5px] border border-bdr rounded-md px-3 py-2 bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand resize-y disabled:opacity-50"
            />
            {newError && (
              <p className="mt-2 text-[11px] text-err flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {newError}
              </p>
            )}
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                disabled={creating}
                className="px-3 py-1.5 text-[12px] text-t2 hover:text-t1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateConversation()}
                disabled={creating || !newBody.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-brand hover:bg-brand/90 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Send message
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
