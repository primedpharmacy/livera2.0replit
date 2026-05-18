/**
 * Read-only summary of recent retry sweeps — Task-156.
 *
 * GET /api/ops/retry-sweeps
 *
 * Returns the failed-sweep count from the in-process ring buffer plus the
 * latest sweep's outcome + id so the sidebar can surface a red badge and
 * emit a one-shot toast when the most recent sweep transitions to failed.
 *
 * No auth — same trust boundary as the existing /ops/retry-sweeps page.
 */

import { NextResponse } from 'next/server';
import { getRecentRetrySweeps } from '@/lib/api/jobs/scheduler';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = getRecentRetrySweeps(100);
  const failed_count = rows.filter((r) => r.outcome === 'error').length;

  // Aggregate at the sweep level (not per-clinic-row). A sweep is "failed" if
  // any clinic row in that sweep_id threw — so multi-clinic runs where one
  // clinic fails still correctly trip the toast even if rows[0] happens to
  // be a successful clinic.
  const newest = rows[0];
  let latest = null as null | {
    sweep_id: string;
    outcome: 'success' | 'error';
    timestamp: string;
    failed_clinics: string[];
    error_message: string | null;
  };
  if (newest) {
    const sweepRows = rows.filter((r) => r.sweep_id === newest.sweep_id);
    const failedRows = sweepRows.filter((r) => r.outcome === 'error');
    const firstFail = failedRows[0];
    latest = {
      sweep_id:       newest.sweep_id,
      outcome:        failedRows.length > 0 ? 'error' : 'success',
      timestamp:      newest.timestamp,
      failed_clinics: failedRows.map((r) => r.clinic_id),
      error_message:  firstFail?.error_message ?? null,
    };
  }

  return NextResponse.json({ ok: true, failed_count, latest });
}
