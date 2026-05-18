'use server';

/**
 * Amendment server actions — Task-194.
 */

import { requireServerActionUser } from '@/lib/auth/session';
import { decideAmendment, processRefundAmendment } from '@/lib/api/mock';
import type { Amendment, ClinicId } from '@/lib/api/types';

type DecidePayload = Parameters<typeof decideAmendment>[3];
type RefundPayload = Parameters<typeof processRefundAmendment>[2];

type DecideDecision = Parameters<typeof decideAmendment>[2];

export async function decideAmendmentAction(
  clinicId: ClinicId,
  amendmentId: string,
  decision: DecideDecision,
  payload: DecidePayload,
): Promise<Amendment> {
  const actor = await requireServerActionUser();
  return decideAmendment(clinicId, amendmentId, decision, payload, actor);
}

export async function processRefundAmendmentAction(
  clinicId: ClinicId,
  amendmentId: string,
  payload: RefundPayload,
): Promise<Amendment> {
  const actor = await requireServerActionUser();
  return processRefundAmendment(clinicId, amendmentId, payload, actor);
}
