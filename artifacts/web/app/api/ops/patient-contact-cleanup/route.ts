/**
 * Read-only summary of the patient contact-data cleanup backlog — Task-249.
 *
 * GET /api/ops/patient-contact-cleanup?clinic_id=vsc
 *
 * Runs `cleanupPatientContactData` in dry-run mode so the sidebar can
 * surface a badge count of patients still needing manual chase-up without
 * mutating fixtures or emitting audit lines.
 *
 * Authentication
 * --------------
 * Returns counts only — never the raw `needs_followup` payload — because
 * those rows include patient identifiers and the (bad) phone/postcode
 * values they hold, which are sensitive PII. Even so, the endpoint is
 * gated behind the same `read`/`settings` permission as the page it
 * feeds, so anonymous callers can't probe per-clinic backlog sizes.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { cleanupPatientContactData } from '@/lib/api/jobs/cleanupPatientContactData';
import { getSessionUser } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import type { ClinicId } from '@/lib/api/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = getSessionUser(req);
  if (!actor) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }
  if (!can(actor, 'read', 'settings')) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const raw = url.searchParams.get('clinic_id');
  if (raw !== 'vsc' && raw !== 'feeltru') {
    // Mirror the server action: never silently fall back to an
    // all-clinic scope on invalid input, even for a read-only count.
    return NextResponse.json(
      { ok: false, error: 'invalid or missing clinic_id' },
      { status: 400 },
    );
  }
  const clinicId = raw as ClinicId;

  const result = await cleanupPatientContactData(clinicId, { dryRun: true });

  return NextResponse.json({
    ok:             true,
    followup_count: result.needs_followup.length,
    scanned:        result.scanned,
  });
}
