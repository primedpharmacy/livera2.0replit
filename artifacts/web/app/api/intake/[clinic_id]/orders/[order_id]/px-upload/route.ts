/**
 * POST /api/intake/:clinic_id/orders/:order_id/px-upload
 *
 * Receives a patient-uploaded prescription file (image or PDF) from the intake
 * success screen and attaches it to the order. Triggered only for the GLP-1
 * higher-dose path (ft_oq_9 === 'yes' AND ft_oq_10 === 'yes').
 *
 * Accepts multipart/form-data with a single `file` field.
 */
import { NextRequest, NextResponse } from 'next/server';
import { attachPxUpload } from '@/lib/api/fixtures/orders';
import type { ClinicId } from '@/types';

type Params = { params: Promise<{ clinic_id: string; order_id: string }> };

const MAX_BYTES = 10 * 1024 * 1024; // mirror fixture guard

export async function POST(req: NextRequest, { params }: Params) {
  const { clinic_id, order_id } = await params;
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Missing file field.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ message: 'File is larger than 10 MB.' }, { status: 413 });
    }

    // Encode the file as a data URL so the mock fixture can preview it later.
    // Real production storage would push to object storage and persist the URL.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = Buffer.from(bytes).toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    const order = await attachPxUpload(clinic_id as ClinicId, order_id, {
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
    const status = msg.includes('not found') ? 404 : 400;
    return NextResponse.json({ message: msg }, { status });
  }
}
