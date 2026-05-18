/**
 * Request-session helper — single place that turns an incoming HTTP request
 * into the authenticated staff `User` (or `null` if anonymous).
 *
 * The "session" is a server-signed cookie of the form `<uid>.<hmac>`.
 * `mintSessionCookieValue` produces it; `getSessionUser` verifies the HMAC
 * with `SESSION_SECRET` before trusting the uid. A client that sets
 * `livera_session_uid=user_qadir` with no signature (or a forged one) is
 * rejected as anonymous, so the protected routes return 401.
 *
 * When real auth (Auth0/Supabase/Clerk) lands, swap the body of
 * `getSessionUser` for the IdP's session verifier — call sites stay the
 * same.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { USERS_REGISTRY } from '@/lib/api/constants';
import type { User } from '@/lib/api/types';

// `next/headers` is dynamically imported below (only inside the
// `requireServerActionUser` server-action helper) so this module stays usable
// from middleware / route handlers that take a NextRequest.

export const SESSION_COOKIE_NAME = 'livera_session_uid';

// Dev fallback only — production deployments must set SESSION_SECRET.
// The fallback exists so the demo workspace boots without env wiring;
// it must never be used in production (see `assertProductionSecret`).
const DEV_FALLBACK_SECRET = 'livera-dev-session-secret-do-not-use-in-prod';

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET is required in production — refusing to mint or verify sessions with the dev fallback.',
    );
  }
  return DEV_FALLBACK_SECRET;
}

function sign(uid: string): string {
  return createHmac('sha256', getSecret()).update(uid).digest('hex');
}

export function mintSessionCookieValue(uid: string): string {
  return `${uid}.${sign(uid)}`;
}

function verify(cookieValue: string): string | null {
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

export function getSessionUser(request: NextRequest): User | null {
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  const uid = verify(raw);
  if (!uid) return null;
  const user = USERS_REGISTRY[uid];
  if (!user || !user.active) return null;
  return user;
}

// ── Server-action variant — reads the cookie via `next/headers` ────────────
// Task-194: staff mutations implemented as React server actions resolve their
// actor via this helper instead of the hard-coded `CURRENT_USER` constant.
// Throws `UNAUTHENTICATED` on anonymous / forged / inactive callers so the
// caller fixture never records an audit line for an unknown user.
export class UnauthenticatedActionError extends Error {
  code = 'UNAUTHENTICATED' as const;
  constructor(message = 'Sign-in required to perform this action') {
    super(message);
    this.name = 'UnauthenticatedActionError';
  }
}

export async function requireServerActionUser(): Promise<User> {
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) throw new UnauthenticatedActionError();
  const uid = verify(raw);
  if (!uid) throw new UnauthenticatedActionError();
  const user = USERS_REGISTRY[uid];
  if (!user || !user.active) throw new UnauthenticatedActionError();
  return user;
}
