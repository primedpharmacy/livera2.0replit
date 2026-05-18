/**
 * Audit helper — task #167.
 *
 * Every mutating fixture call already emits a `console.log('[AUDIT]', …)`
 * line for live tailing. This helper layers a *durable* write into the
 * shared `audit_events` Postgres table (see `lib/db/src/schema/audit.ts`)
 * so the trail survives process restarts and powers the per-entity
 * Activity tabs + global Activity page.
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
 *
 * Task-288 split
 * --------------
 * This file is now a *client-safe shim*. The DB-touching code lives in
 * `./audit.server.ts`, which is guarded by `import "server-only"` — so
 * any accidental static import from a client component fails the build
 * at compile time. The shim lazy-loads the server impl through a
 * `webpackIgnore`'d dynamic import so webpack never even tries to bundle
 * the server module (and therefore never tries to bundle `pg`) into a
 * client chunk. On the browser the import simply fails and the helper
 * downgrades to a `[AUDIT_PERSIST_FAIL]` log line — which is acceptable
 * because mutations on the browser are dev-mode fixtures that have no
 * real database write to perform anyway.
 */

import type { User } from "./types";

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

// `process.versions?.node` is true in Node and in the vitest jsdom
// environment, and `undefined` in real browsers — exactly the gate we
// want for "is it safe to attempt loading the server impl?". `typeof
// window` is the wrong gate because vitest's jsdom defines `window`.
const isNodeRuntime =
  typeof process !== "undefined" && Boolean(process.versions?.node);

type ServerImpl = typeof import("./audit.server");
let serverImplPromise: Promise<ServerImpl | null> | null = null;

function loadServerImpl(): Promise<ServerImpl | null> {
  if (!isNodeRuntime) return Promise.resolve(null);
  if (!serverImplPromise) {
    // `webpackIgnore` keeps `./audit.server` out of every webpack chunk
    // — including the client chunks — so the `pg` driver it transitively
    // imports never reaches the browser. At runtime the host module
    // system (Node ESM on the server, vitest's vite on the test runner)
    // resolves the relative specifier the normal way. This is the
    // intended escape hatch for a sibling module that is itself
    // explicitly `server-only`.
    serverImplPromise = import(
      /* webpackIgnore: true */ "./audit.server"
    ).catch((err) => {
      console.error("[AUDIT_PERSIST_FAIL]", {
        stage: "server_impl_load",
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    });
  }
  return serverImplPromise;
}

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    const impl = await loadServerImpl();
    if (!impl) return;
    await impl.recordAuditImpl(input);
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
