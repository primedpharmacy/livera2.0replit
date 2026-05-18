/**
 * Audit helper — server-only implementation (task #292).
 *
 * Tagged with `import "server-only"` so any future client component that
 * accidentally reaches this module via a transitive `import` fails loudly at
 * build time, instead of silently dragging `@workspace/db` (and its `pg`
 * driver / Node `fs`) into the browser bundle.
 *
 * Public callers go through the `recordAudit` server-action wrapper exported
 * from `./audit.ts`, which gives us a thin server boundary for fixtures and
 * server-side code paths alike.
 *
 * Design rules (carried over from the original task-167 helper):
 *   - **Never throw.** The pino line has already been emitted and the
 *     business mutation has already succeeded; an audit insert failure must
 *     never bubble up to the caller. We catch every error and log
 *     `[AUDIT_PERSIST_FAIL]` so on-call can spot dropped rows.
 *   - **Snapshot the actor's role** at write time so a later role change does
 *     not rewrite history. `actor: 'system'` covers cron / webhook callers
 *     that have no signed-in user.
 *   - **Keep PII out.** `before` / `after` should already be the same
 *     redacted payload the pino line carries (e.g. patient_name_hash, not
 *     full_name). This helper does not redact further — it stores what
 *     callers hand it.
 */

import "server-only";

import { db, auditEventsTable } from "@workspace/db";

import type { AuditActor, RecordAuditInput } from "./audit-types";

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

export async function recordAuditImpl(input: RecordAuditInput): Promise<void> {
  try {
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
