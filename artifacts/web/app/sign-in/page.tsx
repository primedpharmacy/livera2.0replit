/**
 * Sign-in page — pick a team member to set `livera_session_uid`.
 *
 * Lists every entry in `USERS_REGISTRY`. Submitting a row posts to
 * `signInAction` (see `lib/auth/actions.ts`), which mints the signed
 * session cookie and redirects to `?next=` (or `/`).
 *
 * This replaces the demo cookie auto-seed in `middleware.ts` — unauthenticated
 * traffic to workspace routes now lands here instead of being silently signed
 * in as the demo Owner, so the 401 path on staff-only API routes is reachable
 * end-to-end.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { USERS_REGISTRY } from '@/lib/api/constants';
import { signInAction } from '@/lib/auth/actions';

type SignInPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next, error } = await searchParams;
  const users = Object.values(USERS_REGISTRY);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-2">
          <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Livera
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-muted-foreground">
            Pick a team member to start a session. This is a demo sign-in —
            a real identity provider replaces it next.
          </p>
          {error === 'unknown_user' && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              That account isn&apos;t recognised. Pick a team member from the
              list below.
            </p>
          )}
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Team members</CardTitle>
            <CardDescription>
              Choose an account to sign in as. Your selection sets the session
              cookie used by every page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{u.full_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {u.email} · {u.roles.join(', ')} · {u.active_clinic_id}
                    </span>
                  </div>
                  <form action={signInAction}>
                    <input type="hidden" name="uid" value={u.id} />
                    {next && <input type="hidden" name="next" value={next} />}
                    <Button type="submit" size="sm" data-testid={`sign-in-${u.id}`}>
                      Sign in
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
