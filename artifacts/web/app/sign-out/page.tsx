/**
 * Sign-out landing — terminates the Clerk session client-side, then
 * redirects to /sign-in.
 *
 * Server-side cookie clearing is handled by `signOutAction`; this page
 * exists so Clerk's browser SDK can also flush its session storage and
 * cookies. Reachable directly (e.g. from a "log out" link) as well as
 * via the redirect at the end of `signOutAction`.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';

export default function SignOutPage() {
  const { signOut } = useClerk();
  const router = useRouter();

  useEffect(() => {
    void signOut(() => router.replace('/sign-in'));
  }, [signOut, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Signing out…</p>
    </main>
  );
}
