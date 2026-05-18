/**
 * Session middleware.
 *
 * Unauthenticated workspace traffic is redirected to `/sign-in` (see
 * `app/sign-in/page.tsx` + `lib/auth/actions.ts`). Patient-facing routes
 * (e.g. `/<clinic>/intake`) and the sign-in page itself stay anonymous.
 *
 * Production stays as a pass-through — real auth will replace this hook
 * before going live, and we never want to accidentally redirect-loop a
 * real deployment. Today's behaviour matches what was here before for
 * `process.env.NODE_ENV === 'production'`.
 *
 * Critical: the matcher excludes `/api/**` so anonymous API traffic stays
 * anonymous (and 401s from the route handler) instead of being bounced to
 * an HTML sign-in page.
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

const AS_QUERY_PARAM = 'as';
const SIGN_IN_PATH = '/sign-in';

// Routes that must stay reachable without a session cookie. Patient-facing
// pages live under the `(patient)` route group — today that's
// `/<clinic>/intake` and `/<clinic>/px-upload/<token>` — and have no staff
// identity, so they must not be bounced to the sign-in page. When a new
// patient-facing route is added, list its URL pattern here.
const PUBLIC_PATH_PREFIXES = [SIGN_IN_PATH];
const PUBLIC_PATH_PATTERNS = [
  /^\/[^/]+\/intake(?:\/|$)/,
  /^\/[^/]+\/px-upload(?:\/|$)/,
];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  return PUBLIC_PATH_PATTERNS.some((re) => re.test(pathname));
}

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
  // Real auth replaces this hook before going live — until then, production
  // is a pure pass-through so we never accidentally redirect-loop a real
  // deployment.
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

  if (isPublicPath(url.pathname)) {
    return NextResponse.next();
  }

  // Send the user to /sign-in with a `next` pointer so we can return them
  // to where they were trying to go after they pick an account.
  const signInUrl = new URL(SIGN_IN_PATH, url);
  const nextTarget = url.pathname + (url.search || '');
  if (nextTarget && nextTarget !== '/') {
    signInUrl.searchParams.set('next', nextTarget);
  }
  return NextResponse.redirect(signInUrl);
}

// Use the Node.js runtime so `lib/auth/session.ts` can use Node's `crypto`
// for HMAC signing without an Edge Runtime warning. Supported in Next 15.2+.
export const runtime = 'nodejs';

export const config = {
  // Exclude /api/** so anonymous API traffic stays anonymous (and 401s
  // from the route handler) instead of being bounced to an HTML sign-in
  // page. Also exclude Next.js internals.
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico).*)'],
};
