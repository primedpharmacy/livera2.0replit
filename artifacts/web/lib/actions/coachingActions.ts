'use server';

/**
 * Coaching server actions — Task-194 / Task-293.
 */

import {
  requireServerActionUser,
  requirePermission,
} from '@/lib/auth/session';
import { addCoachingLog, getClinic } from '@/lib/api/mock';
import type { ClinicId, CoachingLog } from '@/lib/api/types';

type AddCoachingLogPayload = Parameters<typeof addCoachingLog>[1];

export async function addCoachingLogAction(
  clinicId: ClinicId,
  data: AddCoachingLogPayload,
): Promise<CoachingLog> {
  const actor = await requireServerActionUser();
  // `can()` for Coach role honours clinic.config.coaching_enabled — pass clinic
  // so a coach on a coaching-disabled clinic is rejected up-front.
  const clinic = await getClinic(clinicId);
  requirePermission(actor, 'write', 'coaching_log', { clinic });
  return addCoachingLog(clinicId, data, actor);
}
