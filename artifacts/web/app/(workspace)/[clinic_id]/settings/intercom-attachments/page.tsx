"use client";

/**
 * Settings → Intercom attachments — task #311.
 *
 * Clinic-wide audit view over every file staged by the compose box across
 * Intercom conversations. Owner/Admin only (gated server-side by
 * requireAdminRole on GET /api/intercom/:clinic_id/attachments).
 *
 * Lets clinicians:
 *   - browse what's been shared with patients without hunting through every
 *     conversation
 *   - re-download the original bytes (chip → /uploads/:id route)
 *   - jump back to the originating order/conversation when we can resolve it
 *
 * Pagination is cursor-based on `created_at` (server returns most-recent
 * first; "Load older" passes the oldest row's timestamp back as `before`).
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Paperclip,
  Download,
  Loader2,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  FileText,
  User,
} from "lucide-react";

type Attachment = {
  id: string;
  clinic_id: string;
  name: string;
  content_type: string;
  byte_size: number;
  created_at: number;
  conversation_id: string | null;
  patient_id: string | null;
  uploader_id: string | null;
  uploader_name: string | null;
  uploader_role: string | null;
  download_url: string;
};

type Cursor = { created_at: number; id: string };

type ListResponse = {
  clinic_id: string;
  count: number;
  retention_seconds: number;
  attachments: Attachment[];
};

const PAGE_SIZE = 50;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAbsolute(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function IntercomAttachmentsPage() {
  const params = useParams<{ clinic_id: string }>();
  const clinicId = params.clinic_id;
  const [rows, setRows] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retentionSeconds, setRetentionSeconds] = useState<number>(7 * 24 * 3600);
  // null = we know there is nothing older; otherwise it is the cursor to pass.
  // Composite `(created_at, id)` so same-second uploads at a page boundary
  // are not silently dropped.
  const [nextCursor, setNextCursor] = useState<Cursor | null>(null);

  const fetchPage = useCallback(
    async (before?: Cursor): Promise<ListResponse> => {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (before) {
        qs.set("before", String(before.created_at));
        qs.set("before_id", before.id);
      }
      const res = await fetch(
        `/api/intercom/${clinicId}/attachments?${qs.toString()}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({ error: res.statusText }))) as {
          error?: string;
        };
        throw new Error(detail.error ?? `request_failed_${res.status}`);
      }
      return (await res.json()) as ListResponse;
    },
    [clinicId],
  );

  function cursorFromLast(items: Attachment[]): Cursor | null {
    if (items.length < PAGE_SIZE) return null;
    const last = items[items.length - 1];
    return last ? { created_at: last.created_at, id: last.id } : null;
  }

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchPage();
      setRows(json.attachments);
      setRetentionSeconds(json.retention_seconds);
      setNextCursor(cursorFromLast(json.attachments));
    } catch (err) {
      setError(err instanceof Error ? err.message : "request_failed");
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  async function loadMore() {
    if (nextCursor === null || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const json = await fetchPage(nextCursor);
      setRows((prev) => [...prev, ...json.attachments]);
      setNextCursor(cursorFromLast(json.attachments));
    } catch (err) {
      setError(err instanceof Error ? err.message : "request_failed");
    } finally {
      setLoadingMore(false);
    }
  }

  const retentionDays = Math.round(retentionSeconds / (24 * 3600));

  return (
    <div className="px-6 py-5 max-w-[1200px]">
      {/* Page header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-bold text-t1 flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-t2" />
            Attachments
          </h2>
          <p className="text-[12px] text-t3 mt-1 max-w-[640px]">
            Every file staged by the compose box across Intercom conversations
            in this clinic, most recent first. Each row shows who uploaded it
            and links back to the patient when we can resolve the conversation.
            Files are kept for {retentionDays} days before being pruned
            automatically.
          </p>
        </div>
        <button
          onClick={() => void loadFirstPage()}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-t2 hover:text-t1 px-2.5 py-1.5 rounded border border-bdr hover:bg-surface"
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded border border-err/30 bg-err-bg px-3 py-2 text-[12px] text-err">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Could not load attachments</div>
            <div className="text-err/80">{error}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-t3 text-[12px]">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading attachments…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-bdr bg-surface px-6 py-12 text-center">
          <FileText className="w-6 h-6 text-t3 mx-auto mb-2" />
          <div className="text-[13px] font-semibold text-t1">
            No attachments yet
          </div>
          <p className="text-[12px] text-t3 mt-1 max-w-[440px] mx-auto">
            Files clinicians send through the Intercom composer will appear
            here. Nothing has been shared in this clinic in the last{" "}
            {retentionDays} days.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-bdr bg-surface">
          <table className="w-full text-[12px]">
            <thead className="bg-surface-sunk text-t3 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">File</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Size</th>
                <th className="px-3 py-2 font-semibold">Uploaded by</th>
                <th className="px-3 py-2 font-semibold">Uploaded</th>
                <th className="px-3 py-2 font-semibold">Conversation</th>
                <th className="px-3 py-2 font-semibold text-right">Download</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-bdr hover:bg-surface-sunk">
                  <td className="px-3 py-2 text-t1">
                    <div className="font-medium truncate max-w-[280px]" title={row.name}>
                      {row.name}
                    </div>
                    <div className="text-[11px] text-t3 font-mono">{row.id}</div>
                  </td>
                  <td className="px-3 py-2 text-t2 font-mono text-[11px]">
                    {row.content_type}
                  </td>
                  <td className="px-3 py-2 text-t2 tabular-nums">
                    {formatBytes(row.byte_size)}
                  </td>
                  <td className="px-3 py-2 text-t2">
                    {row.uploader_name ? (
                      <div className="inline-flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-t3" />
                        <div>
                          <div className="text-t1">{row.uploader_name}</div>
                          {row.uploader_role && (
                            <div className="text-[11px] text-t3 capitalize">
                              {row.uploader_role}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-t3 italic">Unknown</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-t2">
                    <div title={formatAbsolute(row.created_at)}>
                      {formatRelative(row.created_at)}
                    </div>
                    <div className="text-[11px] text-t3">
                      {formatAbsolute(row.created_at)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-t2">
                    {row.conversation_id && row.patient_id ? (
                      <Link
                        href={`/${clinicId}/patients/${row.patient_id}`}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-info hover:underline"
                        title={`Open ${row.patient_id}'s record (conversation ${row.conversation_id})`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {row.conversation_id}
                      </Link>
                    ) : row.conversation_id ? (
                      <span
                        className="inline-flex items-center gap-1 font-mono text-[11px]"
                        title="Conversation found, but the patient could not be resolved"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-t3" />
                        {row.conversation_id}
                      </span>
                    ) : (
                      <span className="text-t3 italic">Not yet sent</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a
                      href={row.download_url}
                      download={row.name}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {nextCursor !== null && (
            <div className="border-t border-bdr px-3 py-2 flex items-center justify-center">
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-t2 hover:text-t1"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading older…
                  </>
                ) : (
                  <>Load older</>
                )}
              </button>
            </div>
          )}
          <div className="border-t border-bdr px-3 py-2 text-[11px] text-t3 bg-surface-sunk">
            Showing {rows.length} attachment{rows.length === 1 ? "" : "s"}
            {nextCursor === null ? " (all available within retention)." : "."}
          </div>
        </div>
      )}
    </div>
  );
}
