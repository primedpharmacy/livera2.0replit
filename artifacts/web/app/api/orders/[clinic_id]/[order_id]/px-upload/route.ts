/**
 * POST /api/orders/:clinic_id/:order_id/px-upload
 *
 * Task-85 — Staff-side finalize for the GLP-1 prescription presigned-URL flow.
 * Mirrors the patient intake finalize at
 *   /api/intake/:clinic_id/orders/:order_id/px-upload
 * but tags the attach call with source='staff_upload' and the authenticated
 * staff user as the actor so the audit trail records who uploaded on the
 * patient's behalf (Task-122: no fallback to CURRENT_USER — anonymous
 * callers must 401).
 *
 * The browser uploads the file bytes to GCS via the same presigned URL the
 * patient flow uses (request-url route), so we only finalize here.
 *
 * Accepts JSON: { object_path, filename }. No file bytes.
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
import { getSessionUser } from '@/lib/auth/session';
import type { ClinicId } from '@/types';

type Params = { params: Promise<{ clinic_id: string; order_id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { clinic_id, order_id } = await params;
  const user = getSessionUser(req);
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
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

    await objectStorageService.setAclPolicy(object_path, {
      clinic_id,
      order_id,
      allowed_roles: ['Owner', 'Admin', 'Prescriber'],
      visibility: 'private',
    });

    const order = await attachPxUpload(
      clinic_id as ClinicId,
      order_id,
      {
        filename,
        size: stored.size,
        content_type: stored.contentType,
        object_path,
      },
      { user_id: user.id, source: 'staff_upload' },
    );

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
