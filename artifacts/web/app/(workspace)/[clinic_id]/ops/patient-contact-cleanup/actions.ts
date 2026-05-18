'use server';

/**
 * Server action — Task-249.
 *
 * Lets the Patient Contact Cleanup page run `cleanupPatientContactData`
 * on demand. Wraps the same job the audit/script callers use, then
 * revalidates the page so the new list (and badge count) reflect any
 * records that were auto-normalised on this run.
 *
 * Authorisation
 * -------------
 * Mirrors `triggerRetrySweepAction`: the page sits behind the sidebar's
 * `read`/`settings` permission gate, but server actions are reachable via
 * any POST to the page URL so we re-check authorisation against the
 * *authenticated* caller (`requireServerActionUser`) — never the
 * hard-coded `CURRENT_USER`. Blocked attempts are written to the audit
 * stream for after-the-fact review.
 */

import { revalidatePath } from 'next/cache';
import { cleanupPatientContactData } from '@/lib/api/jobs/cleanupPatientContactData';
import { requireServerActionUser } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { recordAudit } from '@/lib/api/audit';
import type { ClinicId } from '@/lib/api/types';

export async function triggerPatientContactCleanupAction(
  clinicId: string,
): Promise<void> {
  const actor = await requireServerActionUser();

  if (!can(actor, 'read', 'settings')) {
    void recordAudit({
      clinic_id: clinicId,
      actor,
      entity: { type: 'patient_contact_cleanup', id: clinicId },
      event_type: 'patient_contact_cleanup_unauthorized',
      summary:
        `Blocked unauthorised attempt to trigger patient contact cleanup ` +
        `by ${actor.full_name ?? actor.id} ` +
        `(roles: ${actor.roles.join(', ') || 'none'}).`,
      after: {
        attempted_clinic_id: clinicId,
        actor_roles: actor.roles,
      },
    });
    throw new Error(
      'forbidden: settings read permission required to trigger patient contact cleanup',
    );
  }

  if (clinicId !== 'vsc' && clinicId !== 'feeltru') {
    // Never silently fall back to `undefined` (which would run the cleanup
    // across every clinic). A server action is reachable via crafted POSTs,
    // so an invalid clinic id has to throw rather than escalate scope.
    throw new Error(`invalid clinic id: ${clinicId}`);
  }

  await cleanupPatientContactData(clinicId as ClinicId);
  revalidatePath(`/${clinicId}/ops/patient-contact-cleanup`);
}
