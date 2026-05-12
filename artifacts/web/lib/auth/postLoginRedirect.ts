/**
 * Post-login routing — BLD-2.3.
 *
 * Determines the first URL a user should see after authentication
 * based on their highest-priority role.
 *
 * Priority order:
 *   Coach       → /[clinicId]/coach
 *   Prescriber  → /[clinicId]/clinical-check
 *   Owner/Admin → /[clinicId]/dashboard
 */

import type { User, ClinicId } from '@/lib/api/types';

export function postLoginRedirect(user: User, clinicId: ClinicId): string {
  if (user.roles.includes('Coach')) {
    return `/${clinicId}/coach`;
  }
  if (user.roles.includes('Prescriber')) {
    return `/${clinicId}/clinical-check`;
  }
  return `/${clinicId}/dashboard`;
}
