'use server';

/**
 * Pharmacy Comm server actions — Task-194.
 */

import { requireServerActionUser } from '@/lib/auth/session';
import { createPharmacyCommThread, replyToPharmacyCommThread } from '@/lib/api/mock';
import type { ClinicId, PharmacyCommMessage, PharmacyCommThread } from '@/lib/api/types';

type CreateThreadPayload = Parameters<typeof createPharmacyCommThread>[1];

export async function createPharmacyCommThreadAction(
  clinicId: ClinicId,
  payload: CreateThreadPayload,
): Promise<PharmacyCommThread> {
  const actor = await requireServerActionUser();
  return createPharmacyCommThread(clinicId, payload, actor);
}

export async function replyToPharmacyCommThreadAction(
  clinicId: ClinicId,
  threadId: string,
  body: string,
  attachments: string[] = [],
): Promise<PharmacyCommMessage> {
  const actor = await requireServerActionUser();
  return replyToPharmacyCommThread(clinicId, threadId, body, attachments, actor);
}
