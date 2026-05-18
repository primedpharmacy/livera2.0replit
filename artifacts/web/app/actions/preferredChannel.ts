'use server';

/**
 * Server action wrapper around updatePatientPreferredChannel.
 *
 * Why this exists: the underlying mock fixture mutates an in-memory array
 * (MOCK_PATIENTS / PREFERRED_CHANNEL_CHANGES). When the call originates from
 * a "use client" component it runs in the browser bundle, which is a
 * separate JS realm from the Node server that renders the patient page. The
 * mutation never crosses that boundary, so router.refresh() pulls a stale
 * RSC payload back from the server and the UI silently reverts.
 *
 * Routing the mutation through a server action keeps both the persistence
 * and the audit log on the server (matching how the resend-notification
 * action is wired in app/(workspace)/[clinic_id]/patients/[patient_id]/page.tsx)
 * and revalidates the patient profile so the channel chip, change history
 * and Notification log all re-render against the new state.
 *
 * Authorization: the actor is resolved server-side from the signed session
 * cookie via requireServerActionUser() — never trust a client-supplied uid.
 * That actor is then passed explicitly to updatePatientPreferredChannel,
 * whose can(actor, 'write', 'patients') check raises SAFETY_VIOLATION for
 * Coach/Prescriber, so a Coach who tries to invoke this action directly
 * (bypassing the UI gate) is still rejected on the server.
 */

import { revalidatePath } from 'next/cache';
import { updatePatientPreferredChannel } from '@/lib/api/mock';
import type { ClinicId } from '@/lib/api/types';
import { requireServerActionUser } from '@/lib/auth/session';

export async function updatePreferredChannelAction(
  clinicId: ClinicId,
  patientId: string,
  channel: 'email' | 'sms' | 'phone',
): Promise<void> {
  const actor = await requireServerActionUser();
  await updatePatientPreferredChannel(clinicId, patientId, channel, actor);
  revalidatePath(`/${clinicId}/patients/${patientId}`);
}
