/**
 * Unit tests — /api/cron/retry-patient-notifications (Task-106)
 *
 * Asserts the route handler returns 200 and actually invokes the sweep
 * (so a regression that short-circuits the route would be caught).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/api/jobs/scheduler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/jobs/scheduler')>();
  return {
    ...actual,
    runPatientNotificationRetrySweep: vi.fn(),
  };
});

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/cron/retry-patient-notifications/route';
import { runPatientNotificationRetrySweep } from '@/lib/api/jobs/scheduler';

const mockSweep = vi.mocked(runPatientNotificationRetrySweep);

const FAKE_SUMMARIES = [
  {
    clinic_id:     'vsc' as const,
    outcome:       'success' as const,
    considered:    0,
    attempted:     0,
    delivered:     0,
    bounced:       0,
    still_failing: 0,
    exhausted:     0,
    error_message: null,
  },
  {
    clinic_id:     'feeltru' as const,
    outcome:       'success' as const,
    considered:    1,
    attempted:     1,
    delivered:     1,
    bounced:       0,
    still_failing: 0,
    exhausted:     0,
    error_message: null,
  },
];

beforeEach(() => {
  mockSweep.mockReset();
  mockSweep.mockResolvedValue(FAKE_SUMMARIES);
  delete process.env.CRON_SECRET;
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('GET /api/cron/retry-patient-notifications', () => {
  it('returns 200 and runs the sweep', async () => {
    const req = new NextRequest('http://localhost/api/cron/retry-patient-notifications');

    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockSweep).toHaveBeenCalledTimes(1);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.clinics)).toBe(true);
    expect(body.clinics).toHaveLength(2);
    expect(body.clinics.map((c: { clinic_id: string }) => c.clinic_id).sort())
      .toEqual(['feeltru', 'vsc']);
  });
});

describe('POST /api/cron/retry-patient-notifications', () => {
  it('returns 200 and runs the sweep', async () => {
    const req = new NextRequest('http://localhost/api/cron/retry-patient-notifications', {
      method: 'POST',
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSweep).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
