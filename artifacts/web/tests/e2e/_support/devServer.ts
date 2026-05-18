/**
 * Shared harness for E2E specs that need to assert against backend
 * `[AUDIT]` (and other `console.log`) output emitted by the Next.js dev
 * server.
 *
 * The shared `artifacts/web: web` workflow + Playwright's `webServer`
 * managed dev-server option both swallow stdout in a way that's
 * inaccessible from the test process, so specs that want to read audit
 * lines need to spawn their own `next dev` instance on a fresh port and
 * pipe its stdout/stderr into an in-memory buffer.
 *
 * This module extracts that boot-and-capture dance behind a single
 * `startDevServer()` call so individual specs can opt in without
 * re-implementing it.
 *
 * Usage:
 *   let server: DevServerHandle;
 *
 *   test.beforeAll(async () => { server = await startDevServer(); });
 *   test.afterAll(async () => { await server.stop(); });
 *
 *   test('something audited', async ({ browser }) => {
 *     const ctx = await browser.newContext({ baseURL: server.baseURL });
 *     // …drive the UI…
 *     expect(server.getStdout()).toMatch(/\[AUDIT\][\s\S]*event_type: 'foo'/);
 *   });
 *
 * Callers MUST always pass `baseURL: server.baseURL` when creating their
 * own `browser.newContext()` — the project-level Playwright `baseURL`
 * still points at the shared workflow port, not at the spawned process.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import * as path from 'node:path';

const WEB_ROOT = path.resolve(__dirname, '..', '..', '..');

export interface DevServerHandle {
  /** Base URL the spawned `next dev` instance is reachable on. */
  readonly baseURL: string;
  /** Numeric port the dev server bound to, as a string. */
  readonly port: string;
  /** Returns the full captured stdout+stderr buffer at the time of call. */
  getStdout(): string;
  /** Length of the captured buffer — handy for marking pre-action boundaries. */
  stdoutLength(): number;
  /** SIGTERMs (and SIGKILLs if needed) the underlying child process. */
  stop(): Promise<void>;
}

export interface StartDevServerOptions {
  /** Override how long to wait for the server to start responding. */
  readyTimeoutMs?: number;
  /** Extra env vars to merge into the spawned process's environment. */
  env?: NodeJS.ProcessEnv;
  /** Override the cwd `next dev` is spawned in. Defaults to `artifacts/web`. */
  cwd?: string;
}

const DEFAULT_READY_TIMEOUT_MS = 120_000;

async function waitForServerReady(
  url: string,
  deadline: number,
  getTail: () => string,
): Promise<void> {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      // Any non-5xx means the server is up and serving routes. Next's
      // middleware happily 200s/302s `/`, so we can stop waiting.
      if (res.status < 500) return;
    } catch {
      // ECONNREFUSED while next is still booting — keep polling.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Dev server at ${url} did not become ready in time. ` +
      `Last stdout:\n${getTail()}`,
  );
}

export async function startDevServer(
  opts: StartDevServerOptions = {},
): Promise<DevServerHandle> {
  const readyTimeoutMs = opts.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
  const cwd = opts.cwd ?? WEB_ROOT;
  // Random high port to avoid colliding with the shared workspace workflow
  // or with a parallel spec that also span up its own dev server.
  const port = String(30000 + Math.floor(Math.random() * 5000));
  const baseURL = `http://127.0.0.1:${port}`;

  let stdoutBuf = '';

  const server: ChildProcess = spawn(
    'pnpm',
    ['exec', 'next', 'dev', '--port', port, '--hostname', '127.0.0.1'],
    {
      cwd,
      env: {
        ...process.env,
        PORT: port,
        // Force a non-TTY so console.log of objects stays uncoloured —
        // makes downstream AUDIT regex assertions robust against ANSI codes.
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        NODE_ENV: 'development',
        ...opts.env,
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

  const stop = async (): Promise<void> => {
    if (server.killed) return;
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
    if (!server.killed) server.kill('SIGKILL');
  };

  try {
    await waitForServerReady(
      baseURL,
      Date.now() + readyTimeoutMs,
      () => stdoutBuf.slice(-2000),
    );
  } catch (err) {
    await stop();
    throw err;
  }

  return {
    baseURL,
    port,
    getStdout: () => stdoutBuf,
    stdoutLength: () => stdoutBuf.length,
    stop,
  };
}
