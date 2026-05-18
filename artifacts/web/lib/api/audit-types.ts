/**
 * Audit helper — type-only module (task #292).
 *
 * Lives in a separate file from `audit.ts` because `audit.ts` carries the
 * `"use server"` directive, which restricts file-level exports to async
 * functions. Pulling the public types out into this browser-safe module lets
 * any caller — server, client, or test — type a `recordAudit` payload
 * without dragging in the server-only DB driver.
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
