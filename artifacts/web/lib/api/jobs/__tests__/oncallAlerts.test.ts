/**
 * Unit tests — on-call alerting for retry sweep failures (Task-233).
 *
 * Covers:
 *   - Alert fires only after the configured threshold of consecutive failed
 *     sweeps is reached.
 *   - Throttling prevents repeated alerts while the streak persists.
 *   - A successful sweep after a failing streak emits a one-shot recovery
 *     alert and clears state.
 *   - Slack webhook is POSTed when configured; nothing is sent when no
 *     transport is configured.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  evaluateSweepForOnCall,
  __resetOnCallAlertStateForTests,
} from '../oncallAlerts';
import type { SweepRecord } from '../scheduler';

type AuditCall = [string, Record<string, unknown>];

let logCalls: AuditCall[];
let logSpy: ReturnType<typeof vi.spyOn>;
let fetchSpy: ReturnType<typeof vi.fn>;

const ENV_KEYS = [
  'ONCALL_ALERT_THRESHOLD',
  'ONCALL_ALERT_THROTTLE_MS',
  'ONCALL_SLACK_WEBHOOK_URL',
  'ONCALL_ALERT_EMAIL',
] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  __resetOnCallAlertStateForTests();
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  logCalls = [];
  logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logCalls.push(args as AuditCall);
  });
  fetchSpy = vi.fn().mockResolvedValue(new Response('ok'));
  (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
  logSpy.mockRestore();
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

function eventsOfType(type: string): Record<string, unknown>[] {
  return logCalls
    .filter(
      ([prefix, payload]) =>
        prefix === '[AUDIT]' &&
        typeof payload === 'object' &&
        payload !== null &&
        (payload as { event_type?: string }).event_type === type,
    )
    .map(([, p]) => p as Record<string, unknown>);
}

let sweepCounter = 0;
function sweep(outcome: 'success' | 'error', clinics: string[] = ['vsc']): SweepRecord[] {
  sweepCounter += 1;
  const sweep_id  = `sweep_test_${sweepCounter}`;
  const timestamp = new Date().toISOString();
  return clinics.map((clinic_id, i) => ({
    sweep_id,
    timestamp,
    clinic_id:     clinic_id as SweepRecord['clinic_id'],
    outcome:       i === 0 ? outcome : 'success',
    considered:    0,
    attempted:     0,
    delivered:     0,
    bounced:       0,
    still_failing: 0,
    exhausted:     0,
    error_message: outcome === 'error' && i === 0 ? 'boom' : null,
  }));
}

describe('evaluateSweepForOnCall()', () => {
  it('does not alert until the threshold of consecutive failures is reached', async () => {
    process.env.ONCALL_ALERT_THRESHOLD = '3';
    process.env.ONCALL_SLACK_WEBHOOK_URL = 'https://hooks.example/test';

    await evaluateSweepForOnCall(sweep('error'));
    await evaluateSweepForOnCall(sweep('error'));
    expect(eventsOfType('oncall_alert_fired')).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();

    await evaluateSweepForOnCall(sweep('error'));
    const fired = eventsOfType('oncall_alert_fired');
    expect(fired).toHaveLength(1);
    expect(fired[0]!.streak).toBe(3);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]![0]).toBe('https://hooks.example/test');
  });

  it('throttles repeated alerts while a streak continues', async () => {
    process.env.ONCALL_ALERT_THRESHOLD   = '2';
    process.env.ONCALL_ALERT_THROTTLE_MS = '3600000';
    process.env.ONCALL_SLACK_WEBHOOK_URL = 'https://hooks.example/test';

    await evaluateSweepForOnCall(sweep('error'));
    await evaluateSweepForOnCall(sweep('error')); // crosses threshold → alert #1
    await evaluateSweepForOnCall(sweep('error')); // still inside throttle
    await evaluateSweepForOnCall(sweep('error'));

    expect(eventsOfType('oncall_alert_fired')).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('re-alerts once the throttle window has elapsed', async () => {
    process.env.ONCALL_ALERT_THRESHOLD   = '1';
    process.env.ONCALL_ALERT_THROTTLE_MS = '0';
    process.env.ONCALL_SLACK_WEBHOOK_URL = 'https://hooks.example/test';

    await evaluateSweepForOnCall(sweep('error'));
    await evaluateSweepForOnCall(sweep('error'));

    expect(eventsOfType('oncall_alert_fired')).toHaveLength(2);
  });

  it('emits a recovery alert and resets state on the next successful sweep', async () => {
    process.env.ONCALL_ALERT_THRESHOLD   = '2';
    process.env.ONCALL_SLACK_WEBHOOK_URL = 'https://hooks.example/test';

    await evaluateSweepForOnCall(sweep('error'));
    await evaluateSweepForOnCall(sweep('error')); // fires alert
    expect(eventsOfType('oncall_alert_fired')).toHaveLength(1);

    await evaluateSweepForOnCall(sweep('success'));
    const recovered = eventsOfType('oncall_alert_recovered');
    expect(recovered).toHaveLength(1);
    expect(recovered[0]!.previous_streak).toBe(2);

    // Slack: 1 alert + 1 recovery
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // State cleared — a new short failure burst does not immediately alert.
    await evaluateSweepForOnCall(sweep('error'));
    expect(eventsOfType('oncall_alert_fired')).toHaveLength(1);
  });

  it('does not emit a recovery alert if no alert had been fired', async () => {
    process.env.ONCALL_ALERT_THRESHOLD   = '5';
    process.env.ONCALL_SLACK_WEBHOOK_URL = 'https://hooks.example/test';

    await evaluateSweepForOnCall(sweep('error'));
    await evaluateSweepForOnCall(sweep('success'));

    expect(eventsOfType('oncall_alert_fired')).toHaveLength(0);
    expect(eventsOfType('oncall_alert_recovered')).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips Slack POST when no webhook is configured', async () => {
    process.env.ONCALL_ALERT_THRESHOLD = '1';
    // no ONCALL_SLACK_WEBHOOK_URL

    await evaluateSweepForOnCall(sweep('error'));

    expect(eventsOfType('oncall_alert_fired')).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('queues an email audit line when ONCALL_ALERT_EMAIL is configured', async () => {
    process.env.ONCALL_ALERT_THRESHOLD = '1';
    process.env.ONCALL_ALERT_EMAIL     = 'oncall@livera.test';

    await evaluateSweepForOnCall(sweep('error', ['vsc', 'feeltru']));

    const queued = eventsOfType('oncall_alert_email_queued');
    expect(queued).toHaveLength(1);
    expect(queued[0]!.to_email).toBe('oncall@livera.test');
    expect(String(queued[0]!.subject)).toContain('Retry sweep failing');
  });

  it('treats a sweep with any failed clinic as a failure (sweep-level rollup)', async () => {
    process.env.ONCALL_ALERT_THRESHOLD = '1';

    // First clinic errors, second succeeds → sweep counts as failed.
    await evaluateSweepForOnCall(sweep('error', ['vsc', 'feeltru']));
    const fired = eventsOfType('oncall_alert_fired');
    expect(fired).toHaveLength(1);
    expect(fired[0]!.failed_clinics).toEqual(['vsc']);
  });
});
