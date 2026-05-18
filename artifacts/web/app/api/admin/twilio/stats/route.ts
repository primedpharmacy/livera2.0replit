/**
 * Twilio status-callback stats — Task-301.
 *
 * GET /api/admin/twilio/stats
 *
 * Returns the in-process counters maintained by `recordTwilioCallbackEvent`
 * so the ops UI can answer "is Twilio still hammering us with duplicates?"
 * without anyone tailing server logs.
 *
 * Shape:
 *   {
 *     ok: true,
 *     window_ms: 3600000,
 *     last_hour: { processed, duplicate, orphan, intermediate },
 *     totals:    { processed, duplicate, orphan, intermediate },
 *     dedupe_cache_size: <number of live dedupe keys>,
 *     booted_at: ISO timestamp of the first recorded event (or null)
 *   }
 *
 * Same trust boundary as the existing `/api/ops/*` endpoints — no auth
 * gate at the route level; the page gate (Sidebar role-check) is the
 * staff-only surface. Adding a separate auth layer here would be the
 * first time we did so for an ops-internal stats route and is out of
 * scope for this task.
 */

import { NextResponse } from 'next/server';
import { getTwilioCallbackStats } from '@/lib/integrations/sms';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stats = getTwilioCallbackStats();
  return NextResponse.json({ ok: true, ...stats });
}
