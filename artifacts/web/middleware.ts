/**
 * Session middleware — Clerk-backed (Task-202).
 *
 * Every request is wrapped in `clerkMiddleware` so Clerk's session JWT
 * is verified centrally. After Clerk auth resolves, this middleware
 * does the email → registry → uid lookup once per request and mints
 * an HMAC-signed app-session cookie (`livera_session_uid`). Downstream
 * route handlers stay fast and synchronous: they call `getSessionUser`,
 * which only verifies the cookie — no Clerk Backend API call on every
 * request and no dependency on `getAuth(req)` being initialised.
 *
 * Workspace pages without a Clerk session redirect to `/sign-in`.
 * Patient-facing routes and the Clerk auth pages stay reachable
 * anonymously. API routes never redirect to HTML — they just pass
 * through, so unauthenticated callers get a 401 from the route handler
 * (whose `getSessionUser` returns null) instead of an HTML page.
 *
 * Dev behaviour: same as prod, plus the `?as=<uid>` demo persona
 * override (Task-120) for Playwright specs. The override mints the
 * same HMAC-signed cookie directly. The override is gated to
 * `NODE_ENV !== 'production'` so it never ships.
 */

import { NextRequest, NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';
import { SESSION_COOKIE_NAME, mintSessionCookieValue, verifySessionCookie } from '@/lib/auth/session';
import { DEMO_OVERRIDE_COOKIE_NAME, DEMO_PERSONA_IDS } from '@/lib/api/constants';
import { findUserForClerkIdentity } from '@/lib/users/registry';

const AS_QUERY_PARAM = 'as';
const SIGN_IN_PATH = '/sign-in';
const SIGN_UP_PATH = '/sign-up';
const SIGN_OUT_PATH = '/sign-out';

const PUBLIC_PATH_PREFIXES = [SIGN_IN_PATH, SIGN_UP_PATH, SIGN_OUT_PATH];
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

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function isDemoPersonaId(uid: string): boolean {
  return (DEMO_PERSONA_IDS as readonly string[]).includes(uid);
}

// Task-270 — persist the demo persona across tab opens AND browser restarts.
// Without an explicit maxAge these were session cookies; opening a fresh tab
// (or coming back the next day) dropped them and the user reverted to the
// default Owner. 30 days mirrors a "remember me" sign-in for the demo.
const DEMO_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function setDemoSessionCookies(response: NextResponse, uid: string) {
  response.cookies.set(SESSION_COOKIE_NAME, mintSessionCookieValue(uid), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: DEMO_COOKIE_MAX_AGE_SECONDS,
  });
  response.cookies.set(DEMO_OVERRIDE_COOKIE_NAME, uid, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: DEMO_COOKIE_MAX_AGE_SECONDS,
  });
}

