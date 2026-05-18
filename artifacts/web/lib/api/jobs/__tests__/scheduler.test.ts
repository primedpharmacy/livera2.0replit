/**
 * Unit tests — runPatientNotificationRetrySweep() (Task-106)
 *
 * Covers:
 *   - Per-clinic audit log line is emitted for every clinic, even when
 *     nothing was eligible for retry.
 *   - A thrown error in one clinic does not prevent later clinics from
 *     being processed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../retryPatientNotifications', () => ({
  retryFailedPatientNotifications: vi.fn(),
}));

import { runPatientNotificationRetrySweep } from '../scheduler';
import { retryFailedPatientNotifications } from '../retryPatientNotifications';

const mockRetry = vi.mocked(retryFailedPatientNotifications);

type AuditCall = [string, Record<string, unknown>];

let logCalls: AuditCall[];
let errorCalls: AuditCall[];
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logCalls = [];
  errorCalls = [];
  logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logCalls.push(args as AuditCall);
  });
  errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errorCalls.push(args as AuditCall);
  });
  mockRetry.mockReset();
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

function auditLines(calls: AuditCall[]) {
  return calls
    .filter(([prefix, payload]) =>
      prefix === '[AUDIT]' &&
      typeof payload === 'object' && payload !== null &&
      (payload as { event_type?: string }).event_type === 'scheduled_retry_run',
    )
    .map(([, payload]) => payload as Record<string, unknown>);
}

describe('runPatientNotificationRetrySweep() — per-clinic audit logging', () => {
  it('emits one scheduled_retry_run audit line per clinic even when nothing is eligible', async () => {
    mockRetry.mockResolvedValue({
      considered:    0,
      attempted:     0,
      delivered:     [],
      still_failing: [],
      bounced:       [],
      exhausted:     [],
    });

    const summaries = await runPatientNotificationRetrySweep();

    // Sweep ran once per clinic.
    expect(mockRetry).toHaveBeenCalledTimes(2);
    const clinicIds = mockRetry.mock.calls.map((c) => c[0]).sort();
    expect(clinicIds).toEqual(['feeltru', 'vsc']);

    // Summary mirrors the call count and reports zero work per clinic.
    expect(summaries).toHaveLength(2);
    expect(summaries.every((s) => s.outcome === 'success')).toBe(true);
    expect(summaries.every((s) => s.considered === 0 && s.attempted === 0)).toBe(true);

    // One [AUDIT] scheduled_retry_run line per clinic, all success, all zeros.
    const lines = auditLines(logCalls);
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.clinic_id).sort()).toEqual(['feeltru', 'vsc']);
    expect(lines.every((l) => l.outcome === 'success')).toBe(true);
    expect(lines.every((l) => l.considered === 0 && l.attempted === 0)).toBe(true);

    // No error-channel audit lines.
    expect(auditLines(errorCalls)).toHaveLength(0);
  });
});

describe('runPatientNotificationRetrySweep() — per-clinic isolation', () => {
  it('continues processing remaining clinics when one clinic throws', async () => {
    const failingClinic: 'vsc' | 'feeltru' = 'vsc';
    const okClinic:      'vsc' | 'feeltru' = 'feeltru';

    mockRetry.mockImplementation(async (clinicId) => {
      if (clinicId === failingClinic) {
        throw new Error('boom');
      }
      return {
        considered:    2,
        attempted:     1,
        delivered:     [],
        still_failing: [],
        bounced:       [],
        exhausted:     [],
      };
    });

    const summaries = await runPatientNotificationRetrySweep();

    // Both clinics were attempted despite the first throwing.
    expect(mockRetry).toHaveBeenCalledTimes(2);

    const failing = summaries.find((s) => s.clinic_id === failingClinic);
    const ok      = summaries.find((s) => s.clinic_id === okClinic);

    expect(failing).toBeDefined();
    expect(failing?.outcome).toBe('error');
    expect(failing?.error_message).toBe('boom');

    expect(ok).toBeDefined();
    expect(ok?.outcome).toBe('success');
    expect(ok?.considered).toBe(2);
    expect(ok?.attempted).toBe(1);

    // Audit trail: one success line on stdout, one error line on stderr.
    const successLines = auditLines(logCalls);
    expect(successLines).toHaveLength(1);
    expect(successLines[0]!.clinic_id).toBe(okClinic);
    expect(successLines[0]!.outcome).toBe('success');

    const errorLines = auditLines(errorCalls);
    expect(errorLines).toHaveLength(1);
    expect(errorLines[0]!.clinic_id).toBe(failingClinic);
    expect(errorLines[0]!.outcome).toBe('error');
    expect(errorLines[0]!.error_message).toBe('boom');
  });
});
