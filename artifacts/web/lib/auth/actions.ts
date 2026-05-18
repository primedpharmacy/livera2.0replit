/**
 * Sign-out server action.
 *
 * Task-202 — the demo team-member picker (and its `signInAction`) has been
 * replaced by Clerk's `<SignIn>` component on `/sign-in`. Clerk owns the
 * sign-in flow end-to-end (credentials, SSO, MFA).
 *
 * `signOutAction` redirects to the Clerk-managed sign-out endpoint so the
 * IdP session is terminated alongside the local app session. The demo
 * `?as=` persona cookie is also cleared so a stale dev override can't
 * shadow the freshly-signed-out state.
 */

'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { DEMO_OVERRIDE_COOKIE_NAME } from '@/lib/api/constants';

export async function signOutAction() {
  // Clear the legacy demo cookies (used by the ?as= override in dev).
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
  jar.delete(DEMO_OVERRIDE_COOKIE_NAME);

  // Hand off to Clerk's sign-out endpoint so the IdP session is
  // invalidated too, then return to /sign-in.
  redirect('/sign-out');
}
