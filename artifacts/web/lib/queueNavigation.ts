"use client";

/**
 * Queue navigation — keeps the filtered queue order from a list view alive on
 * the detail page so staff can ↑/↓ through items without going back to the list.
 *
 * Storage: sessionStorage (cleared per tab close). Keyed by `queue:<kind>`.
 * Value: JSON array of item IDs in current filter order.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type QueueKind = "orders" | "complaints" | "incidents";

function storageKey(kind: QueueKind): string {
  return `queue:${kind}`;
}

export function saveQueue(kind: QueueKind, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(kind), JSON.stringify(ids));
  } catch {
    /* sessionStorage unavailable (private mode, quota) — silently degrade */
  }
}

export function loadQueue(kind: QueueKind): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(storageKey(kind));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Detail-page hook: ↑/↓ navigates to the prev/next item in the saved queue.
 * Respects the same input/dialog ignore rules used by the list views.
 */
export function useQueueNavigation({
  kind,
  currentId,
  clinicId,
}: {
  kind: QueueKind;
  currentId: string;
  clinicId: string;
}): void {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }

      // Skip when a Radix dialog/modal is open.
      if (typeof document !== "undefined") {
        if (document.querySelector('[role="dialog"][data-state="open"]')) return;
        if (document.querySelector('[role="alertdialog"][data-state="open"]')) return;
      }

      const queue = loadQueue(kind);
      const idx = queue.indexOf(currentId);
      if (idx === -1 || queue.length < 2) return;

      const nextIdx = e.key === "ArrowDown" ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= queue.length) return;

      e.preventDefault();
      router.push(`/${clinicId}/${kind}/${queue[nextIdx]}`);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, currentId, clinicId, router]);
}

/**
 * Read-side hook used by the detail header indicator. Returns the current
 * item's position within the saved queue plus prev/next navigators. Returns
 * null when no saved queue exists (e.g. opened from a deep link) or when the
 * current item is not part of the saved queue.
 *
 * The lookup runs in an effect so SSR returns null and the indicator stays
 * hidden until the queue is read from sessionStorage on the client.
 */
export function useQueuePosition({
  kind,
  currentId,
  clinicId,
}: {
  kind: QueueKind;
  currentId: string;
  clinicId: string;
}): {
  index: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  goPrev: () => void;
  goNext: () => void;
} | null {
  const router = useRouter();
  const [state, setState] = useState<{ queue: string[]; idx: number } | null>(null);

  useEffect(() => {
    const queue = loadQueue(kind);
    const idx = queue.indexOf(currentId);
    if (idx === -1) {
      setState(null);
      return;
    }
    setState({ queue, idx });
  }, [kind, currentId]);

  const goPrev = useCallback(() => {
    if (!state || state.idx <= 0) return;
    router.push(`/${clinicId}/${kind}/${state.queue[state.idx - 1]}`);
  }, [state, router, clinicId, kind]);

  const goNext = useCallback(() => {
    if (!state || state.idx >= state.queue.length - 1) return;
    router.push(`/${clinicId}/${kind}/${state.queue[state.idx + 1]}`);
  }, [state, router, clinicId, kind]);

  if (!state) return null;
  return {
    index: state.idx + 1,
    total: state.queue.length,
    hasPrev: state.idx > 0,
    hasNext: state.idx < state.queue.length - 1,
    goPrev,
    goNext,
  };
}
