/**
 * GET  /api/questionnaires/:clinic_id → { order, reorder }
 * PUT  /api/questionnaires/:clinic_id ← { order, reorder } → { order, reorder }
 *
 * Staff-only — both GET and PUT require an authenticated session (Task-122).
 * The questionnaire defines clinical intake fields and the reorder rules that
 * gate restock; anonymous callers must not be able to read or mutate them.
 */
import { type NextRequest } from 'next/server';
import { getQuestionnaire, updateQuestionnaire } from '@/lib/api/fixtures/clinics';
import { getSessionUser } from '@/lib/auth/session';
import type { ClinicId } from '@/types';

type Params = { params: Promise<{ clinic_id: string }> };

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(req: NextRequest, { params }: Params) {
  const { clinic_id } = await params;
  if (!getSessionUser(req)) return err('Unauthorized', 401);
  try {
    const raw = getQuestionnaire(clinic_id as ClinicId);
    // Safely strip non-JSON-safe values before serialisation
    const data = JSON.parse(JSON.stringify(raw));
    return ok(data);
  } catch (e) {
    console.error('[questionnaire GET]', e);
    return err('Clinic not found', 404);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { clinic_id } = await params;
  if (!getSessionUser(req)) return err('Unauthorized', 401);
  try {
    const body = await req.json() as { order?: unknown[]; reorder?: unknown[] };
    const raw = updateQuestionnaire(
      clinic_id as ClinicId,
      body.order,
      body.reorder,
    );
    const data = JSON.parse(JSON.stringify(raw));
    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Update failed';
    return err(msg);
  }
}
