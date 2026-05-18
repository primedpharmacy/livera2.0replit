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
import { recordAuditImpl } from "./audit.server";

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  await recordAuditImpl(input);
}
