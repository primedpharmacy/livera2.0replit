/**
 * In-process job scheduler — Task-74.
 *
 * Wires the failed-email retry job (`retryFailedPatientNotifications`) up to a
 * recurring interval so operators don't have to trigger it manually.
 *
 * Booted from `instrumentation.ts` so it starts once per Node.js server process
 * (Next.js calls `register()` before serving requests). A module-level guard
 * (`__SCHEDULER_STARTED`) prevents double-registration across HMR reloads in
 * dev.
 *
 * For every tick, the job runs once per clinic (sequentially, so audit lines
 * are grouped per clinic) and always emits a `[AUDIT] scheduled_retry_run`
 * line — even when nothing was eligible — so operators can confirm the loop
 * is alive.
 */

import { listClinics } from '../fixtures/clinics';
import { NOW } from '../constants';
import {
  retryFailedPatientNotifications,
  type RetryPatientNotificationsResult,
} from './retryPatientNotifications';
import type { ClinicId } from '../types';

export type SweepClinicSummary = {
  clinic_id:     ClinicId;
  outcome:       'success' | 'error';
  considered:    number;
  attempted:     number;
  delivered:     number;
  bounced:       number;
  still_failing: number;
  exhausted:     number;
  error_message: string | null;
};

const RETRY_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

declare global {
  // eslint-disable-next-line no-var
  var __LIVERA_SCHEDULER_STARTED__: boolean | undefined;
}

export async function runPatientNotificationRetrySweep(): Promise<SweepClinicSummary[]> {
  const clinics = await listClinics();
  const summaries: SweepClinicSummary[] = [];

  for (const clinic of clinics) {
    try {
      const result: RetryPatientNotificationsResult =
        await retryFailedPatientNotifications(clinic.id);
      const summary: SweepClinicSummary = {
        clinic_id:     clinic.id,
        outcome:       'success',
        considered:    result.considered,
        attempted:     result.attempted,
        delivered:     result.delivered.length,
        bounced:       result.bounced.length,
        still_failing: result.still_failing.length,
        exhausted:     result.exhausted.length,
        error_message: null,
      };
      summaries.push(summary);
      console.log('[AUDIT]', {
        event_type:    'scheduled_retry_run',
        outcome:       'success',
        actor_id:      'system',
        job:           'retryFailedPatientNotifications',
        clinic_id:     clinic.id,
        considered:    summary.considered,
        attempted:     summary.attempted,
        delivered:     summary.delivered,
        bounced:       summary.bounced,
        still_failing: summary.still_failing,
        exhausted:     summary.exhausted,
        timestamp:     NOW,
      });
    } catch (err) {
      const error_message = err instanceof Error ? err.message : String(err);
      summaries.push({
        clinic_id:     clinic.id,
        outcome:       'error',
        considered:    0,
        attempted:     0,
        delivered:     0,
        bounced:       0,
        still_failing: 0,
        exhausted:     0,
        error_message,
      });
      console.error('[AUDIT]', {
        event_type:    'scheduled_retry_run',
        outcome:       'error',
        actor_id:      'system',
        job:           'retryFailedPatientNotifications',
        clinic_id:     clinic.id,
        error_message,
        timestamp:     NOW,
      });
    }
  }

  return summaries;
}

export function startJobScheduler(): void {
  if (globalThis.__LIVERA_SCHEDULER_STARTED__) return;
  globalThis.__LIVERA_SCHEDULER_STARTED__ = true;

  console.log('[AUDIT]', {
    event_type: 'scheduler_started',
    outcome:    'success',
    actor_id:   'system',
    job:        'retryFailedPatientNotifications',
    interval_ms: RETRY_INTERVAL_MS,
    timestamp:  NOW,
  });

  // Kick off an initial sweep shortly after boot so audit logs appear without
  // waiting a full interval, then continue on the recurring schedule.
  setTimeout(() => {
    void runPatientNotificationRetrySweep();
  }, 10 * 1000);

  const timer = setInterval(() => {
    void runPatientNotificationRetrySweep();
  }, RETRY_INTERVAL_MS);

  // Avoid keeping the Node.js event loop alive solely for this timer (so
  // graceful shutdowns aren't blocked).
  if (typeof timer.unref === 'function') timer.unref();
}
