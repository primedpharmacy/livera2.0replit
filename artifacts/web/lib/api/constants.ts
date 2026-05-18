/**
 * Livera shared constants and utilities — Wave 1 (Chunk 1 Foundations).
 *
 * NOW: static ISO anchor — '2026-05-11T08:00:00Z'
 *   Single source per PRODUCT_VISION.md CRITICAL RULE 8.
 *   Never use Date.now() in seeds. Never redeclare locally in components.
 *   Import from '@/lib/api/constants' or '@/lib/api/mock'.
 *
 * USERS: CURRENT_USER (Qadir, Owner, FeelTru) + USERS_REGISTRY for team lookups.
 *   Mobeen Alam (second Owner, FeelTru) lives in fixtures/users.ts.
 */

import type { User, ClinicId } from './types';
import { USERS_REGISTRY as USERS_TABLE } from '@/lib/users/registry';

// ── Static ISO anchor — all mock "now" timestamps use this ─────────────────
export const NOW = '2026-05-11T08:00:00Z';

// ── Demo persona override (Task-120) ────────────────────────────────────────
// In dev / preview, the active user can be switched via `?as=<uid>` on any
// page request. The middleware mints a fresh signed session cookie for the
// chosen uid AND writes a non-httpOnly mirror cookie (`livera_demo_uid`) so
// that client-side code below resolves the same persona. The allow-list keeps
// arbitrary cookie values from impersonating unknown users.
export const DEMO_OVERRIDE_COOKIE_NAME = 'livera_demo_uid';
export const DEMO_PERSONA_IDS = [
  'user_qadir',
  'user_mobeen',
  'user_claire',
  'user_olwyn',
  'user_yohan',
] as const;
export type DemoPersonaId = (typeof DEMO_PERSONA_IDS)[number];
const DEFAULT_PERSONA_ID: DemoPersonaId = 'user_qadir';

// ── Users registry (sourced from `lib/users/registry.ts`) ───────────────────
// Task-202 — USERS_REGISTRY moved out of this constants module into the
// dedicated `lib/users/registry.ts` "users table". Re-exported here so the
// many fixtures / components that still import `{ USERS_REGISTRY }` from
// `@/lib/api/constants` keep compiling. New code should import directly
// from `@/lib/users/registry`.
export const USERS_REGISTRY: Record<string, User> = USERS_TABLE;

// ── System actor — webhook-driven mutations (BLD-8.3, Wave 6) ───────────────
// Used by app/api/webhooks/intercom/route.ts for incident creation triggered by
// Intercom tag events. SYSTEM_USER has 'System' role which grants:
//   write: 'incidents', write: 'intercom_webhooks' (see lib/permissions.ts)
// active_clinic_id is set to 'feeltru' as required placeholder — system ops are
// clinic-scoped by the patient/incident being operated on, not by this field.
export const SYSTEM_USER: User = {
  id: 'system',
  email: 'system@livera.internal',
  full_name: 'Livera System',
  roles: ['System'],
  active_clinic_id: 'feeltru',
  professional_registrations: [],
  active: true,
};

// ── Demo persona resolution (Task-120) ──────────────────────────────────────
// Client modules read `document.cookie` once at first evaluation. The cookie
// is written by `middleware.ts` when `?as=<uid>` is hit (and re-written on
// the auto-seeded default session) so the very first client render after a
// full page load already reflects the chosen persona. SSR has no document so
// it falls back to the default Owner — components hydrate to the override on
// the client, which is acceptable for this demo-only switcher.
function resolveDemoPersonaId(): DemoPersonaId {
  if (typeof document === 'undefined') return DEFAULT_PERSONA_ID;
  const match = document.cookie.match(/(?:^|;\s*)livera_demo_uid=([^;]+)/);
  if (!match) return DEFAULT_PERSONA_ID;
  const uid = decodeURIComponent(match[1]);
  return (DEMO_PERSONA_IDS as readonly string[]).includes(uid)
    ? (uid as DemoPersonaId)
    : DEFAULT_PERSONA_ID;
}

// ── Current user — resolves via the demo persona switcher above ─────────────
// Kept as a module-level const so the many fixture / display call sites
// (`import { CURRENT_USER }`) keep working. Note: this is *not* the
// authenticated session user any more — Task-202 routed real auth through
// Clerk and the authoritative resolver is `getSessionUser` in
// `lib/auth/session.ts`. This constant exists for fixture authoring (who
// gets stamped as the `actor_id` on a seeded order, etc.) and for the
// dev-only persona switcher; it must not be used for authorization.
export const CURRENT_USER: User =
  USERS_REGISTRY[resolveDemoPersonaId()] ?? USERS_REGISTRY['user_qadir'];

// ── Auth helpers (placeholder until Auth0/Supabase decided) ─────────────────
export async function getCurrentUser(): Promise<User> {
  await delay(50);
  return CURRENT_USER;
}

// ── Simulated network latency ────────────────────────────────────────────────
export const delay = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms));

// ── Typed API error — frontend catches and surfaces code + message ───────────
export class APIError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// ── Workspace isolation helper — every list must filter by current clinic_id ─
export function scopedToClinic<T extends { clinic_id: ClinicId }>(
  items: T[],
  clinic_id: ClinicId
): T[] {
  return items.filter((item) => item.clinic_id === clinic_id);
}
