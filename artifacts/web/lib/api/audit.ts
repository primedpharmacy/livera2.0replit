/**
 * Audit helper — task #167.
 *
 * Every mutating fixture call already emits a `console.log('[AUDIT]', …)`
 * line for live tailing. This helper layers a *durable* write into the
 * shared `audit_events` Postgres table (see `lib/db/src/schema/audit.ts`)
 * so the trail survives process restarts and powers the upcoming
 * per-entity Activity tabs + global Activity page.
 *
 * Design rules
 *   - **Never throw.** The pino line has already been emitted and the
 *     business mutation has already succeeded; an audit insert failure
 *     must never bubble up to the caller. We catch every error and log
 *     `[AUDIT_PERSIST_FAIL]` so on-call can spot dropped rows.
 *   - **Fire-and-forget.** Callers do `void recordAudit({…})` so the DB
 *     latency does not stretch the mutation path. The helper itself
 *     awaits the insert internally so test code can `await` it for
 *     deterministic assertions.
 *   - **Snapshot the actor's role** at write time so a later role change
 *     does not rewrite history. `actor: 'system'` covers cron / webhook
 *     callers that have no signed-in user.
 *   - **Keep PII out.** `before` / `after` should already be the same
 *     redacted payload the pino line carries (e.g. patient_name_hash,
 *     not full_name). The helper does not redact further — it stores
 *     what callers hand it.
 */

import type { User } from "./types";

// Lazy import so `lib/db` (which throws if DATABASE_URL is unset at
// module load) is not pulled in by test runs that mock the DB out and
// never call recordAudit, and so that any catastrophic DB-module
// failure is downgraded to an [AUDIT_PERSIST_FAIL] log rather than
// crashing the API route at import time.
type DbModule = typeof import("@workspace/db");
let dbModulePromise: Promise<DbModule | null> | null = null;
function loadDbModule(): Promise<DbModule | null> {
  if (!dbModulePromise) {
    dbModulePromise = import("@workspace/db").catch((err) => {
      console.error("[AUDIT_PERSIST_FAIL]", {
        stage: "db_module_load",
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    });
  }
  return dbModulePromise;
}

export type AuditActor =
  | User
  | { id: string; role: string; full_name?: string }
  | "system"
  | "cron";

// JSON-compatible payload Drizzle's jsonb column accepts. Kept narrow
// (no `any`) so callers can't smuggle a class instance or Date in and
// trip JSON.stringify at insert time.
export type AuditJson =
  | string
  | number
  | boolean
  | null
  | { [k: string]: AuditJson }
  | AuditJson[];

export type RecordAuditInput = {
  clinic_id: string;
  actor: AuditActor;
  entity: { type: string; id: string };
  event_type: string;
  summary: string;
  before?: AuditJson;
  after?: AuditJson;
  request?: { ip?: string | null; user_agent?: string | null };
};

function resolveActor(actor: AuditActor): {
  user_id: string | null;
  role: string;
} {
  if (actor === "system") return { user_id: null, role: "system" };
  if (actor === "cron") return { user_id: null, role: "cron" };
  if ("roles" in actor) {
    // Snapshot the first role — when a user holds multiple roles the
    // most-privileged one is conventionally listed first (Owner first,
    // then Admin, etc.) which matches what the UI shows beside each
    // audit row.
    return { user_id: actor.id, role: actor.roles[0] ?? "unknown" };
  }
  return { user_id: actor.id, role: actor.role };
}

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    const mod = await loadDbModule();
    if (!mod) return;
    const { db, auditEventsTable } = mod;
    const { user_id, role } = resolveActor(input.actor);
    await db.insert(auditEventsTable).values({
      clinicId: input.clinic_id,
      actorUserId: user_id,
      actorRole: role,
      entityType: input.entity.type,
      entityId: input.entity.id,
      eventType: input.event_type,
      summary: input.summary,
      before: input.before ?? null,
      after: input.after ?? null,
      requestIp: input.request?.ip ?? null,
      userAgent: input.request?.user_agent ?? null,
    });
  } catch (err) {
    console.error("[AUDIT_PERSIST_FAIL]", {
      event_type: input.event_type,
      entity_type: input.entity.type,
      entity_id: input.entity.id,
      clinic_id: input.clinic_id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
