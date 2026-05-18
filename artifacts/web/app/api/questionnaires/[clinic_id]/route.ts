/**
 * GET  /api/questionnaires/:clinic_id → { order, reorder }
 * PUT  /api/questionnaires/:clinic_id ← { order, reorder } → { order, reorder }
 */
import { type NextRequest } from 'next/server';
import { getQuestionnaire, updateQuestionnaire } from '@/lib/api/fixtures/clinics';
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

export async function GET(_req: NextRequest, { params }: Params) {
  const { clinic_id } = await params;
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
