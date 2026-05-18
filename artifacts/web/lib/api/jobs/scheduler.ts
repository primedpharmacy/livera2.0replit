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
import { sendPxUploadReminders } from './sendPxUploadReminders';
import { autoChaseExpiringPxUploadLinks } from './autoChaseExpiringPxUploadLinks';
import { autoSwitchBouncedSmsChannel } from './autoSwitchBouncedSmsChannel';
import { evaluateSweepForOnCall } from './oncallAlerts';
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

// Task-231 — distinguish manually-triggered sweeps from scheduler/cron runs so
// the Retry Sweeps table and the [AUDIT] line both record who kicked off the
// sweep. `actor_id` is the user uid for manual runs, or 'system' otherwise.
export type SweepTriggerSource = 'scheduler' | 'cron' | 'manual';

export type SweepTrigger = {
  source:    SweepTriggerSource;
  actor_id:  string; // user uid for 'manual', otherwise 'system'
};

export type SweepRecord = SweepClinicSummary & {
  timestamp:      string; // ISO — wall-clock time the sweep tick ran
  sweep_id:       string; // shared across all clinic rows from the same tick
  trigger_source: SweepTriggerSource;
  actor_id:       string;
};

const RETRY_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const SWEEP_HISTORY_MAX = 100;

// Task-92 — px-upload reminders need only daily granularity (48h after sent_at
// / within 24h of expires_at), but we re-tick hourly so reminders land within
// an hour of becoming due even if the server has only been up briefly.
const PX_UPLOAD_REMINDER_INTERVAL_MS = 60 * 60 * 1000; // every 60 minutes

// Task-175 — auto-chase expired upload links. Hourly cadence so the rotation
// lands within an hour of the link going stale; the job's own retry cap
// (MAX_AUTO_RESENDS) stops it from spamming patients.
const PX_UPLOAD_AUTO_CHASE_INTERVAL_MS = 60 * 60 * 1000; // every 60 minutes

// Task-286 — auto-switch dead-phone patients to email after consecutive SMS
// bounces. Hourly cadence is plenty: each Twilio bounce takes a real send to
// accrue, so even at a high notification volume the threshold won't be hit
// more than a few times per hour per clinic. The job itself is idempotent —
// patients already migrated this run will not be candidates next tick.
const AUTO_SWITCH_BOUNCED_SMS_INTERVAL_MS = 60 * 60 * 1000; // every 60 minutes

declare global {
  // eslint-disable-next-line no-var
  var __LIVERA_SCHEDULER_STARTED__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __LIVERA_SWEEP_HISTORY__: SweepRecord[] | undefined;
}

function recordSweepEntries(entries: SweepRecord[]): void {
  const buf = (globalThis.__LIVERA_SWEEP_HISTORY__ ??= []);
  buf.push(...entries);
  if (buf.length > SWEEP_HISTORY_MAX) {
    buf.splice(0, buf.length - SWEEP_HISTORY_MAX);
  }
}

/**
 * Returns the most recent sweep records (newest first). Used by the ops
 * "Retry sweeps" page so operators can confirm the loop is healthy without
 * tailing server logs.
 */
export function getRecentRetrySweeps(limit = SWEEP_HISTORY_MAX): SweepRecord[] {
  const buf = globalThis.__LIVERA_SWEEP_HISTORY__ ?? [];
  return buf.slice(-limit).reverse();
}

const DEFAULT_TRIGGER: SweepTrigger = { source: 'scheduler', actor_id: 'system' };

