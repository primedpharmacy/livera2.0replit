/**
 * POST /api/intake/:clinic_id/orders/:order_id/px-upload
 *
 * Step 3 of the presigned-URL upload flow (Task-82). Called by the intake
 * success screen AFTER the browser has PUT the file directly to GCS. We:
 *   1. Confirm the object exists at the supplied path
 *   2. Set the ACL policy (clinic_id + order_id) on the object
 *   3. Attach the object_path to the order via attachPxUpload
 *
 * Accepts JSON: { object_path, filename, size, content_type }. No file bytes.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  attachPxUpload,
  PX_UPLOAD_ALLOWED_TYPES,
  PX_UPLOAD_MAX_BYTES,
} from '@/lib/api/fixtures/orders';
import {
  objectStorageService,
  getObjectStoredMetadata,
  ObjectNotFoundError,
} from '@/lib/storage/objectStorage';
import type { ClinicId } from '@/types';

type Params = { params: Promise<{ clinic_id: string; order_id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { clinic_id, order_id } = await params;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      object_path?: string;
      filename?: string;
    };
    const { object_path, filename } = body;

    if (!object_path || !filename) {
      return NextResponse.json(
        { message: 'object_path and filename are required' },
        { status: 400 },
      );
    }

    // Source of truth for size + content_type is GCS itself, not the client.
    // This stops a client from PUTting arbitrary bytes (e.g. a 50 MB .exe)
    // and then forging acceptable metadata in this finalize call.
    const stored = await getObjectStoredMetadata(object_path);

    if (!PX_UPLOAD_ALLOWED_TYPES.includes(stored.contentType)) {
      return NextResponse.json(
        {
          message:
            'Uploaded file type is not allowed — must be an image (JPG, PNG, WebP, HEIC) or PDF.',
        },
        { status: 415 },
      );
    }
    if (stored.size <= 0 || stored.size > PX_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        { message: 'Uploaded file size is out of range (must be 1 byte – 10 MB).' },
        { status: 413 },
      );
    }

    // Stamp the ACL so /api/storage/objects/... can gate access by clinic
    // AND by clinical role (Coach is excluded — non-clinical surface).
    await objectStorageService.setAclPolicy(object_path, {
      clinic_id,
      order_id,
      allowed_roles: ['Owner', 'Admin', 'Prescriber'],
      visibility: 'private',
    });

    const order = await attachPxUpload(clinic_id as ClinicId, order_id, {
      filename,
      size: stored.size,
      content_type: stored.contentType,
      object_path,
    });

    return NextResponse.json(
      {
        order_id: order.id,
        px_upload: order.px_upload,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      return NextResponse.json(
        { message: 'Upload did not complete — object not found in storage.' },
        { status: 404 },
      );
    }
    const msg = err instanceof Error ? err.message : 'Prescription upload failed';
    const status = msg.includes('not found') ? 404 : 400;
    return NextResponse.json({ message: msg }, { status });
  }
}
