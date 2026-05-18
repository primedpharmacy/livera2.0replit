'use server';

/**
 * Coaching server actions — Task-194.
 */

import { requireServerActionUser } from '@/lib/auth/session';
import { addCoachingLog } from '@/lib/api/mock';
import type { ClinicId, CoachingLog } from '@/lib/api/types';

type AddCoachingLogPayload = Parameters<typeof addCoachingLog>[1];

export async function addCoachingLogAction(
  clinicId: ClinicId,
  data: AddCoachingLogPayload,
): Promise<CoachingLog> {
  const actor = await requireServerActionUser();
  return addCoachingLog(clinicId, data, actor);
}
