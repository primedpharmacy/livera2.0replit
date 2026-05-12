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
