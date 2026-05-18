/**
 * Demo session bootstrap — DEV / PREVIEW ONLY.
 *
 * The app does not yet have a real login flow, so for local development
 * and the preview demo we mint a signed session cookie naming the demo
 * Owner (`user_qadir`) on the first page request from a fresh browser.
 * This is gated on `NODE_ENV !== 'production'` so a real deployment never
 * auto-authenticates anyone — production traffic with no session falls
 * through to whatever sign-in surface gets wired up next.
 *
 * Critical: we also exclude `/api/**` from the matcher so anonymous API
 * traffic stays anonymous even in dev. Protected routes (e.g. the
 * prescription file route) read the session via `lib/auth/session.ts`
 * and must 401 when no signed cookie is present.
 *
 * The cookie value is HMAC-signed with `SESSION_SECRET` (or a dev
 * fallback secret) — a client that hand-rolls `livera_session_uid=...`
 * with no signature is rejected as anonymous.
 *
 * Task-120 — demo persona override. Any page request carrying `?as=<uid>`
 * with `<uid>` in `DEMO_PERSONA_IDS` re-mints both the signed session
 * cookie and a non-httpOnly `livera_demo_uid` mirror cookie (so client
 * modules in `constants.ts` resolve the same persona) and 307-redirects
 * back to the original URL with the query stripped. This makes role /
 * permission negative paths reachable in Playwright via a one-step
 * `page.goto('/.../...?as=user_olwyn')`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, mintSessionCookieValue } from '@/lib/auth/session';
import { DEMO_OVERRIDE_COOKIE_NAME, DEMO_PERSONA_IDS } from '@/lib/api/constants';

const DEFAULT_DEMO_SESSION_UID = 'user_qadir';
const AS_QUERY_PARAM = 'as';

function isDemoPersonaId(uid: string): boolean {
  return (DEMO_PERSONA_IDS as readonly string[]).includes(uid);
}

function setSessionCookies(response: NextResponse, uid: string) {
  const signedCookie = mintSessionCookieValue(uid);
  response.cookies.set(SESSION_COOKIE_NAME, signedCookie, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  response.cookies.set(DEMO_OVERRIDE_COOKIE_NAME, uid, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  });
}

export function middleware(request: NextRequest) {
  // Never auto-mint a session in production — that would defeat the
  // entire point of requiring a real signed-in clinician for protected
  // routes. Real auth replaces this hook before going live.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.next();
  }

  const url = request.nextUrl;
  const asParam = url.searchParams.get(AS_QUERY_PARAM);

  // Task-120 — explicit persona override. Strip the query so the URL bar
  // and Playwright assertions stay clean, then redirect so the browser
  // does a fresh load with the new cookies in place.
  if (asParam && isDemoPersonaId(asParam)) {
    const cleaned = new URL(url);
    cleaned.searchParams.delete(AS_QUERY_PARAM);
    const response = NextResponse.redirect(cleaned);
    setSessionCookies(response, asParam);
    return response;
  }

  if (request.cookies.get(SESSION_COOKIE_NAME)) {
    return NextResponse.next();
  }

  // Forward the cookie to the downstream handler in this same request so
  // a fresh browser doesn't need a round-trip before pages see a session.
  const signedCookie = mintSessionCookieValue(DEFAULT_DEMO_SESSION_UID);
  const cookieHeader = request.headers.get('cookie');
  const seededCookie = `${SESSION_COOKIE_NAME}=${signedCookie}; ${DEMO_OVERRIDE_COOKIE_NAME}=${DEFAULT_DEMO_SESSION_UID}`;
  const forwardedCookie = cookieHeader
    ? `${cookieHeader}; ${seededCookie}`
    : seededCookie;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('cookie', forwardedCookie);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  setSessionCookies(response, DEFAULT_DEMO_SESSION_UID);
  return response;
}

// Use the Node.js runtime so `lib/auth/session.ts` can use Node's `crypto`
// for HMAC signing without an Edge Runtime warning. Supported in Next 15.2+.
export const runtime = 'nodejs';

export const config = {
  // Exclude /api/** so anonymous API traffic stays anonymous (and 401s
  // from the route handler) instead of being auto-authenticated as the
  // demo Owner. Also exclude Next.js internals.
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico).*)'],
};
