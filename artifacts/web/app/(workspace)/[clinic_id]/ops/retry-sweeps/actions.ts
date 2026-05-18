'use server';

/**
 * Server action — Task-155, hardened in Task-232, attribution in Task-231.
 *
 * Lets the Retry Sweeps page trigger an on-demand sweep instead of waiting
 * for the next 5-minute scheduler tick. Wraps the same
 * `runPatientNotificationRetrySweep` function the scheduler and cron route
 * use, then revalidates the page so the new rows appear at the top.
 *
 * Authorisation
 * -------------
 * The Retry Sweeps page sits behind the sidebar's `read`/`settings`
 * permission gate (see `components/shell/Sidebar.tsx`). The action mutates
 * state (it dispatches retry sends and writes audit lines) so we must
 * re-check that the *authenticated* caller actually holds that permission
 * — server actions are reachable via any POST to the page URL, so trusting
 * the sidebar gate alone would let a non-privileged user trigger work just
 * by crafting the request. The actor is resolved via
 * `requireServerActionUser()` (signed app-session cookie) — never via the
 * hard-coded `CURRENT_USER` constant, which is documented as non-
 * authoritative for auth. Unauthorised attempts throw and are written to
 * the audit log so we can spot abuse after the fact.
 *
 * The resolved user is also forwarded to `runPatientNotificationRetrySweep`
 * via `{ source: 'manual', actor_id }` so the resulting sweep row + audit
 * line attribute the run to the human who clicked "Run sweep now"
 * (Task-231) instead of looking like another scheduler tick.
 */

import { revalidatePath } from 'next/cache';
import { runPatientNotificationRetrySweep } from '@/lib/api/jobs/scheduler';
import { requireServerActionUser } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { recordAudit } from '@/lib/api/audit';

export async function triggerRetrySweepAction(clinicId: string): Promise<void> {
  const actor = await requireServerActionUser();

  if (!can(actor, 'read', 'settings')) {
    // Durable audit trail of the blocked attempt — mirrors the
    // fire-and-forget pattern used everywhere else recordAudit is called
    // so a DB hiccup never masks the thrown error the caller sees.
    void recordAudit({
      clinic_id: clinicId,
      actor,
      entity: { type: 'retry_sweep', id: clinicId },
      event_type: 'patient_notification_retry_sweep_unauthorized',
      summary:
        `Blocked unauthorised attempt to trigger patient-notification retry sweep ` +
        `by ${actor.full_name ?? actor.id} ` +
        `(roles: ${actor.roles.join(', ') || 'none'}).`,
      after: {
        attempted_clinic_id: clinicId,
        actor_roles: actor.roles,
      },
    });
    throw new Error(
      'forbidden: settings read permission required to trigger retry sweeps',
    );
  }

  await runPatientNotificationRetrySweep({ source: 'manual', actor_id: actor.id });
  revalidatePath(`/${clinicId}/ops/retry-sweeps`);
}
