/**
 * Task-80 — Tokenised "complete later" prescription upload.
 *
 * GET  /api/intake/:clinic_id/px-upload-link/:token
 *   Returns { ok: true, order_id, expires_at } if the token is valid, or
 *   { ok: false, reason } when not_found / expired / consumed. Used by the
 *   patient-facing page to render the right state without revealing PHI.
 *
 * POST /api/intake/:clinic_id/px-upload-link/:token
 *   Receives a multipart/form-data file from the patient-facing page and
 *   attaches it to the order linked to the token. Single-use: a consumed
 *   token returns 410 Gone on retry.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  attachPxUploadByToken,
  getOrderByPxUploadToken,
} from '@/lib/api/fixtures/orders';
import type { ClinicId } from '@/types';

type Params = { params: Promise<{ clinic_id: string; token: string }> };

const MAX_BYTES = 10 * 1024 * 1024;

export async function GET(_req: NextRequest, { params }: Params) {
  const { clinic_id, token } = await params;
  const lookup = await getOrderByPxUploadToken(clinic_id as ClinicId, token);
  if (!lookup.ok) {
    const status =
      lookup.reason === 'expired' ? 410 :
      lookup.reason === 'consumed' ? 410 :
      404;
    return NextResponse.json({ ok: false, reason: lookup.reason }, { status });
  }
  return NextResponse.json({
    ok: true,
    order_id: lookup.order.id,
    expires_at: lookup.order.px_upload_link?.expires_at,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { clinic_id, token } = await params;
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Missing file field.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ message: 'File is larger than 10 MB.' }, { status: 413 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = Buffer.from(bytes).toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    const order = await attachPxUploadByToken(clinic_id as ClinicId, token, {
      filename: file.name,
      size: file.size,
      content_type: file.type,
      data_url: dataUrl,
    });

    return NextResponse.json(
      {
        order_id: order.id,
        px_upload: {
          filename: order.px_upload?.filename,
          size: order.px_upload?.size,
          content_type: order.px_upload?.content_type,
          uploaded_at: order.px_upload?.uploaded_at,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Prescription upload failed';
    const lower = msg.toLowerCase();
    const status =
      lower.includes('expired') ? 410 :
      lower.includes('already been used') ? 410 :
      lower.includes('not valid') || lower.includes('not found') ? 404 :
      400;
    return NextResponse.json({ message: msg }, { status });
  }
}
