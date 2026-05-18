/**
 * Sign-up page — backed by Clerk.
 *
 * Catch-all so Clerk can route OAuth callbacks under the same segment.
 * Note: account creation here only lets the user authenticate with the
 * IdP; access to the workspace is still gated on a matching row in
 * `lib/users/registry.ts` (see `lib/auth/session.ts`). New Clerk accounts
 * whose email isn't in the registry will sign in and then be bounced
 * back to /sign-in by the middleware.
 */

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/"
      />
    </main>
  );
}
