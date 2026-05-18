/**
 * POST /api/orders/:clinic_id/:order_id/px-upload-reminder
 *
 * Task-130 — Manual px-upload reminder from Order Detail.
 *
 * Lets staff nudge a patient on demand without waiting for the daily cron
 * (sendPxUploadReminders). Reuses sendPxUploadReminderEmail and flips the
 * same idempotency flag the sweep does, so the next scheduled run skips
 * this order.
 *
 * Access control (Task-130 review fix):
 *   - Requires a verified session cookie. Anonymous traffic → 401.
 *   - Requires write access on `orders` for the clinic in the URL, and
 *     the staff member's active clinic must match. Mismatch → 403.
 *   - The audit trail uses the verified session user (not CURRENT_USER).
 */
import { NextRequest, NextResponse } from 'next/server';
import { sendPxUploadReminderNow } from '@/lib/api/fixtures/orders';
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
      event_type:  'px_upload_link_manual_reminder_denied',
      reason:      'unauthenticated',
      clinic_id,
      order_id,
      timestamp:   NOW,
    });
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // Staff must be acting in the clinic that owns the order and must have
  // write access on orders. UI gating is not sufficient — anyone with a
  // signed session for any clinic could otherwise POST here.
  const clinicMatches  = user.active_clinic_id === clinic_id;
  const canWriteOrders = can(user, 'write', 'orders');
  if (!clinicMatches || !canWriteOrders) {
    console.log('[AUDIT]', {
      event_type:       'px_upload_link_manual_reminder_denied',
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
    const result = await sendPxUploadReminderNow(
      clinic_id as ClinicId,
      order_id,
      { user_id: user.id },
    );
    return NextResponse.json(
      {
        order_id:       result.order.id,
        kind:           result.kind,
        status:         result.status,
        message_id:     result.message_id,
        px_upload_link: result.order.px_upload_link,
      },
      { status: result.status === 'Delivered' ? 200 : 502 },
    );
  } catch (err) {
    if (err instanceof APIError) {
      const status =
        err.code === 'NOT_FOUND' ? 404 :
        err.code === 'INVALID_STATE' ? 409 :
        400;
      return NextResponse.json({ message: err.message }, { status });
    }
    const msg = err instanceof Error ? err.message : 'Reminder send failed';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
