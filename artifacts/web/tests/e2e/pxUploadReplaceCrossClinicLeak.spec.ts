/**
 * E2E — Task-305: Cross-clinic leak guard on the *replacement* object.
 *
 * Task-193 (`pxUploadCrossClinicLeak.spec.ts`) covers the first-time upload
 * path end-to-end: presigned PUT → finalize → ACL stamp → storage gate.
 * The *replacement* path (a second upload over an existing px_upload on the
 * same order) goes through the same `attachPxUpload` pipeline but mints a
 * brand-new object and stamps a fresh ACL on it. If a future refactor
 * forgets to re-stamp the ACL on the replacement object — or accidentally
 * widens visibility on the superseded one — this spec catches it.
 *
 * Flow:
 *   1. Patient uploads file #1 via request-url → PUT → finalize.
 *   2. Patient uploads file #2 via the same intake flow → finalize swaps
 *      it onto the order (attachPxUpload sees a prior upload and treats
 *      this as a replacement; px_upload_history.prior_object_path records
 *      file #1).
 *   3. As a `vsc` Admin (cross-clinic), GET both object URLs → 403.
 *   4. As a `feeltru` Owner (same-clinic), GET the replacement → 200 with
 *      matching bytes.
 *   5. As the same `feeltru` Owner, GET the *original* object → 200 with
 *      its own bytes. The product rule (Task-252 "Previous uploads"
 *      disclosure) keeps the superseded object readable by same-clinic
 *      staff so the order-detail UI can link back to it from the
 *      replacement-history list. This spec pins that rule so a regression
 *      that strips the prior ACL — or, conversely, a regression that
 *      leaks it cross-clinic — both surface immediately.
 *
 * Lives entirely in the HTTP layer (Playwright `request` fixture, no
 * browser) — exactly the surface the storage gate guards. Falls back to
 * spawning its own `next dev` when PLAYWRIGHT_BASE_URL is unset.
 *
 * Seed: ORD-00451 (FeelTru, Zara Ahmed) — GLP-1 higher-dose path. Shared
 * with `pxUploadCrossClinicLeak.spec.ts`; ordering between the two specs
 * doesn't matter because every assertion here targets state we ourselves
 * write inside the test.
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

// Task-314 — see pxUploadCrossClinicLeak.spec.ts. The HMAC primitives and
// dev-fallback secret live in `lib/auth/sessionSignature.ts`, the single
// source of truth shared with middleware and route handlers, so a
// rotation in one place can't desync this spec.

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

test.describe('Px-upload replacement cross-clinic leak guard', () => {
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

  test('replacement object is clinic-gated and original remains same-clinic readable', async () => {
    test.setTimeout(180_000);

    const contentType = 'application/pdf';

    // Distinct marker bytes per file let the assertions below prove we got
    // exactly the object we asked for — not a stale cache hit, not a
    // duplicate of the other upload.
    const originalBody = Buffer.from('%PDF-1.4\n% task-305 original\n');
    const originalFilename = `task-305-original-${Date.now()}.pdf`;

    const replacementBody = Buffer.from(
      '%PDF-1.4\n% task-305 replacement — different bytes than original\n',
    );
    const replacementFilename = `task-305-replacement-${Date.now()}.pdf`;

    const patient = await pwRequest.newContext({ baseURL });

    // Walk one file through the full intake pipeline: presigned PUT URL →
    // direct upload to GCS → finalize (which stamps the ACL + swaps the
    // order's px_upload via attachPxUpload). Returns the object path that
    // was uploaded plus the finalize response body — the latter is the
    // authoritative server view of the order's *active* px_upload after
    // this call, and we assert against it below to prove replacement
    // semantics actually fired.
    type FinalizeBody = {
      order_id: string;
      px_upload: {
        filename: string;
        size: number;
        content_type: string;
        object_path: string;
        uploaded_at: string;
        source?: string | null;
        uploaded_by_user_id?: string | null;
      };
    };
    const uploadOne = async (
      filename: string,
      body: Buffer,
    ): Promise<{ objectPath: string; finalize: FinalizeBody }> => {
      const reqUrlRes = await patient.post(
        `/api/intake/${CLINIC}/orders/${ORDER_ID}/px-upload/request-url`,
        {
          headers: { 'content-type': 'application/json' },
          data: { filename, size: body.byteLength, content_type: contentType },
        },
      );
      expect(
        reqUrlRes.status(),
        `request-url failed for ${filename}: ${await reqUrlRes.text()}`,
      ).toBe(201);
      const { uploadURL, object_path: objectPath } = (await reqUrlRes.json()) as {
        uploadURL: string;
        object_path: string;
      };
      expect(objectPath).toMatch(/^\/objects\/uploads\//);

      const putRes = await fetch(uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body,
      });
      expect(putRes.ok, `presigned PUT failed for ${filename}: ${putRes.status}`).toBe(true);

      const finalizeRes = await patient.post(
        `/api/intake/${CLINIC}/orders/${ORDER_ID}/px-upload`,
        {
          headers: { 'content-type': 'application/json' },
          data: { object_path: objectPath, filename },
        },
      );
      expect(
        finalizeRes.status(),
        `finalize failed for ${filename}: ${await finalizeRes.text()}`,
      ).toBe(201);
      const finalize = (await finalizeRes.json()) as FinalizeBody;

      return { objectPath, finalize };
    };

    try {
      // ── 1. Land the original upload on ORD-00451. ──
      const { objectPath: originalPath, finalize: originalFinalize } =
        await uploadOne(originalFilename, originalBody);
      expect(originalFinalize.px_upload.object_path).toBe(originalPath);
      expect(originalFinalize.px_upload.filename).toBe(originalFilename);

      // ── 2. Replace it with a second upload via the same intake flow.
      //       attachPxUpload sees the prior px_upload and routes this
      //       through the replacement branch (px_upload_history append,
      //       is_replacement=true on the audit lines). The finalize
      //       response is the server's authoritative view of the order's
      //       *current* px_upload — asserting it here proves the swap
      //       actually happened, not just that two objects were stamped
      //       with matching ACLs. ──
      const { objectPath: replacementPath, finalize: replacementFinalize } =
        await uploadOne(replacementFilename, replacementBody);
      expect(
        replacementPath,
        'replacement should mint a distinct object_path from the original',
      ).not.toBe(originalPath);
      expect(
        replacementFinalize.px_upload.object_path,
        'after second finalize the order must point at the replacement object_path',
      ).toBe(replacementPath);
      expect(
        replacementFinalize.px_upload.filename,
        'after second finalize the order must surface the replacement filename',
      ).toBe(replacementFilename);
      expect(
        replacementFinalize.px_upload.size,
        'after second finalize size must match the replacement bytes',
      ).toBe(replacementBody.byteLength);

      // Both `/objects/uploads/<id>` paths are reached via
      // `/api/storage/objects/uploads/<id>` — the storage route strips the
      // leading `/objects` segment.
      const toDownloadPath = (objectPath: string) =>
        `/api/storage/objects${objectPath.replace('/objects', '')}`;

      const downloadAs = async (uid: string, downloadPath: string) => {
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

      const replacementDownload = toDownloadPath(replacementPath);
      const originalDownload = toDownloadPath(originalPath);

      // ── 3. Cross-clinic staff (Yohan, vsc Admin) must be blocked on
      //       *both* objects — the replacement (today's concern) and the
      //       superseded original (regression guard for Task-252's
      //       "Previous uploads" disclosure leaking cross-clinic). ──
      const vscReplacement = await downloadAs('user_yohan', replacementDownload);
      expect(
        vscReplacement.status,
        `expected 403 on replacement for cross-clinic vsc staff, body: ${vscReplacement.body.toString()}`,
      ).toBe(403);

      const vscOriginal = await downloadAs('user_yohan', originalDownload);
      expect(
        vscOriginal.status,
        `expected 403 on superseded original for cross-clinic vsc staff, body: ${vscOriginal.body.toString()}`,
      ).toBe(403);

      // ── 4. Same-clinic Owner (Qadir, feeltru) gets the replacement
      //       bytes back verbatim — proves attachPxUpload re-stamped the
      //       ACL on the new object and the storage gate honoured it. ──
      const ownerReplacement = await downloadAs('user_qadir', replacementDownload);
      expect(
        ownerReplacement.status,
        `expected 200 on replacement for same-clinic feeltru Owner, body: ${ownerReplacement.body.toString()}`,
      ).toBe(200);
      expect(
        Buffer.compare(ownerReplacement.body, replacementBody),
        'replacement download bytes must match what was PUT',
      ).toBe(0);

      // ── 5. Same-clinic Owner can still read the superseded original.
      //       Product rule (Task-252): the prior object stays readable by
      //       same-clinic staff so the order-detail UI can link back to
      //       it. If a future change strips the ACL here, the assertion
      //       fires and forces an explicit product decision. ──
      const ownerOriginal = await downloadAs('user_qadir', originalDownload);
      expect(
        ownerOriginal.status,
        `expected 200 on superseded original for same-clinic feeltru Owner, body: ${ownerOriginal.body.toString()}`,
      ).toBe(200);
      expect(
        Buffer.compare(ownerOriginal.body, originalBody),
        'superseded original must still serve its own bytes, not the replacement',
      ).toBe(0);
    } finally {
      await patient.dispose();
    }
  });
});
