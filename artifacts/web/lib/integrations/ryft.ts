/**
 * Ryft integration stub — BLD-4.6.5 (Wave 4).
 *
 * Livera uses Ryft's authorise-not-capture model.
 * releaseAuth: called when an order expires (6 calendar days, BLD-4.6.3).
 *
 * Feature-flagged by LIVERA_RYFT_LIVE (default false).
 * When false: stub logs success + returns deterministic result.
 * When true: real Ryft API call (post-launch wiring).
 *
 * Payment copy rule (PRODUCT_VISION.md Chunk 4.6):
 *   NEVER say "refund" for expired/declined. Use "order released" / "no charge taken".
 *
 * Failure mode: releaseAuth failure LOGS but does NOT block the expiry transition.
 * The order must expire regardless; Ryft reconciliation is a background task.
 *
 * Fix Cycle 1 — POLISH: replaced new Date().toISOString() with NOW import.
 */

import { NOW } from '@/lib/api/constants';

const RYFT_LIVE = process.env['LIVERA_RYFT_LIVE'] === 'true';

export interface RyftReleaseResult {
  success: boolean;
  ryft_auth_id: string;
  order_id: string;
  message: string;  // "order released — no charge taken"
}

/**
 * Release a Ryft authorisation on order expiry.
 * Failure is non-blocking — caller must catch and log separately.
 */
export async function releaseAuth(
  ryft_auth_id: string,
  order_id: string,
): Promise<RyftReleaseResult> {
  console.log('[AUDIT]', {
    event_type:    'ryft_release_auth_attempt',
    ryft_auth_id,
    order_id,
    live:          RYFT_LIVE,
    timestamp:     NOW,
  });

  if (!RYFT_LIVE) {
    console.info('[RYFT]', `releaseAuth stub — auth ${ryft_auth_id} released for order ${order_id}`);
    return {
      success:      true,
      ryft_auth_id,
      order_id,
      message:      'order released — no charge taken',
    };
  }

  // Real Ryft API wiring — post-launch
  throw new Error('LIVERA_RYFT_LIVE=true wiring not yet implemented');
}

// ---------------------------------------------------------------------------
// Task-38 — refundPayment
//
// Called by the refund-amendment approval flow when a payment has already been
// CAPTURED. (For uncaptured auths, use releaseAuth() above — no money has
// moved, so the "refund" concept does not apply.)
//
// Stubbed behind LIVERA_RYFT_LIVE; mirrors the shape of releaseAuth so the
// later live wiring is a like-for-like swap. Failure is non-blocking — the
// caller is responsible for catching and surfacing the error.
// ---------------------------------------------------------------------------

export interface RyftRefundResult {
  success: boolean;
  ryft_auth_id: string;
  ryft_refund_ref: string;       // deterministic stub ref in dev; real Ryft id when live
  order_id: string;
  amount_pence: number;          // amount actually refunded
  message: string;
}

export async function refundPayment(
  ryft_auth_id: string,
  amount_pence: number,
  order_id: string,
): Promise<RyftRefundResult> {
  console.log('[AUDIT]', {
    event_type:    'ryft_refund_attempt',
    ryft_auth_id,
    order_id,
    amount_pence,
    live:          RYFT_LIVE,
    timestamp:     NOW,
  });

  if (!RYFT_LIVE) {
    const stubRef = `ryft_ref_${order_id.toLowerCase()}_${amount_pence}`;
    console.info('[RYFT]', `refundPayment stub — refunded ${amount_pence}p on auth ${ryft_auth_id} (order ${order_id}) → ${stubRef}`);
    return {
      success:         true,
      ryft_auth_id,
      ryft_refund_ref: stubRef,
      order_id,
      amount_pence,
      message:         `refund of £${(amount_pence / 100).toFixed(2)} issued`,
    };
  }

  // Real Ryft API wiring — post-launch
  throw new Error('LIVERA_RYFT_LIVE=true wiring not yet implemented');
}
