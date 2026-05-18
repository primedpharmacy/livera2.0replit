/**
 * POST /api/intake/:clinic_id/orders/:order_id/px-upload/request-url
 *
 * Step 1 of the presigned-URL upload flow for the GLP-1 higher-dose
 * prescription. Validates that:
 *   - the order exists in the given clinic
 *   - the order is on the GLP-1 higher-dose path (ft_oq_9/ft_oq_10 both yes)
 *   - the proposed file's size + content type are acceptable
 *
 * Returns a presigned PUT URL the browser will upload to directly, plus the
 * `object_path` that should be passed back to the finalize endpoint.
 */
import { NextRequest, NextResponse } from 'next/server';
import { findOrderForPxUpload, PX_UPLOAD_ALLOWED_TYPES, PX_UPLOAD_MAX_BYTES } from '@/lib/api/fixtures/orders';
import { objectStorageService } from '@/lib/storage/objectStorage';
import type { ClinicId } from '@/types';
import { NOW } from '@/lib/api/constants';

type Params = { params: Promise<{ clinic_id: string; order_id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { clinic_id, order_id } = await params;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      filename?: string;
      size?: number;
      content_type?: string;
    };
    const { filename, size, content_type } = body;

    if (!filename || typeof size !== 'number' || !content_type) {
      return NextResponse.json(
        { message: 'filename, size and content_type are required' },
        { status: 400 },
      );
    }
    if (!PX_UPLOAD_ALLOWED_TYPES.includes(content_type)) {
      return NextResponse.json(
        { message: 'Prescription must be an image (JPG, PNG, WebP, HEIC) or PDF.' },
        { status: 415 },
      );
    }
    if (size <= 0 || size > PX_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        { message: 'Prescription file must be between 1 byte and 10 MB.' },
        { status: 413 },
      );
    }

    // Throws if the order is missing or not on the GLP-1 higher-dose path.
    findOrderForPxUpload(clinic_id as ClinicId, order_id);

    const { uploadURL, objectPath } = await objectStorageService.createUploadUrl();

    console.log('[AUDIT]', {
      event_type: 'px_upload_url_issued',
      clinic_id,
      order_id,
      object_path: objectPath,
      filename,
      size,
      content_type,
      timestamp: NOW,
    });

    return NextResponse.json({ uploadURL, object_path: objectPath }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to issue upload URL';
    const status = msg.includes('not found') ? 404 : msg.includes('GLP-1') ? 403 : 400;
    return NextResponse.json({ message: msg }, { status });
  }
}
