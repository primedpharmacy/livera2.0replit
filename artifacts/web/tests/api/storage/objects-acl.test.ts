/**
 * Unit tests — GET /api/storage/objects/[...path] (Task-124)
 *
 * Locks down the session gate so the three negative branches (401
 * unauthenticated, 403 cross-clinic, 403 non-clinical role) and the 200
 * happy path stay green. Also asserts the `[AUDIT]` log line records the
 * cookie's user id (or `null` for the unauthenticated case) so a regression
 * that drops the audit trail would also fail.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/storage/objectStorage', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/storage/objectStorage')>();
  return {
    ...actual,
    objectStorageService: {
      getObjectEntityFile: vi.fn(async () => ({} as unknown)),
      getAclPolicy: vi.fn(async () => ({
        clinic_id: 'feeltru',
        order_id: 'order_demo',
        allowed_roles: null,
      })),
      streamObject: vi.fn(
        async () =>
          new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }),
      ),
    },
  };
});

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/storage/objects/[...path]/route';
import { SESSION_COOKIE_NAME, mintSessionCookieValue } from '@/lib/auth/session';

const PATH_PARAM = Promise.resolve({ path: ['uploads', 'abc123'] });

function makeRequest(uid?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (uid) {
    headers['cookie'] = `${SESSION_COOKIE_NAME}=${mintSessionCookieValue(uid)}`;
  }
  return new NextRequest('http://localhost/api/storage/objects/uploads/abc123', {
    headers,
  });
}

let logSpy: ReturnType<typeof vi.spyOn>;

function auditEntries(): Array<Record<string, unknown>> {
  return logSpy.mock.calls
    .filter((call) => call[0] === '[AUDIT]')
    .map((call) => call[1] as Record<string, unknown>);
}

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe('GET /api/storage/objects/[...path] — session gate', () => {
  it('returns 401 and audits user_id=null when no session cookie is present', async () => {
    const res = await GET(makeRequest(), { params: PATH_PARAM });

    expect(res.status).toBe(401);
    const audits = auditEntries();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      event_type: 'object_access_denied',
      reason: 'unauthenticated',
      user_id: null,
    });
  });

  it('returns 403 for a clinical user in the wrong clinic (cross-clinic leak guard)', async () => {
    // Yohan is an Admin on `vsc`; the object belongs to `feeltru`.
    const res = await GET(makeRequest('user_yohan'), { params: PATH_PARAM });

    expect(res.status).toBe(403);
    const audits = auditEntries();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      event_type: 'object_access_denied',
      reason: 'cross_clinic_or_role_mismatch',
      user_id: 'user_yohan',
      active_clinic_id: 'vsc',
      object_clinic_id: 'feeltru',
    });
  });

  it('returns 403 for a Coach in the right clinic (non-clinical role)', async () => {
    // Olwyn is a Coach on `feeltru` — same clinic as the object, but Coach
    // is not in the CLINICAL_ROLES allow-list.
    const res = await GET(makeRequest('user_olwyn'), { params: PATH_PARAM });

    expect(res.status).toBe(403);
    const audits = auditEntries();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      event_type: 'object_access_denied',
      reason: 'non_clinical_role',
      user_id: 'user_olwyn',
      active_clinic_id: 'feeltru',
    });
  });

  it('returns 200 for an Owner in the right clinic and audits the grant', async () => {
    // Qadir is an Owner on `feeltru` — clinical role + matching clinic.
    const res = await GET(makeRequest('user_qadir'), { params: PATH_PARAM });

    expect(res.status).toBe(200);
    const audits = auditEntries();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      event_type: 'object_access_granted',
      user_id: 'user_qadir',
      clinic_id: 'feeltru',
    });
  });
});