export async function runPatientNotificationRetrySweep(
  trigger: SweepTrigger = DEFAULT_TRIGGER,
): Promise<SweepClinicSummary[]> {
  const clinics = await listClinics();
  const summaries: SweepClinicSummary[] = [];
  const sweep_id = `sweep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const sweep_started_at = new Date().toISOString();
  const records: SweepRecord[] = [];
  const { source: trigger_source, actor_id } = trigger;

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
      records.push({ ...summary, timestamp: sweep_started_at, sweep_id, trigger_source, actor_id });
      console.log('[AUDIT]', {
        event_type:     'scheduled_retry_run',
        outcome:        'success',
        actor_id,
        trigger_source,
        job:            'retryFailedPatientNotifications',
        clinic_id:      clinic.id,
        considered:     summary.considered,
        attempted:      summary.attempted,
        delivered:      summary.delivered,
        bounced:        summary.bounced,
        still_failing:  summary.still_failing,
        exhausted:      summary.exhausted,
        timestamp:      NOW,
      });
    } catch (err) {
      const error_message = err instanceof Error ? err.message : String(err);
      const summary: SweepClinicSummary = {
        clinic_id:     clinic.id,
        outcome:       'error',
        considered:    0,
        attempted:     0,
        delivered:     0,
        bounced:       0,
        still_failing: 0,
        exhausted:     0,
        error_message,
      };
      summaries.push(summary);
      records.push({ ...summary, timestamp: sweep_started_at, sweep_id, trigger_source, actor_id });
      console.error('[AUDIT]', {
        event_type:     'scheduled_retry_run',
        outcome:        'error',
        actor_id,
        trigger_source,
        job:            'retryFailedPatientNotifications',
        clinic_id:      clinic.id,
        error_message,
        timestamp:      NOW,
      });
    }
  }

  recordSweepEntries(records);
  await evaluateSweepForOnCall(records);
  return summaries;
}

// Task-92 — per-clinic sweep that nudges patients who still haven't uploaded
// their GLP-1 prescription. Mirrors the retry sweep's shape: always logs a
// `[AUDIT] scheduled_px_upload_reminder_run` line per clinic so operators can
// confirm the loop is alive even when nothing was eligible.
export type PxUploadReminderClinicSummary = {
  clinic_id:     ClinicId;
  outcome:       'success' | 'error';
  considered:    number;
  sent:          number;
  failed:        number;
  error_message: string | null;
};

export async function runPxUploadReminderSweep(): Promise<PxUploadReminderClinicSummary[]> {
  const clinics = await listClinics();
  const summaries: PxUploadReminderClinicSummary[] = [];

  for (const clinic of clinics) {
    try {
      const result = await sendPxUploadReminders(clinic.id);
      const summary: PxUploadReminderClinicSummary = {
        clinic_id:     clinic.id,
        outcome:       'success',
        considered:    result.considered,
        sent:          result.sent.length,
        failed:        result.failed.length,
        error_message: null,
      };
      summaries.push(summary);
      console.log('[AUDIT]', {
        event_type:    'scheduled_px_upload_reminder_run',
        outcome:       'success',
        actor_id:      'system',
        job:           'sendPxUploadReminders',
        clinic_id:     clinic.id,
        considered:    summary.considered,
        sent:          summary.sent,
        failed:        summary.failed,
        timestamp:     NOW,
      });
    } catch (err) {
      const error_message = err instanceof Error ? err.message : String(err);
      summaries.push({
        clinic_id:     clinic.id,
        outcome:       'error',
        considered:    0,
        sent:          0,
        failed:        0,
        error_message,
      });
      console.error('[AUDIT]', {
        event_type:    'scheduled_px_upload_reminder_run',
        outcome:       'error',
        actor_id:      'system',
        job:           'sendPxUploadReminders',
        clinic_id:     clinic.id,
        error_message,
        timestamp:     NOW,
      });
    }
  }

  return summaries;
}

// Task-175 — per-clinic auto-chase sweep that rotates expired upload tokens
// without staff effort. Mirrors the reminder sweep's shape so operators can
// audit both jobs the same way.
export type PxUploadAutoChaseClinicSummary = {
  clinic_id:     ClinicId;
  outcome:       'success' | 'error';
  considered:    number;
  resent:        number;
  failed:        number;
  escalated:     number;
  error_message: string | null;
};

export async function runPxUploadAutoChaseSweep(): Promise<PxUploadAutoChaseClinicSummary[]> {
  const clinics = await listClinics();
  const summaries: PxUploadAutoChaseClinicSummary[] = [];

  for (const clinic of clinics) {
    try {
      const result = await autoChaseExpiringPxUploadLinks(clinic.id);
      const summary: PxUploadAutoChaseClinicSummary = {
        clinic_id:     clinic.id,
        outcome:       'success',
        considered:    result.considered,
        resent:        result.resent.length,
        failed:        result.failed.length,
        escalated:     result.escalated.length,
        error_message: null,
      };
      summaries.push(summary);
      console.log('[AUDIT]', {
        event_type:    'scheduled_px_upload_auto_chase_run',
        outcome:       'success',
        actor_id:      'system',
        job:           'autoChaseExpiringPxUploadLinks',
        clinic_id:     clinic.id,
        considered:    summary.considered,
        resent:        summary.resent,
        failed:        summary.failed,
        escalated:     summary.escalated,
        timestamp:     NOW,
      });
    } catch (err) {
      const error_message = err instanceof Error ? err.message : String(err);
      summaries.push({
        clinic_id:     clinic.id,
        outcome:       'error',
        considered:    0,
        resent:        0,
        failed:        0,
        escalated:     0,
        error_message,
      });
      console.error('[AUDIT]', {
        event_type:    'scheduled_px_upload_auto_chase_run',
        outcome:       'error',
        actor_id:      'system',
        job:           'autoChaseExpiringPxUploadLinks',
        clinic_id:     clinic.id,
        error_message,
        timestamp:     NOW,
      });
    }
  }

  return summaries;
}

// Task-286 — per-clinic sweep that auto-flips preferred_channel to email for
// patients whose phone is clearly dead (consecutive Bounced/Failed SMS). Same
// audit-line shape as the other scheduled jobs so operators can confirm the
// loop is alive even when no patient was eligible.
export type AutoSwitchBouncedSmsClinicSummary = {
  clinic_id:     ClinicId;
  outcome:       'success' | 'error';
  considered:    number;
  switched:      number;
  not_yet:       number;
  error_message: string | null;
};

export async function runAutoSwitchBouncedSmsChannelSweep(): Promise<AutoSwitchBouncedSmsClinicSummary[]> {
  const clinics = await listClinics();
  const summaries: AutoSwitchBouncedSmsClinicSummary[] = [];

  for (const clinic of clinics) {
    try {
      const result = await autoSwitchBouncedSmsChannel(clinic.id);
      const summary: AutoSwitchBouncedSmsClinicSummary = {
        clinic_id:     clinic.id,
        outcome:       'success',
        considered:    result.considered,
        switched:      result.switched.length,
        not_yet:       result.not_yet.length,
        error_message: null,
      };
      summaries.push(summary);
      console.log('[AUDIT]', {
        event_type:    'scheduled_auto_switch_bounced_sms_run',
        outcome:       'success',
        actor_id:      'system',
        job:           'autoSwitchBouncedSmsChannel',
        clinic_id:     clinic.id,
        considered:    summary.considered,
        switched:      summary.switched,
        not_yet:       summary.not_yet,
        switched_patient_ids: result.switched,
        timestamp:     NOW,
      });
    } catch (err) {
      const error_message = err instanceof Error ? err.message : String(err);
      summaries.push({
        clinic_id:     clinic.id,
        outcome:       'error',
        considered:    0,
        switched:      0,
        not_yet:       0,
        error_message,
      });
      console.error('[AUDIT]', {
        event_type:    'scheduled_auto_switch_bounced_sms_run',
        outcome:       'error',
        actor_id:      'system',
        job:           'autoSwitchBouncedSmsChannel',
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
  console.log('[AUDIT]', {
    event_type: 'scheduler_started',
    outcome:    'success',
    actor_id:   'system',
    job:        'sendPxUploadReminders',
    interval_ms: PX_UPLOAD_REMINDER_INTERVAL_MS,
    timestamp:  NOW,
  });
  console.log('[AUDIT]', {
    event_type: 'scheduler_started',
    outcome:    'success',
    actor_id:   'system',
    job:        'autoChaseExpiringPxUploadLinks',
    interval_ms: PX_UPLOAD_AUTO_CHASE_INTERVAL_MS,
    timestamp:  NOW,
  });
  console.log('[AUDIT]', {
    event_type: 'scheduler_started',
    outcome:    'success',
    actor_id:   'system',
    job:        'autoSwitchBouncedSmsChannel',
    interval_ms: AUTO_SWITCH_BOUNCED_SMS_INTERVAL_MS,
    timestamp:  NOW,
  });

  // Kick off an initial sweep shortly after boot so audit logs appear without
  // waiting a full interval, then continue on the recurring schedule.
  setTimeout(() => {
    void runPatientNotificationRetrySweep();
  }, 10 * 1000);
  setTimeout(() => {
    void runPxUploadReminderSweep();
  }, 15 * 1000);
  setTimeout(() => {
    void runPxUploadAutoChaseSweep();
  }, 20 * 1000);
  setTimeout(() => {
    void runAutoSwitchBouncedSmsChannelSweep();
  }, 25 * 1000);

  const retryTimer = setInterval(() => {
    void runPatientNotificationRetrySweep();
  }, RETRY_INTERVAL_MS);
  const reminderTimer = setInterval(() => {
    void runPxUploadReminderSweep();
  }, PX_UPLOAD_REMINDER_INTERVAL_MS);
  const autoChaseTimer = setInterval(() => {
    void runPxUploadAutoChaseSweep();
  }, PX_UPLOAD_AUTO_CHASE_INTERVAL_MS);
  const autoSwitchTimer = setInterval(() => {
    void runAutoSwitchBouncedSmsChannelSweep();
  }, AUTO_SWITCH_BOUNCED_SMS_INTERVAL_MS);

  // Avoid keeping the Node.js event loop alive solely for these timers (so
  // graceful shutdowns aren't blocked).
  if (typeof retryTimer.unref === 'function')      retryTimer.unref();
  if (typeof reminderTimer.unref === 'function')   reminderTimer.unref();
  if (typeof autoChaseTimer.unref === 'function')  autoChaseTimer.unref();
  if (typeof autoSwitchTimer.unref === 'function') autoSwitchTimer.unref();
}
