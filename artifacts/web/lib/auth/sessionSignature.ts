/**
 * Single source of truth for app-session HMAC signing.
 *
 * Task-314 — server actions, API route handlers, middleware, unit tests,
 * and Playwright e2e specs all need to mint/verify the same
 * `<uid>.<hex-hmac>` cookie. Originally the dev-fallback secret literal
 * was duplicated across `lib/auth/session.ts` and several test files,
 * which meant a rotation in one place silently invalidated sessions
 * everywhere else. This module is now the only place the fallback
 * literal lives.
 *
 * Kept deliberately dependency-free (only `node:crypto`) so it can be
 * imported from Node test runners (vitest, Playwright) without dragging
 * in Next.js types or request/response shapes.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'livera_session_uid';

/**
 * Dev-only fallback. Production deployments MUST set `SESSION_SECRET` —
 * `getSessionSecret()` throws otherwise. Exported so tests that need to
 * mint a valid cookie without polluting `process.env` can reach for the
 * same literal the runtime would.
 */
export const SESSION_SECRET_DEV_FALLBACK =
  'livera-dev-session-secret-do-not-use-in-prod';

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET is required in production — refusing to mint or verify session cookies.',
    );
  }
  return SESSION_SECRET_DEV_FALLBACK;
}

function sign(uid: string): string {
  return createHmac('sha256', getSessionSecret()).update(uid).digest('hex');
}

export function mintSessionCookieValue(uid: string): string {
  return `${uid}.${sign(uid)}`;
}

export function verifySessionCookie(cookieValue: string): string | null {
  const dot = cookieValue.lastIndexOf('.');
  if (dot <= 0 || dot === cookieValue.length - 1) return null;
  const uid = cookieValue.slice(0, dot);
  const providedSig = cookieValue.slice(dot + 1);
  const expectedSig = sign(uid);
  if (providedSig.length !== expectedSig.length) return null;
  try {
    const a = Buffer.from(providedSig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length || a.length === 0) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return uid;
}
