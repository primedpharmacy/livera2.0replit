/**
 * Sign-in / sign-out server actions.
 *
 * Replaces the demo cookie auto-seed in `middleware.ts`. The sign-in page
 * (`app/sign-in/page.tsx`) posts to `signInAction` with a `uid` from
 * `USERS_REGISTRY`; we mint a signed session cookie (same format as
 * `lib/auth/session.ts` verifies) plus the non-httpOnly `livera_demo_uid`
 * mirror cookie so client modules in `constants.ts` resolve the same persona.
 *
 * `signOutAction` clears both cookies and returns to `/sign-in`.
 *
 * When real auth lands, swap these for the IdP's sign-in / sign-out flow —
 * the rest of the app keeps using `getSessionUser` from `lib/auth/session.ts`.
 */

'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, mintSessionCookieValue } from '@/lib/auth/session';
import { DEMO_OVERRIDE_COOKIE_NAME, USERS_REGISTRY } from '@/lib/api/constants';

function isSafeNext(next: string | null): next is string {
  if (!next) return false;
  // Only allow same-origin relative paths to avoid open-redirects.
  return next.startsWith('/') && !next.startsWith('//');
}

export async function signInAction(formData: FormData) {
  const uid = String(formData.get('uid') ?? '');
  const nextRaw = formData.get('next');
  const next = typeof nextRaw === 'string' && isSafeNext(nextRaw) ? nextRaw : '/';

  const user = USERS_REGISTRY[uid];
  if (!user || !user.active) {
    redirect('/sign-in?error=unknown_user');
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, mintSessionCookieValue(uid), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  jar.set(DEMO_OVERRIDE_COOKIE_NAME, uid, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  });

  redirect(next);
}

export async function signOutAction() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
  jar.delete(DEMO_OVERRIDE_COOKIE_NAME);
  redirect('/sign-in');
}
