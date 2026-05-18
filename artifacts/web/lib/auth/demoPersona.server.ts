import 'server-only';
import { cookies } from 'next/headers';
import {
  DEMO_OVERRIDE_COOKIE_NAME,
  DEMO_PERSONA_IDS,
  type DemoPersonaId,
} from '@/lib/api/constants';

const DEFAULT_PERSONA_ID: DemoPersonaId = 'user_qadir';

/**
 * Server-side resolution of the active demo persona.
 *
 * Mirrors the client-side `document.cookie` read in `lib/api/constants.ts` so
 * the very first server-rendered HTML for a request matches what the client
 * provider will hydrate with — no SSR/client mismatch and no flash of the
 * wrong persona's gated UI.
 *
 * Call this from a server component / layout and thread the result into the
 * `CurrentUserProvider` via its `initialUserId` prop.
 */
export async function getDemoPersonaIdFromCookies(): Promise<DemoPersonaId> {
  const store = await cookies();
  const raw = store.get(DEMO_OVERRIDE_COOKIE_NAME)?.value;
  if (!raw) return DEFAULT_PERSONA_ID;
  return (DEMO_PERSONA_IDS as readonly string[]).includes(raw)
    ? (raw as DemoPersonaId)
    : DEFAULT_PERSONA_ID;
}
