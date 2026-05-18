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
 *
 * Read-side helpers (task #298):
 *   - `listEmailEnvelopeBackfillRunsImpl` powers the small history panel on
 *     the email-envelope-backfill admin page. Reads come straight from the
 *     existing `audit_events` table — no new schema, no new index. The
 *     `(clinic_id, occurred_at desc)` index added in task #167 already
 *     serves this query in index order.
 */

import "server-only";

import { db, auditEventsTable, and, desc, eq } from "@workspace/db";

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

/**
 * One row in the email-envelope-backfill history list.
 *
 * The shape is intentionally flat & UI-shaped (no raw jsonb): every value
 * we'd otherwise have to dig out of `after` on the client is already pulled
 * out here, with safe defaults when an older row was written before a counter
 * existed. That keeps the client component free of `any` / jsonb spelunking.
 */
export type EmailEnvelopeBackfillRun = {
  id: string;
  occurred_at: string;
  actor_user_id: string | null;
  actor_role: string;
  scope: "this_clinic" | "all_clinics" | "unknown";
  considered: number;
  backfilled_count: number;
  unrecoverable_count: number;
  html_backfilled: number;
  html_unsupported: number;
  skipped: number;
  summary: string;
};

function asNumber(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function asScope(v: unknown): EmailEnvelopeBackfillRun["scope"] {
  return v === "this_clinic" || v === "all_clinics" ? v : "unknown";
}

export async function listEmailEnvelopeBackfillRunsImpl(
  clinicId: string,
  limit = 20,
): Promise<EmailEnvelopeBackfillRun[]> {
  try {
    const rows = await db
      .select({
        id: auditEventsTable.id,
        occurredAt: auditEventsTable.occurredAt,
        actorUserId: auditEventsTable.actorUserId,
        actorRole: auditEventsTable.actorRole,
        summary: auditEventsTable.summary,
        after: auditEventsTable.after,
      })
      .from(auditEventsTable)
      .where(
        and(
          eq(auditEventsTable.clinicId, clinicId),
          eq(
            auditEventsTable.eventType,
            "patient_notification_envelope_backfill_run",
          ),
        ),
      )
      .orderBy(desc(auditEventsTable.occurredAt))
      .limit(limit);

    return rows.map((r) => {
      const after = (r.after ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        occurred_at:
          r.occurredAt instanceof Date
            ? r.occurredAt.toISOString()
            : String(r.occurredAt),
        actor_user_id: r.actorUserId,
        actor_role: r.actorRole,
        scope: asScope(after.scope),
        considered: asNumber(after.considered),
        backfilled_count: asNumber(after.backfilled_count),
        unrecoverable_count: asNumber(after.unrecoverable_count),
        html_backfilled: asNumber(after.html_backfilled),
        html_unsupported: asNumber(after.html_unsupported),
        skipped: asNumber(after.skipped),
        summary: r.summary,
      };
    });
  } catch (err) {
    // History is best-effort — a transient DB error must not break the
    // admin page (which still needs to let staff trigger a fresh run).
    console.error("[AUDIT_READ_FAIL]", {
      query: "listEmailEnvelopeBackfillRuns",
      clinic_id: clinicId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
