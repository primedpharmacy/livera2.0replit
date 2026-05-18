/**
 * POST /api/orders/:clinic_id/:order_id/px-upload/mark-called
 *
 * Task-269 — Clear the px-upload auto-chase escalation after staff have
 * spoken to the patient.
 *
 * The Awaiting Px upload widget surfaces escalated rows with a red
 * "Call patient" badge. Once a staff member has actually phoned the
 * patient they hit "Mark called" which lands here; we drop the
 * "Px upload chase escalated" contextual flag, clear
 * `auto_chase_escalated_at`, and reset `auto_resends` so the cron is
 * allowed to resume nudging if the patient still doesn't upload.
 *
 * Access control mirrors the manual-reminder route:
 *   - Requires a verified session cookie. Anonymous → 401.
 *   - Requires write access on `orders` for the clinic in the URL, and
 *     the staff member's active clinic must match. Mismatch → 403.
 */
import { NextRequest, NextResponse } from 'next/server';
import { clearPxUploadChaseEscalation } from '@/lib/api/fixtures/orders';
import { APIError, NOW } from '@/lib/api/constants';
import { getSessionUser } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import type { ClinicId } from '@/types';

type Params = { params: Promise<{ clinic_id: string; order_id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { clinic_id, order_id } = await params;

  const user = getSessionUser(req);
  if (!user) {
    console.log('[AUDIT]', {
      event_type: 'px_upload_auto_chase_clear_denied',
      reason:     'unauthenticated',
      clinic_id,
      order_id,
      timestamp:  NOW,
    });
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const clinicMatches  = user.active_clinic_id === clinic_id;
  const canWriteOrders = can(user, 'write', 'orders');
  if (!clinicMatches || !canWriteOrders) {
    console.log('[AUDIT]', {
      event_type:       'px_upload_auto_chase_clear_denied',
      reason:           !clinicMatches ? 'cross_clinic' : 'role_lacks_orders_write',
      clinic_id,
      order_id,
      user_id:          user.id,
      user_roles:       user.roles,
      active_clinic_id: user.active_clinic_id,
      timestamp:        NOW,
    });
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  try {
    const order = await clearPxUploadChaseEscalation(
      clinic_id as ClinicId,
      order_id,
      { actor: user },
    );
    return NextResponse.json(
      {
        order_id:         order.id,
        contextual_flags: order.contextual_flags ?? [],
        px_upload_link:   order.px_upload_link,
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof APIError) {
      const status =
        err.code === 'NOT_FOUND' ? 404 :
        err.code === 'INVALID_STATE' ? 409 :
        400;
      return NextResponse.json({ message: err.message }, { status });
    }
    const msg = err instanceof Error ? err.message : 'Mark-called failed';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
