'use server';

/**
 * Server action — Task-155.
 *
 * Lets the Retry Sweeps page trigger an on-demand sweep instead of waiting
 * for the next 5-minute scheduler tick. Wraps the same
 * `runPatientNotificationRetrySweep` function the scheduler and cron route
 * use, then revalidates the page so the new rows appear at the top.
 */

import { revalidatePath } from 'next/cache';
import { runPatientNotificationRetrySweep } from '@/lib/api/jobs/scheduler';
import { requireServerActionUser } from '@/lib/auth/session';

export async function triggerRetrySweepAction(clinicId: string): Promise<void> {
  // Task-231 — tag the sweep with the ops user who clicked "Run sweep now"
  // so the resulting row + audit line make the human trigger visible.
  const user = await requireServerActionUser();
  await runPatientNotificationRetrySweep({ source: 'manual', actor_id: user.id });
  revalidatePath(`/${clinicId}/ops/retry-sweeps`);
}
