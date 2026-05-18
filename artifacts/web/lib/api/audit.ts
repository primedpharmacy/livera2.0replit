/**
 * Audit helper — server-action boundary (task #292, supersedes task #167).
 *
 * This file is the **thin server boundary** between fixtures (some of which
 * are reachable from client components via the `lib/api/mock` barrel) and
 * the real `recordAuditImpl` in `./audit.server.ts` (server-only, direct
 * `@workspace/db` import).
 *
 * The `"use server"` directive tells Next.js that the exports are Server
 * Actions: on the server they run in-process, while on the client they are
 * replaced with an RPC stub at build time. That means `audit.server.ts`
 * (and its transitive `pg` driver) is never pulled into the browser bundle,
 * even when a client component static-imports a fixture file that calls
 * `recordAudit`. The previous `webpackIgnore` / lazy-`import()` escape hatch
 * has been removed; the chain now fails *loudly at build time* if anyone
 * accidentally imports `./audit.server` from a Client Component instead of
 * silently bloating the browser bundle.
 *
 * Public types live in `./audit-types` because `"use server"` files may only
 * export async functions.
 */

"use server";

import type { RecordAuditInput } from "./audit-types";
import {
  recordAuditImpl,
  listEmailEnvelopeBackfillRunsImpl,
  type EmailEnvelopeBackfillRun,
} from "./audit.server";

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  await recordAuditImpl(input);
}

/**
 * Task #298 — power the small "Recent runs" history panel on the
 * email-envelope-backfill admin page. Returns the most recent N runs
 * (defaults to 20) for the given clinic, newest first. History is sourced
 * straight from the existing `audit_events` table (event type
 * `patient_notification_envelope_backfill_run`) — no new schema.
 *
 * A `"use server"` boundary is required because the underlying impl pulls
 * in `@workspace/db`; without this wrapper a server component on the admin
 * page would still type-check but the eventual import graph could leak the
 * pg driver into the client bundle, mirroring the constraint that motivated
 * the original `recordAudit` boundary.
 */
export async function listEmailEnvelopeBackfillRuns(
  clinicId: string,
  limit?: number,
): Promise<EmailEnvelopeBackfillRun[]> {
  return listEmailEnvelopeBackfillRunsImpl(clinicId, limit);
}
