/**
 * Unit tests — POST /api/orders/:clinic_id/:order_id/px-upload/reminder-retry
 *
 * Task-179 added the manual retry route. This spec pins the access-control
 * matrix (anonymous, cross-clinic, role-without-orders-write), the body
 * validation (missing/invalid kind, missing/invalid email), and the two
 * outcome status codes the UI keys off:
 *
 *   - 200 when the retry was delivered (timeline flips to a success row)
 *   - 502 when the retry still bounced/failed (timeline gets a new
 *     reminder_failures row and the dialog stays open with an error)
 *
 * Both fixture and session lookups are mocked so the tests assert this
 * route's own contract — auth gating, body shape, status-code branching
 * — rather than re-asserting the fixture logic already covered by
 * retryFailedPxUploadReminder.test.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import type { User } from '@/lib/api/types';

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn(),
}));
vi.mock('@/lib/api/fixtures/orders', () => ({
  retryFailedPxUploadReminder: vi.fn(),
}));

import { POST } from '../route';
import { getSessionUser } from '@/lib/auth/session';
import { retryFailedPxUploadReminder } from '@/lib/api/fixtures/orders';
import { APIError } from '@/lib/api/constants';

const OWNER: User = {
  id: 'user_qadir',
  email: 'qadir@livera.health',
  full_name: 'Qadir Hussain',
  roles: ['Owner'],
  active_clinic_id: 'feeltru',
  professional_registrations: [],
  active: true,
  can_refund: true,
};

const CROSS_CLINIC_OWNER: User = {
  ...OWNER,
  id: 'user_yohan',
  email: 'yohan@livera.health',
  full_name: 'Yohan Perera',
  roles: ['Owner'],
  active_clinic_id: 'vsc',
};

const COACH: User = {
  ...OWNER,
  id: 'user_coach',
  email: 'coach@livera.health',
  full_name: 'Coach Persona',
  roles: ['Coach'],
};

function buildReq(body: unknown): {
  req: NextRequest;
  params: Promise<{ clinic_id: string; order_id: string }>;
} {
  const req = new Request('http://localhost/api/orders/feeltru/ORD-1/px-upload/reminder-retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
  return {
    req,
    params: Promise.resolve({ clinic_id: 'feeltru', order_id: 'ORD-1' }),
  };
}

const VALID_BODY = { kind: 'first' as const, to_email: 'fixed@example.com' };

beforeEach(() => {
  vi.mocked(getSessionUser).mockReset();
  vi.mocked(retryFailedPxUploadReminder).mockReset();
});

describe('POST reminder-retry — access control', () => {
  it('returns 401 when the request is anonymous', async () => {
    vi.mocked(getSessionUser).mockReturnValue(null);
    const { req, params } = buildReq(VALID_BODY);

    const res = await POST(req, { params });
    expect(res.status).toBe(401);
    expect(retryFailedPxUploadReminder).not.toHaveBeenCalled();
  });

  it('returns 403 when the staff user belongs to a different clinic', async () => {
    vi.mocked(getSessionUser).mockReturnValue(CROSS_CLINIC_OWNER);
    const { req, params } = buildReq(VALID_BODY);

    const res = await POST(req, { params });
    expect(res.status).toBe(403);
    expect(retryFailedPxUploadReminder).not.toHaveBeenCalled();
  });

  it('returns 403 when the staff role lacks orders:write (e.g. Coach)', async () => {
    vi.mocked(getSessionUser).mockReturnValue(COACH);
    const { req, params } = buildReq(VALID_BODY);

    const res = await POST(req, { params });
    expect(res.status).toBe(403);
    expect(retryFailedPxUploadReminder).not.toHaveBeenCalled();
  });
});

describe('POST reminder-retry — body validation', () => {
  beforeEach(() => {
    vi.mocked(getSessionUser).mockReturnValue(OWNER);
  });

  it('returns 400 when kind is missing or invalid', async () => {
    const { req, params } = buildReq({ to_email: 'fixed@example.com' });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/kind/i);
    expect(retryFailedPxUploadReminder).not.toHaveBeenCalled();
  });

  it('returns 400 when to_email is missing', async () => {
    const { req, params } = buildReq({ kind: 'first' });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/to_email/);
  });

  it('returns 400 when to_email is malformed', async () => {
    const { req, params } = buildReq({ kind: 'first', to_email: 'not-an-email' });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/valid recipient email/i);
    expect(retryFailedPxUploadReminder).not.toHaveBeenCalled();
  });

  it('returns 400 when the body is not valid JSON', async () => {
    const { req, params } = buildReq('not-json');
    const res = await POST(req, { params });
    // Empty parse → `kind` missing → 400.
    expect(res.status).toBe(400);
  });
});

describe('POST reminder-retry — outcome branching', () => {
  beforeEach(() => {
    vi.mocked(getSessionUser).mockReturnValue(OWNER);
  });

  it('returns 200 with px_upload_link snapshot when the retry was delivered', async () => {
    const link = {
      token: 'tok-1',
      expires_at: '2026-05-20T08:00:00Z',
      sent_at: '2026-05-05T08:00:00Z',
      consumed_at: null,
      email_message_id: 'pm-id',
      to_email: 'fixed@example.com',
      reminder_sent_at: '2026-05-12T09:00:00Z',
      final_reminder_sent_at: null,
      reminder_failures: [{
        kind: 'first' as const,
        attempted_at: '2026-05-11T08:00:00Z',
        to_email: 'wrong@example.com',
        status: 'Bounced' as const,
        error_message: 'hard bounce',
      }],
    };
    vi.mocked(retryFailedPxUploadReminder).mockResolvedValue({
      // Only the fields the route reads are required; cast to satisfy the
      // return type without hand-rolling a full Order fixture.
      order: { id: 'ORD-1', px_upload_link: link } as never,
      kind: 'first',
      status: 'Delivered',
      message_id: 'pm-id',
    });

    const { req, params } = buildReq(VALID_BODY);
    const res = await POST(req, { params });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      order_id: 'ORD-1',
      kind: 'first',
      status: 'Delivered',
      message_id: 'pm-id',
      px_upload_link: link,
    });
    expect(retryFailedPxUploadReminder).toHaveBeenCalledWith(
      'feeltru',
      'ORD-1',
      { kind: 'first', to_email: 'fixed@example.com' },
      { user_id: 'user_qadir' },
    );
  });

  it('returns 502 when the retry was sent but still bounced/failed', async () => {
    vi.mocked(retryFailedPxUploadReminder).mockResolvedValue({
      order: { id: 'ORD-1', px_upload_link: null } as never,
      kind: 'first',
      status: 'Failed',
      message_id: null,
    });

    const { req, params } = buildReq(VALID_BODY);
    const res = await POST(req, { params });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.status).toBe('Failed');
  });

  it('returns 404 when the fixture raises NOT_FOUND', async () => {
    vi.mocked(retryFailedPxUploadReminder).mockRejectedValue(
      new APIError('NOT_FOUND', 'Order ORD-1 not found'),
    );
    const { req, params } = buildReq(VALID_BODY);
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
  });

  it('returns 409 when the fixture raises INVALID_STATE (e.g. link expired)', async () => {
    vi.mocked(retryFailedPxUploadReminder).mockRejectedValue(
      new APIError('INVALID_STATE', 'Upload link has expired — send a fresh link instead.'),
    );
    const { req, params } = buildReq(VALID_BODY);
    const res = await POST(req, { params });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toMatch(/expired/);
  });
});
