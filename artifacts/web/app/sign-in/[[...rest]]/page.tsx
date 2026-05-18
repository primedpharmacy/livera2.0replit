/**
 * Sign-in page — backed by Clerk.
 *
 * Replaces the previous demo team-member picker (Task-202). The Clerk
 * `<SignIn>` component handles email/password, SSO, MFA and OAuth
 * callbacks. The route is a catch-all (`[[...rest]]`) so Clerk can route
 * its sub-paths (`/sign-in/sso-callback`, `/sign-in/factor-one`, etc.)
 * under the same segment.
 *
 * Only invited clinicians (rows in `lib/users/registry.ts`) can complete
 * sign-in — the server-side session resolver in `lib/auth/session.ts`
 * returns null for any Clerk email that doesn't map to a registry row,
 * so an arbitrary Clerk account cannot access the workspace.
 */

import { SignIn } from '@clerk/nextjs';

type SignInPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

// Only allow same-origin relative paths as the post-login redirect target
// so the `next` param can't be used as an open-redirect vector.
function sanitiseNext(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next } = await searchParams;
  const redirectTarget = sanitiseNext(next);
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl={redirectTarget}
      />
    </main>
  );
}
