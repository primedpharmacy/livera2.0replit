/**
 * Cron route handler — Task-74.
 *
 * GET|POST /api/cron/retry-patient-notifications
 *
 * Runs `retryFailedPatientNotifications` across every clinic once and returns
 * a per-clinic summary. Intended for external schedulers (e.g. Vercel Cron,
 * uptime pings) as a belt-and-braces companion to the in-process scheduler
 * booted from `instrumentation.ts`.
 *
 * Auth:
 *   If the env var CRON_SECRET is set, requests must present a matching
 *   bearer token (Authorization: Bearer <secret>) — Vercel Cron does this
 *   automatically. If CRON_SECRET is unset (e.g. local dev), the endpoint is
 *   open so it can be triggered with curl during ops work.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runPatientNotificationRetrySweep } from '@/lib/api/jobs/scheduler';

export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const summaries = await runPatientNotificationRetrySweep();
  return NextResponse.json({ ok: true, clinics: summaries });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