function setAppSessionCookie(response: NextResponse, uid: string) {
  response.cookies.set(SESSION_COOKIE_NAME, mintSessionCookieValue(uid), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
}

function clearAppSessionCookies(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  response.cookies.set(DEMO_OVERRIDE_COOKIE_NAME, '', { path: '/', maxAge: 0 });
}

/**
 * Build a `Cookie` request header with our app-session cookies removed.
 * Critical: in Next.js middleware, mutating response cookies does NOT
 * change the cookies the downstream route handler sees in the SAME
 * request. To make `getSessionUser(request)` return null on the very
 * first request after the cookie becomes stale, we have to strip the
 * cookie from the forwarded request headers via
 * `NextResponse.next({ request: { headers } })`.
 */
function buildHeadersWithoutSessionCookies(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  const original = headers.get('cookie');
  if (!original) return headers;
  const filtered = original
    .split(';')
    .map((p) => p.trim())
    .filter((p) => {
      if (!p) return false;
      const eq = p.indexOf('=');
      const name = (eq === -1 ? p : p.slice(0, eq)).trim();
      return name !== SESSION_COOKIE_NAME && name !== DEMO_OVERRIDE_COOKIE_NAME;
    })
    .join('; ');
  if (filtered) {
    headers.set('cookie', filtered);
  } else {
    headers.delete('cookie');
  }
  return headers;
}

/**
 * Pass-through response that BOTH strips the app-session cookies from
 * the forwarded request (so the route handler's `getSessionUser`
 * returns null on this request) AND clears them on the response (so
 * the browser drops them for future requests).
 */
function nextWithoutSession(request: NextRequest): NextResponse {
  const response = NextResponse.next({
    request: { headers: buildHeadersWithoutSessionCookies(request) },
  });
  clearAppSessionCookies(response);
  return response;
}

/**
 * Redirect response that ALSO strips the app-session cookies from the
 * forwarded request and clears them on the response.
 */
function redirectWithoutSession(request: NextRequest, target: URL): NextResponse {
  // NextResponse.redirect doesn't take a `request` option, so we can't
  // rewrite the forwarded request headers here. That's fine: a redirect
  // doesn't invoke a downstream route handler — the browser issues a
  // new request, and the cleared cookies on this response will be gone
  // by then. We still strip from the request as a no-op for symmetry.
  void request;
  const response = NextResponse.redirect(target);
  clearAppSessionCookies(response);
  return response;
}

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const url = request.nextUrl;
  const asParam = url.searchParams.get(AS_QUERY_PARAM);

  // /sign-out — always clear the local app-session cookies and pass
  // through to the client page (which then calls Clerk.signOut() to
  // terminate the IdP session). Critical: must run BEFORE the remint
  // branch below, otherwise we'd resurrect the cookie on the very
  // request that's trying to log the user out.
  if (url.pathname === SIGN_OUT_PATH || url.pathname.startsWith(`${SIGN_OUT_PATH}/`)) {
    return nextWithoutSession(request);
  }

  // Task-120 — dev-only explicit persona override. Strip the query so
  // the URL bar and Playwright assertions stay clean.
  if (
    process.env.NODE_ENV !== 'production' &&
    asParam &&
    isDemoPersonaId(asParam)
  ) {
    const cleaned = new URL(url);
    cleaned.searchParams.delete(AS_QUERY_PARAM);
    const response = NextResponse.redirect(cleaned);
    setDemoSessionCookies(response, asParam);
    return response;
  }

  const { userId } = await auth();

  // Clerk-authenticated → resolve the registry user and (re)mint the
  // app-session cookie if needed, so getSessionUser stays sync.
  if (userId) {
    const existingCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    // Verify the cookie with the same HMAC verifier `getSessionUser` uses,
    // so we re-mint when the cookie is malformed/tampered (correct uid
    // prefix but bad signature) as well as when the uid simply differs.
    const existingValidUid = existingCookie ? verifySessionCookie(existingCookie) : null;
    let resolvedUid: string | null = null;

    try {
      const { clerkClient } = await import('@clerk/nextjs/server');
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      const email =
        clerkUser.primaryEmailAddress?.emailAddress ??
        clerkUser.emailAddresses?.[0]?.emailAddress ??
        null;
      const user = findUserForClerkIdentity({ clerkId: userId, email });
      resolvedUid = user?.id ?? null;
    } catch (err) {
      // Clerk Backend API call failed (network / IdP outage / etc.).
      // Log loudly and fall through to "no app session" — the request
      // will be treated as anonymous (401 on /api, redirect on pages).
      console.error('[auth] Clerk user lookup failed for userId=%s', userId, err);
      resolvedUid = null;
    }

    if (resolvedUid) {
      const response = NextResponse.next();
      // Re-mint unless the existing cookie passes signature verification
      // AND already encodes the resolved uid. This covers tampered cookies
      // and uid mismatches in a single check.
      if (existingValidUid !== resolvedUid) {
        setAppSessionCookie(response, resolvedUid);
      }
      return response;
    }

    // Clerk session exists but the email is not in the invited-users
    // registry — treat as anonymous AND clear any stale local session
    // cookie. Without this clear, a cookie minted for a previously
    // invited identity could keep authenticating API calls under a
    // now-uninvited Clerk session (account-switch session confusion).
    if (isApiPath(url.pathname) || isPublicPath(url.pathname)) {
      return existingCookie ? nextWithoutSession(request) : NextResponse.next();
    }
    const signInUrl = new URL(SIGN_IN_PATH, url);
    return existingCookie
      ? redirectWithoutSession(request, signInUrl)
      : NextResponse.redirect(signInUrl);
  }

  // ----- No Clerk session below this line -----
  //
  // The app-session cookie must never outlive the Clerk session in
  // production: cookie-only auth (via `getSessionUser`) would otherwise
  // keep `/api/**` callers authenticated after the IdP says they're
  // logged out. We therefore actively clear any stale cookie here.
  // The only exception is the dev-only `?as=` demo-persona path: in dev
  // the cookie can legitimately exist without a Clerk session (Playwright
  // specs use it), so we keep it iff its uid is a registered persona.
  const existingCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isDevDemoCookie =
    process.env.NODE_ENV !== 'production' &&
    !!existingCookie &&
    (DEMO_PERSONA_IDS as readonly string[]).some(
      (uid) => existingCookie.startsWith(`${uid}.`),
    );

  if (isPublicPath(url.pathname)) {
    return existingCookie && !isDevDemoCookie
      ? nextWithoutSession(request)
      : NextResponse.next();
  }

  // API routes never redirect to HTML — let the handler 401. Strip any
  // stale (non-demo) cookie from the forwarded request so the handler
  // can't be fooled into thinking the caller is still logged in on this
  // very request (NextResponse.next() response cookies don't affect the
  // request the handler sees).
  if (isApiPath(url.pathname)) {
    return existingCookie && !isDevDemoCookie
      ? nextWithoutSession(request)
      : NextResponse.next();
  }

  // Dev-only — demo-persona cookie counts as authenticated so Playwright
  // specs that drive the demo personas keep working without going through
  // Clerk's UI.
  if (isDevDemoCookie) {
    return NextResponse.next();
  }

  // No session — send to /sign-in with a `next` pointer and clear any
  // stale cookie on the way out.
  const signInUrl = new URL(SIGN_IN_PATH, url);
  const nextTarget = url.pathname + (url.search || '');
  if (nextTarget && nextTarget !== '/') {
    signInUrl.searchParams.set('next', nextTarget);
  }
  return existingCookie
    ? redirectWithoutSession(request, signInUrl)
    : NextResponse.redirect(signInUrl);
});

// Use the Node.js runtime so `lib/auth/session.ts` can use Node's `crypto`
// for HMAC signing without an Edge Runtime warning. Supported in Next 15.2+.
export const runtime = 'nodejs';

export const config = {
  // Run on everything except Next.js internals and static assets so
  // Clerk auth context is available for both pages and /api/** routes.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
