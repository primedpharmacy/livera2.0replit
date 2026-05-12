/**
 * Livera RBAC helper — Wave 1 (updated to use clinic.config.coaching_enabled).
 *
 * BLD-1.1: coaching_enabled moved from clinic.features to clinic.config per §6.1.
 *
 * Role matrix (V1.2 — 4 active roles):
 *   Owner      → everything
 *   Admin      → operational tasks (patients, orders, welcome_calls)
 *   Prescriber → clinical surfaces + decide/approve/reject
 *   Coach      → own patient roster + coaching_log (coaching-enabled clinics only)
 *
 * Deprecated roles (code retained for migration): RM | Manager | Pharmacist | Technician
 */

import type { User, Clinic } from "@/lib/api/mock";

export type Action = "read" | "write" | "decide" | "approve" | "reject";
export type Resource =
  | "patients"
  | "orders"
  | "incidents"
  | "complaints"
  | "gp_letters"
  | "settings"
  | "schedule"
  | "coaching_log"
  | "coach_dashboard"
  | "clinical_check"
  | "amendments"
  | "welcome_calls"
  | "kpi_dashboard"
  | "clinical_flags"
  | "reports"
  | "tasks"
  | "team";

// ---------------------------------------------------------------------------
// Role permission tables
// ---------------------------------------------------------------------------

const PRESCRIBER_READ: Resource[] = [
  "patients", "orders", "clinical_check", "amendments",
  "incidents", "complaints", "gp_letters", "schedule",
  "kpi_dashboard", "clinical_flags", "reports",
];

const PRESCRIBER_DECIDE: Resource[] = ["orders", "amendments"];

const ADMIN_READ: Resource[] = ["patients", "orders", "welcome_calls", "tasks"];

const COACH_READ: Resource[] = ["patients", "schedule", "coach_dashboard"];

// ---------------------------------------------------------------------------
// Role matrix
// ---------------------------------------------------------------------------

function roleMatrix(
  role: string,
  action: string,
  resource: string,
  context?: { clinic?: Clinic; ownerId?: string; userId?: string }
): boolean {
  switch (role) {
    case "Owner":
      return true;

    case "RM":
      // Deprecated — retained for migration; treat same as Owner during transition
      return true;

    case "Prescriber":
      if (action === "read")   return PRESCRIBER_READ.includes(resource as Resource);
      if (action === "decide") return PRESCRIBER_DECIDE.includes(resource as Resource);
      if (action === "approve" || action === "reject") return PRESCRIBER_DECIDE.includes(resource as Resource);
      return false;

    case "Coach": {
      // BLD-1.1: coaching_enabled is now on clinic.config (not clinic.features)
      if (context?.clinic && !context.clinic.config.coaching_enabled) return false;
      if (action === "read") return COACH_READ.includes(resource as Resource);
      if (action === "write" && resource === "coaching_log") return true;
      // Coach can only read their assigned patient roster
      if (resource === "patients" && action === "read") {
        return context?.ownerId === context?.userId;
      }
      return false;
    }

    case "Admin":
      if (action === "read") return ADMIN_READ.includes(resource as Resource);
      return false;

    // Deprecated roles — no access in V1.2 UI
    case "Manager":
    case "Pharmacist":
    case "Technician":
      return false;

    default:
      return false;
  }
}

/**
 * Check whether a user can perform `action` on `resource`.
 *
 * @param user    - The acting user (CURRENT_USER from constants.ts in dev)
 * @param action  - Verb: "read" | "write" | "decide" | "approve" | "reject"
 * @param resource - Resource slug (see Resource type above)
 * @param context - Optional: clinic (for Coach coaching_enabled gate), ownerId (for ownership checks)
 */
export function can(
  user: User,
  action: Action | string,
  resource: Resource | string,
  context?: { clinic?: Clinic; ownerId?: string; userId?: string }
): boolean {
  return user.roles.some((role) =>
    roleMatrix(role, action, resource, { ...context, userId: user.id })
  );
}
