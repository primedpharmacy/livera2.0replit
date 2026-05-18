/**
 * E2E — Task-193: Cross-clinic prescription-file leak guard.
 *
 * Task-124 added unit coverage for the session gate on
 * `GET /api/storage/objects/[...path]`, but the end-to-end flow — patient
 * uploads a prescription evidence file on one clinic's order, staff from
 * another clinic tries to fetch it via the resulting object URL — was still
 * untested. This spec exercises the real upload pipeline (request-url →
 * direct PUT to GCS → finalize) and then the real download pipeline (signed
 * session cookie → `/api/storage/objects/...`), so a regression that drops
 * the ACL stamp at write time OR weakens the gate at read time is caught by
 * a single test.
 *
 * Flow:
 *   1. Patient (anonymous) calls the intake request-url endpoint on a
 *      `feeltru` GLP-1 higher-dose order to mint a presigned PUT URL.
 *   2. PUT the file bytes directly to GCS via that URL.
 *   3. Patient finalize stamps the clinic-scoped ACL onto the object.
 *   4. As a `vsc` Admin (Yohan), GET `/api/storage/objects/<id>` → 403.
 *   5. As a `feeltru` Owner (Qadir), GET the same URL → 200 + matching bytes.
 *
 * Uses Playwright's `request` fixture (no browser) — the spec lives entirely
 * in the HTTP layer, which is the surface Task-193 actually guards. Falls
 * back to spawning its own `next dev` when PLAYWRIGHT_BASE_URL is unset so
 * the spec also runs standalone.
 *
 * Seed: ORD-00451 (FeelTru, Zara Ahmed) — GLP-1 higher-dose path that
 * accepts a px upload.
 */

import { test, expect, request as pwRequest } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import {
  SESSION_COOKIE_NAME,
  mintSessionCookieValue,
} from '../../lib/auth/sessionSignature';

const CLINIC = 'feeltru';
const ORDER_ID = 'ORD-00451';
const READY_TIMEOUT_MS = 180_000;
const WEB_ROOT = path.resolve(__dirname, '..', '..');

const REUSE_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? '';

// Task-314 — `mintSessionCookieValue` + the dev-fallback secret now live
// in `lib/auth/sessionSignature.ts`, the single source of truth shared
// with middleware, route handlers, server actions, and unit tests. The
// dev server inherits the parent env unchanged, so signing here with
// the same helper verifies against the exact same secret the route
// handler signs with.

let server: ChildProcess | null = null;
let stdoutBuf = '';
let baseURL = '';

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status < 500) return;
    } catch {
      // ECONNREFUSED while next is still booting — keep polling.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Dev server at ${url} did not become ready within ${READY_TIMEOUT_MS}ms. ` +
      `Last stdout:\n${stdoutBuf.slice(-2000)}`,
  );
}

test.describe('Px-upload cross-clinic leak guard', () => {
  test.beforeAll(async () => {
    test.setTimeout(READY_TIMEOUT_MS + 30_000);

    if (REUSE_BASE_URL) {
      baseURL = REUSE_BASE_URL.replace(/\/$/, '');
      await waitForServer(baseURL);
      return;
    }

    const port = String(30000 + Math.floor(Math.random() * 5000));
    baseURL = `http://127.0.0.1:${port}`;

    server = spawn(
      'pnpm',
      ['exec', 'next', 'dev', '--port', port, '--hostname', '127.0.0.1'],
      {
        cwd: WEB_ROOT,
        env: {
          ...process.env,
          PORT: port,
          FORCE_COLOR: '0',
          NO_COLOR: '1',
          NODE_ENV: 'development',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    server.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
    });
    server.stderr?.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
    });

    await waitForServer(baseURL);
  });

  test.afterAll(async () => {
    if (server && !server.killed) {
      server.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
      if (!server.killed) server.kill('SIGKILL');
    }
  });

  test('cross-clinic staff get 403, same-clinic Owner gets 200 with the file bytes', async () => {
    test.setTimeout(180_000);

    // Distinct marker bytes let us assert the same-clinic download actually
    // streams the uploaded file (not e.g. an empty 200 from a cache).
    const fileBody = Buffer.from('%PDF-1.4\n% task-193 cross-clinic leak\n');
    const filename = `task-193-${Date.now()}.pdf`;
    const contentType = 'application/pdf';

    // Patient-side context (no session cookie).
    const patient = await pwRequest.newContext({ baseURL });

    try {
      // ── 1. Patient mints a presigned PUT URL ──
      const reqUrlRes = await patient.post(
        `/api/intake/${CLINIC}/orders/${ORDER_ID}/px-upload/request-url`,
        {
          headers: { 'content-type': 'application/json' },
          data: { filename, size: fileBody.byteLength, content_type: contentType },
        },
      );
      expect(
        reqUrlRes.status(),
        `request-url failed: ${await reqUrlRes.text()}`,
      ).toBe(201);
      const { uploadURL, object_path: objectPath } = (await reqUrlRes.json()) as {
        uploadURL: string;
        object_path: string;
      };
      expect(objectPath).toMatch(/^\/objects\/uploads\//);

      // ── 2. PUT bytes straight to GCS via the presigned URL ──
      const putRes = await fetch(uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: fileBody,
      });
      expect(putRes.ok, `presigned PUT failed: ${putRes.status}`).toBe(true);

      // ── 3. Patient finalize stamps the clinic-scoped ACL onto the object ──
      const finalizeRes = await patient.post(
        `/api/intake/${CLINIC}/orders/${ORDER_ID}/px-upload`,
        {
          headers: { 'content-type': 'application/json' },
          data: { object_path: objectPath, filename },
        },
      );
      expect(
        finalizeRes.status(),
        `finalize failed: ${await finalizeRes.text()}`,
      ).toBe(201);

      // The download endpoint accepts the same path the API gateway exposes,
      // normalised to `/api/storage/objects/<id-after-uploads>`.
      const downloadPath = `/api/storage/objects${objectPath.replace(
        '/objects',
        '',
      )}`;

      // Helper: spin up a fresh APIRequestContext carrying only the persona's
      // session cookie, then GET the download URL.
      const downloadAs = async (uid: string) => {
        const ctx = await pwRequest.newContext({
          baseURL,
          extraHTTPHeaders: {
            cookie: `${SESSION_COOKIE_NAME}=${mintSessionCookieValue(uid)}`,
          },
        });
        try {
          const res = await ctx.get(downloadPath);
          const body = await res.body();
          return { status: res.status(), body };
        } finally {
          await ctx.dispose();
        }
      };

      // ── 4. Cross-clinic staff (Yohan, vsc Admin) must be blocked ──
      const vsc = await downloadAs('user_yohan');
      expect(
        vsc.status,
        `expected 403 for cross-clinic vsc staff, body: ${vsc.body.toString()}`,
      ).toBe(403);

      // ── 5. Same-clinic Owner (Qadir, feeltru) must get the file back ──
      const ok = await downloadAs('user_qadir');
      expect(ok.status, 'expected 200 for same-clinic feeltru Owner').toBe(200);
      expect(Buffer.compare(ok.body, fileBody)).toBe(0);
    } finally {
      await patient.dispose();
    }
  });
});
