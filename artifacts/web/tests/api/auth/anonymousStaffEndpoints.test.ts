/**
 * Unit tests — anonymous-visitor auth gates on staff routes (Task-195).
 *
 * Task-122 added `getSessionUser` to the staff prescription-upload finalize
 * and to the questionnaire GET/PUT, and documented the patient intake routes
 * as deliberately exempt. This suite locks both halves down:
 *
 *   1. Staff routes must return 401 when the `livera_session_uid` cookie is
 *      absent — a regression would silently re-open the demo Owner
 *      impersonation hole.
 *   2. Patient `/api/intake/**` routes must NOT return 401 without a
 *      cookie — their auth model is "anonymous + tokenised link / order
 *      lookup", so a future change that accidentally adds a session gate
 *      would break the intake form.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Object storage is stubbed so the intake px-upload routes don't try to talk
// to GCS — we only care that they don't return 401 before reaching their own
// validation/business logic.
vi.mock('@/lib/storage/objectStorage', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/storage/objectStorage')>();
  return {
    ...actual,
    objectStorageService: {
      createUploadUrl: vi.fn(async () => ({
        uploadURL: 'https://example.test/put',
        objectPath: '/objects/uploads/test',
      })),
      setAclPolicy: vi.fn(async () => undefined),
    },
    getObjectStoredMetadata: vi.fn(async () => ({
      size: 1024,
      contentType: 'application/pdf',
    })),
    serverSideUpload: vi.fn(async () => ({ object_path: '/objects/uploads/x' })),
  };
});

import { POST as STAFF_PX_UPLOAD_POST } from '@/app/api/orders/[clinic_id]/[order_id]/px-upload/route';
import {
  GET as QUESTIONNAIRE_GET,
  PUT as QUESTIONNAIRE_PUT,
} from '@/app/api/questionnaires/[clinic_id]/route';
import { POST as INTAKE_POST } from '@/app/api/intake/[clinic_id]/route';
import { POST as INTAKE_PX_UPLOAD_POST } from '@/app/api/intake/[clinic_id]/orders/[order_id]/px-upload/route';
import { POST as INTAKE_PX_REQUEST_URL_POST } from '@/app/api/intake/[clinic_id]/orders/[order_id]/px-upload/request-url/route';
import {
  GET as INTAKE_PX_LINK_GET,
  POST as INTAKE_PX_LINK_POST,
} from '@/app/api/intake/[clinic_id]/px-upload-link/[token]/route';

function anonRequest(
  url: string,
  init: RequestInit = {},
): NextRequest {
  // No `cookie` header → no `livera_session_uid` → anonymous.
  return new NextRequest(url, init);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Staff endpoints — anonymous visitors get 401', () => {
  it('POST /api/orders/:clinic/:order/px-upload → 401 without session cookie', async () => {
    const req = anonRequest(
      'http://localhost/api/orders/feeltru/order_demo/px-upload',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_path: '/x', filename: 'a.pdf' }),
      },
    );
    const res = await STAFF_PX_UPLOAD_POST(req, {
      params: Promise.resolve({ clinic_id: 'feeltru', order_id: 'order_demo' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/unauthorized/i);
  });

  it('GET /api/questionnaires/:clinic → 401 without session cookie', async () => {
    const req = anonRequest('http://localhost/api/questionnaires/feeltru');
    const res = await QUESTIONNAIRE_GET(req, {
      params: Promise.resolve({ clinic_id: 'feeltru' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/unauthorized/i);
  });

  it('PUT /api/questionnaires/:clinic → 401 without session cookie', async () => {
    const req = anonRequest('http://localhost/api/questionnaires/feeltru', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: [], reorder: [] }),
    });
    const res = await QUESTIONNAIRE_PUT(req, {
      params: Promise.resolve({ clinic_id: 'feeltru' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/unauthorized/i);
  });
});

describe('Patient intake endpoints — exempt from staff session gate', () => {
  it('POST /api/intake/:clinic reaches its own validation anonymously (400, not 401)', async () => {
    // Empty body → the route's own biometrics validation rejects with 400.
    // Pinning the exact status (rather than just "not 401") catches a
    // regression where the route silently returns 500 from infra failures.
    const req = anonRequest('http://localhost/api/intake/feeltru', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await INTAKE_POST(req, {
      params: Promise.resolve({ clinic_id: 'feeltru' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).not.toMatch(/unauthorized/i);
  });

  it('POST /api/intake/:clinic/orders/:order/px-upload reaches its own logic anonymously (404 for unknown order, not 401)', async () => {
    const req = anonRequest(
      'http://localhost/api/intake/feeltru/orders/order_does_not_exist/px-upload',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_path: '/objects/uploads/x', filename: 'a.pdf' }),
      },
    );
    const res = await INTAKE_PX_UPLOAD_POST(req, {
      params: Promise.resolve({
        clinic_id: 'feeltru',
        order_id: 'order_does_not_exist',
      }),
    });
    // The route reaches attachPxUpload which fails with "not found" → 404.
    // The key invariant for Task-195 is that anonymous callers can reach
    // domain logic at all (no session gate).
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).not.toMatch(/unauthorized/i);
  });

  it('POST /api/intake/:clinic/orders/:order/px-upload/request-url reaches its own logic anonymously (404 for unknown order, not 401)', async () => {
    const req = anonRequest(
      'http://localhost/api/intake/feeltru/orders/order_does_not_exist/px-upload/request-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'a.pdf',
          size: 1024,
          content_type: 'application/pdf',
        }),
      },
    );
    const res = await INTAKE_PX_REQUEST_URL_POST(req, {
      params: Promise.resolve({
        clinic_id: 'feeltru',
        order_id: 'order_does_not_exist',
      }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).not.toMatch(/unauthorized/i);
  });

  it('GET /api/intake/:clinic/px-upload-link/:token reaches its own logic anonymously (404 for unknown token, not 401)', async () => {
    const req = anonRequest(
      'http://localhost/api/intake/feeltru/px-upload-link/does-not-exist',
    );
    const res = await INTAKE_PX_LINK_GET(req, {
      params: Promise.resolve({ clinic_id: 'feeltru', token: 'does-not-exist' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('not_found');
  });

  it('POST /api/intake/:clinic/px-upload-link/:token reaches its own validation anonymously (400 missing file, not 401)', async () => {
    // Build the multipart request via the standard Request constructor so
    // the runtime sets the multipart boundary in Content-Type, then wrap
    // it in a NextRequest with no session cookie. The route's own
    // validation rejects with 400 "Missing file field.", proving the
    // session gate is not in front of it.
    const form = new FormData();
    form.append('not_file', 'placeholder');
    const raw = new Request(
      'http://localhost/api/intake/feeltru/px-upload-link/some-token',
      { method: 'POST', body: form },
    );
    const req = new NextRequest(raw);
    const res = await INTAKE_PX_LINK_POST(req, {
      params: Promise.resolve({ clinic_id: 'feeltru', token: 'some-token' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    // The route reaches its own request-parsing/validation layer (either
    // "Missing file field." or a multipart Content-Type complaint from the
    // form parser). The key invariant is no `Unauthorized` response.
    expect(body.message).not.toMatch(/unauthorized/i);
  });
});
