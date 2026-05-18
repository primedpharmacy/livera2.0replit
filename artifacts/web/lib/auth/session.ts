/**
 * Request-session helper — turns an incoming HTTP request into the
 * authenticated staff `User` (or `null` if anonymous).
 *
 * Task-202 — sessions are now issued by Clerk (the IdP). The async
 * Clerk → email → registry → uid resolution happens in `middleware.ts`,
 * which mints an HMAC-signed app-session cookie containing the resolved
 * uid. `getSessionUser` stays synchronous (preserving the pre-Task-202
 * contract): it simply verifies that cookie and looks the uid up in
 * the local users table.
 *
 * The same cookie is also written by the dev-only `?as=<uid>` demo
 * persona override (Task-120) used by Playwright specs.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { findUserByUid } from '@/lib/users/registry';
import { can, type Action, type Resource } from '@/lib/permissions';
import type { Clinic, User } from '@/lib/api/types';

// `next/headers` is dynamically imported below (only inside the
// `requireServerActionUser` server-action helper) so this module stays usable
// from middleware / route handlers that take a NextRequest.

export const SESSION_COOKIE_NAME = 'livera_session_uid';

const DEV_FALLBACK_SECRET = 'livera-dev-session-secret-do-not-use-in-prod';

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET is required in production — refusing to mint or verify session cookies.',
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

/**
 * Resolve the active staff user for a request — synchronous, by design.
 *
 * The cookie is minted by `middleware.ts` after Clerk has authenticated
 * the request and the Clerk email has been matched against the local
 * users table. Route handlers therefore only need a fast, sync, cookie
 * verification here — no Clerk Backend API call on every request.
 */
export function getSessionUser(request: NextRequest): User | null {
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  const uid = verifySessionCookie(raw);
  if (!uid) return null;
  return findUserByUid(uid) ?? null;
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
  const uid = verifySessionCookie(raw);
  if (!uid) throw new UnauthenticatedActionError();
  const user = findUserByUid(uid);
  if (!user || !user.active) throw new UnauthenticatedActionError();
  return user;
}

// ── Per-action permission gates ────────────────────────────────────────────
// Task-293: each server-action wrapper in lib/actions/*.ts should consult one
// of these helpers up-front so a caller without the right role/capability is
// rejected with a uniform `PermissionDeniedError` *before* the fixture mutates
// anything. A `*_blocked` audit line is emitted so security review can see who
// tried what.

export class PermissionDeniedError extends Error {
  code = 'PERMISSION_DENIED' as const;
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

function logBlocked(
  actor: User,
  eventType: string,
  details: Record<string, unknown>,
): void {
  console.log('[AUDIT]', {
    event_type: eventType,
    outcome: 'permission_denied',
    user_id: actor.id,
    user_roles: actor.roles,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Verify `actor` may perform `action` on `resource`. Logs a
 * `<resource>_<action>_blocked` audit line and throws `PermissionDeniedError`
 * on failure. `context` is forwarded to `can()` for resources that need clinic
 * or ownership scoping (e.g. coaching).
 */
export function requirePermission(
  actor: User,
  action: Action | string,
  resource: Resource | string,
  context?: { clinic?: Clinic; ownerId?: string },
): void {
  if (can(actor, action, resource, context)) return;
  logBlocked(actor, `${resource}_${action}_blocked`, { action, resource });
  throw new PermissionDeniedError(
    `User ${actor.id} cannot ${action} ${resource}`,
  );
}

/**
 * Verify `actor` carries at least one of the allowed roles. Use when a server
 * action can't be expressed cleanly through `can()` (e.g. yellow-card
 * decisions, which are Prescriber/Owner only and don't map to a fixture
 * resource gate today).
 */
export function requireAnyRole(
  actor: User,
  allowed: ReadonlyArray<string>,
  eventTag: string,
): void {
  if (actor.roles.some((r) => allowed.includes(r))) return;
  logBlocked(actor, `${eventTag}_blocked`, {
    required_any_role: allowed,
  });
  throw new PermissionDeniedError(
    `User ${actor.id} is missing a required role for ${eventTag}`,
  );
}

/**
 * Refund-authority gate — Task-38 / Task-293. Refund decisions require the
 * per-user `can_refund` capability in addition to the role gate.
 */
export function requireRefundAuthority(
  actor: User,
  eventTag = 'refund_amendment_decision',
): void {
  if (actor.can_refund) return;
  logBlocked(actor, `${eventTag}_blocked`, { reason: 'no_refund_authority' });
  throw new PermissionDeniedError(
    'You do not have refund authority on this clinic.',
  );
}
