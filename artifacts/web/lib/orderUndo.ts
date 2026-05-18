/**
 * Shared "Undo last clinical decision" window contract.
 *
 * Used by both:
 *   - components/clinical-check/ClinicalCheckClient.tsx  (queue slide-over toast)
 *   - components/orders/OrderDetailClient.tsx            (order detail header)
 *
 * The deadline is persisted in sessionStorage per-order so the Undo
 * affordance survives navigation and refresh within the same session:
 * a clinician who decides from the queue and then opens the order
 * detail page during the window still sees Undo, and vice-versa.
 */

export const ORDER_UNDO_WINDOW_MS = 5000;

const KEY_PREFIX = "order:undoDeadline:";

function key(orderId: string): string {
  return `${KEY_PREFIX}${orderId}`;
}

/** Open the undo window for an order (deadline = now + ORDER_UNDO_WINDOW_MS). */
export function openOrderUndoWindow(orderId: string): number {
  const deadline = Date.now() + ORDER_UNDO_WINDOW_MS;
  if (typeof window !== "undefined") {
    try { window.sessionStorage.setItem(key(orderId), String(deadline)); } catch { /* ignore */ }
  }
  return deadline;
}

/** Read the current undo deadline for an order, or null if none / expired. */
export function readOrderUndoDeadline(orderId: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key(orderId));
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= Date.now()) {
      window.sessionStorage.removeItem(key(orderId));
      return null;
    }
    return n;
  } catch {
    return null;
  }
}

/** Clear the undo window (called after a successful reverseDecision or expiry). */
export function clearOrderUndoWindow(orderId: string): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(key(orderId)); } catch { /* ignore */ }
}
