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
  | "tasks";

// ---------------------------------------------------------------------------
// Role matrix
//
//  Owner      → everything
//  RM         → everything (+ governance surfaces)
//  Prescriber → read clinical surfaces + decide/approve/reject orders/amendments
//  Coach      → own patient roster + coaching_log (only on coaching-enabled clinics)
//  Admin      → welcome calls + basic patient demographics + order status only
// ---------------------------------------------------------------------------

const PRESCRIBER_READ: Resource[] = [
  "patients", "orders", "clinical_check", "amendments",
  "incidents", "complaints", "gp_letters", "schedule",
  "kpi_dashboard", "clinical_flags", "reports",
];

const PRESCRIBER_DECIDE: Resource[] = ["orders", "amendments"];

const ADMIN_READ: Resource[] = ["patients", "orders", "welcome_calls"];

const COACH_READ: Resource[] = ["patients", "schedule", "coach_dashboard"];

function roleMatrix(
  role: string,
  action: string,
  resource: string,
  context?: { clinic?: Clinic; ownerId?: string; userId?: string }
): boolean {
  switch (role) {
    case "Owner":
    case "RM":
      return true;

    case "Prescriber":
      if (action === "read")   return PRESCRIBER_READ.includes(resource as Resource);
      if (action === "decide") return PRESCRIBER_DECIDE.includes(resource as Resource);
      if (action === "approve" || action === "reject") return PRESCRIBER_DECIDE.includes(resource as Resource);
      return false;

    case "Coach": {
      // Coach surfaces are only available on coaching-enabled clinics
      if (context?.clinic && !context.clinic.config.coaching_enabled) return false;
      if (action === "read")  return COACH_READ.includes(resource as Resource);
      if (action === "write" && resource === "coaching_log") return true;
      // Can only read their own patient roster
      if (resource === "patients" && action === "read") {
        return context?.ownerId === context?.userId;
      }
      return false;
    }

    case "Admin":
      if (action === "read") return ADMIN_READ.includes(resource as Resource);
      return false;

    default:
      return false;
  }
}

/**
 * Check whether a user can perform `action` on `resource`.
 *
 * @param user    - The acting user (use CURRENT_USER from mock.ts in dev)
 * @param action  - Verb: "read" | "write" | "decide" | "approve" | "reject"
 * @param resource - Resource slug (see Resource type above)
 * @param context - Optional extra context (clinic for Coach gate, ownerId for ownership checks)
 */
export function can(
  user: User,
  action: Action | string,
  resource: Resource | string,
  context?: { clinic?: Clinic; ownerId?: string; userId?: string }
): boolean {
  // Multi-role: grant if any role allows
  return user.roles.some((role) =>
    roleMatrix(role, action, resource, { ...context, userId: user.id })
  );
}
