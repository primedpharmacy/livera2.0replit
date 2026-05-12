/**
 * Livera RBAC helper — Wave 2 (BLD-2.1 coach surface).
 *
 * Role matrix (V1.2 — 4 active roles):
 *   Owner      → everything
 *   Admin      → operational tasks (patients, orders, welcome_calls)
 *   Prescriber → clinical surfaces + decide/approve/reject
 *   Coach      → own patient roster + coaching_log (coaching-enabled clinics only)
 *               read-only: gp_letters, incidents
 *
 * Deprecated roles (code retained for migration): RM | Manager | Pharmacist | Technician
 *
 * Wave 2 additions:
 *   - COACH_READ expanded: gp_letters, incidents, coaching_log
 *   - 'coaching_escalation' resource added
 *   - canCoachAccessPatient() helper (BLD-2.1)
 */

import type { User, Clinic, Patient } from '@/lib/api/types';

export type Action = 'read' | 'write' | 'decide' | 'approve' | 'reject' | 'acknowledge';
export type Resource =
  | 'patients'
  | 'orders'
  | 'incidents'
  | 'complaints'
  | 'gp_letters'
  | 'settings'
  | 'schedule'
  | 'coaching_log'
  | 'coach_dashboard'
  | 'clinical_check'
  | 'amendments'
  | 'welcome_calls'
  | 'kpi_dashboard'
  | 'clinical_flags'
  | 'reports'
  | 'tasks'
  | 'team'
  | 'coaching_escalation'
  // Wave 3 additions
  | 'clinical_notes'    // BLD-4.1 — Prescriber + Admin write; Coach cannot
  | 'sla_breaches';     // BLD-3.2 — Prescriber + Admin + Owner acknowledge

// ---------------------------------------------------------------------------
// Role permission tables
// ---------------------------------------------------------------------------

const PRESCRIBER_READ: Resource[] = [
  'patients', 'orders', 'clinical_check', 'amendments',
  'incidents', 'complaints', 'gp_letters', 'schedule',
  'kpi_dashboard', 'clinical_flags', 'reports',
  'clinical_notes', 'sla_breaches',
];

const PRESCRIBER_DECIDE: Resource[] = ['orders', 'amendments'];

const ADMIN_READ: Resource[] = ['patients', 'orders', 'welcome_calls', 'tasks'];

const COACH_READ: Resource[] = [
  'patients',
  'schedule',
  'coach_dashboard',
  'coaching_log',
  'gp_letters',        // read-only per BLD-2.1
  'incidents',         // read-only per BLD-2.1
];

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
    case 'Owner':
      return true;

    case 'RM':
      // Deprecated — retained for migration; treat same as Owner during transition
      return true;

    case 'Prescriber':
      if (action === 'read')   return PRESCRIBER_READ.includes(resource as Resource);
      if (action === 'decide') return PRESCRIBER_DECIDE.includes(resource as Resource);
      if (action === 'approve' || action === 'reject')
        return PRESCRIBER_DECIDE.includes(resource as Resource);
      if (action === 'write'       && resource === 'coaching_escalation') return true;
      if (action === 'write'       && resource === 'clinical_notes')       return true;
      if (action === 'acknowledge' && resource === 'sla_breaches')         return true;
      return false;

    case 'Coach': {
      // BLD-1.1: coaching_enabled is on clinic.config (not clinic.features)
      if (context?.clinic && !context.clinic.config.coaching_enabled) return false;
      if (action === 'read') return COACH_READ.includes(resource as Resource);
      if (action === 'write' && resource === 'coaching_log') return true;
      if (action === 'write' && resource === 'coaching_escalation') return true;
      return false;
    }

    case 'Admin':
      if (action === 'read') return ADMIN_READ.includes(resource as Resource);
      if (action === 'write'       && resource === 'clinical_notes') return true;
      if (action === 'acknowledge' && resource === 'sla_breaches')   return true;
      return false;

    // Deprecated roles — no access in V1.2 UI
    case 'Manager':
    case 'Pharmacist':
    case 'Technician':
      return false;

    default:
      return false;
  }
}

/**
 * Check whether a user can perform `action` on `resource`.
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

/**
 * Check whether a coach has access to a specific patient.
 *
 * Rules (BLD-2.1):
 *   - User must have Coach role
 *   - patient.coach_id must equal coach.id
 *   - If clinic is provided, coaching_enabled must be true
 */
export function canCoachAccessPatient(
  coach: User,
  patient: Patient,
  clinic?: Clinic
): boolean {
  if (!coach.roles.includes('Coach')) return false;
  if (clinic && !clinic.config.coaching_enabled) return false;
  return patient.coach_id === coach.id;
}
