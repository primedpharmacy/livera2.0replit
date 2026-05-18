/**
 * POST /api/orders/:clinic_id/:order_id/px-upload/reminder-retry
 *
 * Task-179 — Manual retry of a *failed* px-upload reminder.
 *
 * Task-129 surfaces Postmark Bounced/Failed reminder attempts on the order
 * timeline; this route lets staff supply a fresh recipient email and resend
 * the same reminder kind (first or final) without waiting for the daily cron
 * — which would simply re-fail against the same bad address. On success the
 * matching idempotency flag flips (same as the cron) so future sweeps skip
 * this order; on a fresh failure another reminder_failures entry is pushed.
 *
 * Access control (mirrors the manual reminder route):
 *   - Requires a verified session cookie. Anonymous → 401.
 *   - Requires write access on `orders` for the clinic in the URL, and the
 *     staff member's active clinic must match the URL clinic. Mismatch → 403.
 *   - Audit trail uses the verified session user (never CURRENT_USER).
 *
 * Body: { kind: 'first' | 'final', to_email: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { retryFailedPxUploadReminder } from '@/lib/api/fixtures/orders';
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
      event_type: 'px_upload_link_reminder_retry_denied',
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
      event_type:       'px_upload_link_reminder_retry_denied',
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

  const body = (await req.json().catch(() => ({}))) as {
    kind?: 'first' | 'final';
    to_email?: string;
  };

  if (body.kind !== 'first' && body.kind !== 'final') {
    return NextResponse.json(
      { message: "`kind` must be 'first' or 'final'." },
      { status: 400 },
    );
  }
  if (typeof body.to_email !== 'string' || body.to_email.trim() === '') {
    return NextResponse.json(
      { message: '`to_email` is required.' },
      { status: 400 },
    );
  }
  // Cheap shape check up front so an obviously bad address surfaces as a
  // 400 (validation) rather than the 409 fallback for INVALID_STATE.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to_email.trim())) {
    return NextResponse.json(
      { message: 'Please enter a valid recipient email.' },
      { status: 400 },
    );
  }

  try {
    const result = await retryFailedPxUploadReminder(
      clinic_id as ClinicId,
      order_id,
      { kind: body.kind, to_email: body.to_email },
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
    const msg = err instanceof Error ? err.message : 'Reminder retry failed';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
