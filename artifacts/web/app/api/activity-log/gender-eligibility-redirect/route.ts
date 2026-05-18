/**
 * POST /api/activity-log/gender-eligibility-redirect
 *
 * Receives a single privacy-safe activity-log event when a FeelTru
 * applicant is redirected to VSC by the women-only gender gate
 * (DEC-16, Wave 9b Chunk 10).
 *
 * Auth: PATIENT-FACING — the redirect happens before any account
 * exists, so there is no staff actor.
 *
 * Privacy contract (BLD-10.4 — critical rule):
 *   The persisted event MUST contain `clinic_id` and `timestamp`
 *   ONLY. No name, email, IP, user agent, or any other identifier
 *   may be recorded. We explicitly do NOT read req.headers for
 *   x-forwarded-for, user-agent, or cookies.
 *
 * The body is validated: any extra keys the client sends are
 * dropped before logging.
 */
import { NextRequest, NextResponse } from 'next/server';

type Body = {
  event?: string;
  clinic_id?: string;
  timestamp?: string;
};

// Only clinics that actually run the women-only gate may emit this
// event. Today that's FeelTru only (DEC-16); tightening the allow-list
// keeps telemetry noise down and enforces the domain semantics.
const ALLOWED_CLINICS = new Set(['feeltru']);

export async function POST(req: NextRequest) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.event !== 'gender_eligibility_redirect_occurred') {
    return NextResponse.json({ message: 'Unknown event' }, { status: 400 });
  }
  const clinicId = (body.clinic_id ?? '').trim();
  if (!ALLOWED_CLINICS.has(clinicId)) {
    return NextResponse.json({ message: 'Unknown clinic' }, { status: 400 });
  }

  // Privacy-safe record — clinic_id + timestamp only, by construction.
  // (Server-side timestamp; we ignore body.timestamp to prevent clients
  // from spoofing time and because it isn't strictly required.)
  const entry = {
    event: 'gender_eligibility_redirect_occurred' as const,
    clinic_id: clinicId,
    timestamp: new Date().toISOString(),
  };

  // The fixture/demo backend has no activity-log table yet. We surface
  // the event via a structured console line so it shows up in workflow
  // logs and so any future log shipper can pick it up unchanged.
  // eslint-disable-next-line no-console
  console.log('[activity_log]', JSON.stringify(entry));

  return new NextResponse(null, { status: 204 });
}
