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

export async function triggerRetrySweepAction(clinicId: string): Promise<void> {
  await runPatientNotificationRetrySweep();
  revalidatePath(`/${clinicId}/ops/retry-sweeps`);
}
