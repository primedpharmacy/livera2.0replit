/**
 * On-call alerting for retry-sweep failures — Task-233.
 *
 * The ops sidebar already badges + toasts failed sweeps, but that only helps
 * operators who happen to be in the app. If the scheduler starts failing
 * overnight (or while nobody is signed in), nothing pushes the problem out.
 *
 * This module tracks the consecutive-failed-sweep streak and, once the streak
 * crosses a configurable threshold (default 3), fires a one-time alert to a
 * Slack incoming webhook and/or an email address. A recovery alert is emitted
 * on the next successful sweep so on-call sees an explicit "all clear".
 *
 * Throttling: while a streak is active, we only send one alert per
 * `ONCALL_ALERT_THROTTLE_MS` window (default 1h) so a flapping job doesn't
 * spam the channel.
 *
 * Configuration (all env vars are optional — absent means "no transport"):
 *   ONCALL_ALERT_THRESHOLD       integer, default 3
 *   ONCALL_ALERT_THROTTLE_MS     integer ms, default 3_600_000 (1h)
 *   ONCALL_SLACK_WEBHOOK_URL     https URL — POSTed as Slack incoming webhook
 *   ONCALL_ALERT_EMAIL           email address — currently logged (no MTA
 *                                wired in mock env); the audit line is the
 *                                contract a future Postmark hook can consume.
 */

import { NOW } from '../constants';
import type { SweepRecord } from './scheduler';

const DEFAULT_THRESHOLD     = 3;
const DEFAULT_THROTTLE_MS   = 60 * 60 * 1000;

export type OnCallAlertState = {
  streak:           number;      // consecutive failed sweeps (sweep-level)
  last_alert_at_ms: number | null;
  alerted_for_streak: boolean;   // whether the *current* streak has been alerted
};

declare global {
  var __LIVERA_ONCALL_ALERT_STATE__: OnCallAlertState | undefined;
}

function getState(): OnCallAlertState {
  return (globalThis.__LIVERA_ONCALL_ALERT_STATE__ ??= {
    streak:             0,
    last_alert_at_ms:   null,
    alerted_for_streak: false,
  });
}

/** Test-only — reset module state between tests. */
export function __resetOnCallAlertStateForTests(): void {
  globalThis.__LIVERA_ONCALL_ALERT_STATE__ = {
    streak:             0,
    last_alert_at_ms:   null,
    alerted_for_streak: false,
  };
}

function readThreshold(): number {
  const raw = process.env.ONCALL_ALERT_THRESHOLD;
  const n   = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD;
}

function readThrottleMs(): number {
  const raw = process.env.ONCALL_ALERT_THROTTLE_MS;
  const n   = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_THROTTLE_MS;
}

/**
 * Roll the supplied sweep up into a single sweep-level outcome. A sweep
 * counts as failed if *any* clinic row in it errored — matching the
 * aggregation `/api/ops/retry-sweeps` performs for the sidebar badge.
 */
export function summariseSweep(records: SweepRecord[]): {
  sweep_id:       string;
  outcome:        'success' | 'error';
  failed_clinics: string[];
  error_message:  string | null;
} | null {
  if (records.length === 0) return null;
  const failed = records.filter((r) => r.outcome === 'error');
  return {
    sweep_id:       records[0]!.sweep_id,
    outcome:        failed.length > 0 ? 'error' : 'success',
    failed_clinics: failed.map((r) => r.clinic_id),
    error_message:  failed[0]?.error_message ?? null,
  };
}

async function sendSlack(text: string): Promise<void> {
  const url = process.env.ONCALL_SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error('[AUDIT]', {
        event_type:    'oncall_alert_transport_error',
        outcome:       'error',
        actor_id:      'system',
        transport:     'slack',
        error_message: `slack webhook returned HTTP ${res.status}`,
        timestamp:     NOW,
      });
    }
  } catch (err) {
    console.error('[AUDIT]', {
      event_type:    'oncall_alert_transport_error',
      outcome:       'error',
      actor_id:      'system',
      transport:     'slack',
      error_message: err instanceof Error ? err.message : String(err),
      timestamp:     NOW,
    });
  }
}

function logEmail(subject: string, body: string): void {
  const to = process.env.ONCALL_ALERT_EMAIL;
  if (!to) return;
  // No production MTA is wired up in this prototype env — emit an [AUDIT]
  // line so the alert is captured in logs and the contract is stable for a
  // future Postmark hook to consume.
  console.log('[AUDIT]', {
    event_type: 'oncall_alert_email_queued',
    outcome:    'success',
    actor_id:   'system',
    to_email:   to,
    subject,
    body,
    timestamp:  NOW,
  });
}

/**
 * Inspect a freshly-recorded sweep and fire / clear on-call alerts as needed.
 *
 * Must be called exactly once per sweep tick (after `recordSweepEntries`).
 */
export async function evaluateSweepForOnCall(records: SweepRecord[]): Promise<void> {
  const summary = summariseSweep(records);
  if (!summary) return;

  const state     = getState();
  const threshold = readThreshold();
  const throttle  = readThrottleMs();
  const now       = Date.now();

  if (summary.outcome === 'error') {
    state.streak += 1;

    const shouldAlert =
      state.streak >= threshold &&
      (!state.alerted_for_streak ||
        (state.last_alert_at_ms !== null && now - state.last_alert_at_ms >= throttle));

    if (!shouldAlert) return;

    const clinics = summary.failed_clinics.join(', ') || '(none)';
    const subject = `[Livera] Retry sweep failing — ${state.streak} consecutive failures`;
    const body =
      `Retry-sweep has failed ${state.streak} times in a row ` +
      `(threshold: ${threshold}).\n` +
      `Latest sweep: ${summary.sweep_id}\n` +
      `Failed clinics: ${clinics}\n` +
      `Error: ${summary.error_message ?? '(no message)'}`;

    console.log('[AUDIT]', {
      event_type:     'oncall_alert_fired',
      outcome:        'success',
      actor_id:       'system',
      reason:         'consecutive_sweep_failures',
      streak:         state.streak,
      threshold,
      sweep_id:       summary.sweep_id,
      failed_clinics: summary.failed_clinics,
      error_message:  summary.error_message,
      timestamp:      NOW,
    });

    await sendSlack(`:rotating_light: ${subject}\n${body}`);
    logEmail(subject, body);

    state.alerted_for_streak = true;
    state.last_alert_at_ms   = now;
    return;
  }

  // outcome === 'success' — clear the streak; emit recovery if we previously
  // alerted on-call.
  if (state.alerted_for_streak) {
    const subject = `[Livera] Retry sweep recovered`;
    const body =
      `Retry-sweep succeeded after a failing streak of ${state.streak}. ` +
      `Latest sweep: ${summary.sweep_id}.`;

    console.log('[AUDIT]', {
      event_type:        'oncall_alert_recovered',
      outcome:           'success',
      actor_id:          'system',
      previous_streak:   state.streak,
      sweep_id:          summary.sweep_id,
      timestamp:         NOW,
    });

    await sendSlack(`:white_check_mark: ${subject}\n${body}`);
    logEmail(subject, body);
  }

  state.streak             = 0;
  state.alerted_for_streak = false;
  state.last_alert_at_ms   = null;
}
