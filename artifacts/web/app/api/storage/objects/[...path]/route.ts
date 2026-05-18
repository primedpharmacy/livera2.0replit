/**
 * GET /api/storage/objects/<path...>
 *
 * Streams a private object out of GCS, gated by the ACL policy stored on
 * the object's custom metadata. Only clinical staff whose active clinic
 * matches the object's `clinic_id` may read it (Task-82 ACL).
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  objectStorageService,
  canStaffAccessObject,
  ObjectNotFoundError,
} from '@/lib/storage/objectStorage';
import { CURRENT_USER, NOW } from '@/lib/api/constants';

type Params = { params: Promise<{ path: string[] }> };

// Clinical staff allowed to view patient-uploaded evidence. Coach is
// intentionally excluded — they have no clinical surface (see lib/permissions.ts).
const CLINICAL_ROLES = ['Owner', 'Admin', 'Prescriber'];

export async function GET(_req: NextRequest, { params }: Params) {
  const { path } = await params;
  const objectPath = `/objects/${(path ?? []).join('/')}`;
  try {
    const file = await objectStorageService.getObjectEntityFile(objectPath);
    const policy = await objectStorageService.getAclPolicy(file);

    const staff = {
      active_clinic_id: CURRENT_USER.active_clinic_id,
      roles: CURRENT_USER.roles as string[],
    };

    // Role gate first — staff must be clinical regardless of clinic match.
    const isClinical = staff.roles.some((r) => CLINICAL_ROLES.includes(r));
    if (!isClinical || !canStaffAccessObject(policy, staff)) {
      console.log('[AUDIT]', {
        event_type: 'object_access_denied',
        reason: !isClinical ? 'non_clinical_role' : 'cross_clinic_or_role_mismatch',
        object_path: objectPath,
        user_id: CURRENT_USER.id,
        user_roles: staff.roles,
        active_clinic_id: staff.active_clinic_id,
        object_clinic_id: policy?.clinic_id ?? null,
        timestamp: NOW,
      });
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    console.log('[AUDIT]', {
      event_type: 'object_access_granted',
      object_path: objectPath,
      user_id: CURRENT_USER.id,
      clinic_id: policy?.clinic_id,
      order_id: policy?.order_id ?? null,
      timestamp: NOW,
    });

    return await objectStorageService.streamObject(file);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      return NextResponse.json({ message: 'Object not found' }, { status: 404 });
    }
    const msg = err instanceof Error ? err.message : 'Failed to serve object';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
