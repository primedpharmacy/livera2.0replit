/**
 * Unit tests — autoSwitchBouncedSmsChannel + runAutoSwitchBouncedSmsChannelSweep
 * (Task-286)
 *
 * Covers:
 *   - Patients on SMS with ≥ threshold consecutive Bounced/Failed SMS rows
 *     are flipped to email via updatePatientPreferredChannel.
 *   - A recent Delivered SMS breaks the streak (no auto-switch).
 *   - The switch reuses the same audit + change-log breadcrumb pipeline, but
 *     with actor_id='system' so reviewers can tell it apart from staff edits.
 *   - Patients already on email are skipped (idempotent).
 *   - The scheduler wrapper emits one [AUDIT] line per clinic, even when
 *     nothing was switched.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  MOCK_PATIENT_NOTIFICATIONS,
  type PatientNotification,
} from '../../fixtures/patientNotifications';
import {
  MOCK_PATIENTS,
  PREFERRED_CHANNEL_CHANGES,
} from '../../fixtures/patients';
import {
  autoSwitchBouncedSmsChannel,
  AUTO_SWITCH_BOUNCE_THRESHOLD,
} from '../autoSwitchBouncedSmsChannel';
import { runAutoSwitchBouncedSmsChannelSweep } from '../scheduler';

// Pick a real SMS-preferring patient from the seeded fixtures (PT-00355
// "Miriam Osei" — preferred_channel='sms') so we exercise the live
// updatePatientPreferredChannel path rather than mocking it out.
const CLINIC_ID = 'vsc' as const;
const SMS_PATIENT_ID = 'PT-00156';

function makeSmsRow(
  index: number,
  status: PatientNotification['status'],
  isoSentAt: string,
): PatientNotification {
  return {
    id: `NOTIF-T286-${index}`,
    clinic_id: CLINIC_ID,
    patient_id: SMS_PATIENT_ID,
    order_id: `ORD-T286-${index}`,
    type: 'order_approved',
    channel: 'SMS',
    template: 'order_approved',
    status,
    sent_at: isoSentAt,
    payload: { order_id: `ORD-T286-${index}` },
    attempt_count: 1,
    max_attempts: 3,
    last_error: status === 'Bounced' || status === 'Failed' ? 'carrier error' : null,
    last_attempt_at: isoSentAt,
    next_retry_at: null,
    email_envelope: null,
    email_envelope_unavailable_reason: null,
  };
}

function resetFixtures() {
  // Remove any test rows from earlier cases in this file.
  for (let i = MOCK_PATIENT_NOTIFICATIONS.length - 1; i >= 0; i--) {
    if (MOCK_PATIENT_NOTIFICATIONS[i]!.id.startsWith('NOTIF-T286-')) {
      MOCK_PATIENT_NOTIFICATIONS.splice(i, 1);
    }
  }
  // Reset preferred_channel for the SMS test patient back to 'sms'.
  const p = MOCK_PATIENTS.find((x) => x.clinic_id === CLINIC_ID && x.id === SMS_PATIENT_ID);
  if (p) p.contact = { ...p.contact, preferred_channel: 'sms' };
  // Drop any breadcrumbs this test added.
  for (let i = PREFERRED_CHANNEL_CHANGES.length - 1; i >= 0; i--) {
    if (PREFERRED_CHANNEL_CHANGES[i]!.patient_id === SMS_PATIENT_ID) {
      PREFERRED_CHANNEL_CHANGES.splice(i, 1);
    }
  }
}

beforeEach(() => {
  resetFixtures();
});

describe('autoSwitchBouncedSmsChannel — threshold logic', () => {
  it('flips preferred_channel to email after N consecutive bounced/failed SMS', async () => {
    // Seed N recent bounces (newest last). Threshold defaults to 3.
    for (let i = 0; i < AUTO_SWITCH_BOUNCE_THRESHOLD; i++) {
      MOCK_PATIENT_NOTIFICATIONS.push(
        makeSmsRow(i, i === 0 ? 'Failed' : 'Bounced', `2026-05-1${i}T10:00:00Z`),
      );
    }

    const result = await autoSwitchBouncedSmsChannel(CLINIC_ID);

    expect(result.switched).toContain(SMS_PATIENT_ID);

    const patient = MOCK_PATIENTS.find((p) => p.id === SMS_PATIENT_ID);
    expect(patient?.contact.preferred_channel).toBe('email');

    // Reused the staff change-log breadcrumb with the System actor.
    const breadcrumb = PREFERRED_CHANNEL_CHANGES.find((c) => c.patient_id === SMS_PATIENT_ID);
    expect(breadcrumb).toBeDefined();
    expect(breadcrumb?.previous_channel).toBe('sms');
    expect(breadcrumb?.new_channel).toBe('email');
    expect(breadcrumb?.actor_id).toBe('system');
    expect(breadcrumb?.actor_name).toBe('Livera System');
  });

  it('does not switch when a Delivered SMS interrupts the streak', async () => {
    // Old bounces …
    MOCK_PATIENT_NOTIFICATIONS.push(makeSmsRow(0, 'Bounced', '2026-05-01T10:00:00Z'));
    MOCK_PATIENT_NOTIFICATIONS.push(makeSmsRow(1, 'Bounced', '2026-05-02T10:00:00Z'));
    // … then a fresh Delivered (newest) resets the streak …
    MOCK_PATIENT_NOTIFICATIONS.push(makeSmsRow(2, 'Delivered', '2026-05-15T10:00:00Z'));
    // … and only one bounce since then, which is below threshold.
    MOCK_PATIENT_NOTIFICATIONS.push(makeSmsRow(3, 'Bounced', '2026-05-17T10:00:00Z'));

    const result = await autoSwitchBouncedSmsChannel(CLINIC_ID);

    expect(result.switched).not.toContain(SMS_PATIENT_ID);
    const patient = MOCK_PATIENTS.find((p) => p.id === SMS_PATIENT_ID);
    expect(patient?.contact.preferred_channel).toBe('sms');
  });

  it('does not switch when bounces are under threshold but reports them as not_yet', async () => {
    for (let i = 0; i < AUTO_SWITCH_BOUNCE_THRESHOLD - 1; i++) {
      MOCK_PATIENT_NOTIFICATIONS.push(makeSmsRow(i, 'Bounced', `2026-05-1${i}T10:00:00Z`));
    }

    const result = await autoSwitchBouncedSmsChannel(CLINIC_ID);

    expect(result.switched).not.toContain(SMS_PATIENT_ID);
    expect(result.not_yet).toContain(SMS_PATIENT_ID);
  });

  it('is idempotent — re-running after a switch is a no-op for that patient', async () => {
    for (let i = 0; i < AUTO_SWITCH_BOUNCE_THRESHOLD; i++) {
      MOCK_PATIENT_NOTIFICATIONS.push(makeSmsRow(i, 'Bounced', `2026-05-1${i}T10:00:00Z`));
    }

    await autoSwitchBouncedSmsChannel(CLINIC_ID);
    const breadcrumbsAfterFirst = PREFERRED_CHANNEL_CHANGES.filter(
      (c) => c.patient_id === SMS_PATIENT_ID,
    ).length;

    const second = await autoSwitchBouncedSmsChannel(CLINIC_ID);
    expect(second.switched).not.toContain(SMS_PATIENT_ID);

    const breadcrumbsAfterSecond = PREFERRED_CHANNEL_CHANGES.filter(
      (c) => c.patient_id === SMS_PATIENT_ID,
    ).length;
    expect(breadcrumbsAfterSecond).toBe(breadcrumbsAfterFirst);
  });
});

describe('runAutoSwitchBouncedSmsChannelSweep — scheduler audit', () => {
  it('emits one scheduled_auto_switch_bounced_sms_run audit line per clinic', async () => {
    const logCalls: Array<[string, Record<string, unknown>]> = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      if (args[0] === '[AUDIT]') {
        logCalls.push(args as [string, Record<string, unknown>]);
      }
    };
    try {
      await runAutoSwitchBouncedSmsChannelSweep();
    } finally {
      console.log = origLog;
    }

    const sweepLines = logCalls.filter(
      ([, payload]) => payload.event_type === 'scheduled_auto_switch_bounced_sms_run',
    );
    expect(sweepLines.length).toBeGreaterThanOrEqual(1);
    expect(sweepLines.every(([, p]) => p.actor_id === 'system')).toBe(true);
    expect(sweepLines.every(([, p]) => p.job === 'autoSwitchBouncedSmsChannel')).toBe(true);
  });
});
