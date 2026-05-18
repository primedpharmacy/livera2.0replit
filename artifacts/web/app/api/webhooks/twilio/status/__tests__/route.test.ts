/**
 * Route-level tests — POST /api/webhooks/twilio/status (Task-139)
 *
 * Locks the contract between Twilio's async status callback and the
 * per-patient notification log:
 *   - matching SMS rows flip Delivered → Bounced on undelivered
 *   - orphan MessageSids are a benign 200 no-op (so Twilio doesn't retry)
 *   - intermediate statuses don't mutate the row
 *   - bad signatures get 403 in live mode
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/webhooks/twilio/status/route';
import {
  MOCK_PATIENT_NOTIFICATIONS,
  recordPatientNotification,
} from '@/lib/api/fixtures/patientNotifications';
import { __resetTwilioDedupeCacheForTests } from '@/lib/integrations/sms';

const URL = 'https://example.test/api/webhooks/twilio/status';

function formBody(params: Record<string, string>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) usp.set(k, v);
  return usp.toString();
}

function buildRequest(params: Record<string, string>, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body:    formBody(params),
  });
}

function signTwilio(authToken: string, url: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map((k) => k + params[k]).join('');
  return createHmac('sha1', authToken).update(data).digest('base64');
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.LIVERA_SMS_LIVE;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_STATUS_CALLBACK_URL;
  __resetTwilioDedupeCacheForTests();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('POST /api/webhooks/twilio/status — stub mode signature bypass', () => {
  it('flips a matching Queued SMS notification to Bounced when Twilio reports undelivered', async () => {
    const sid = 'SMtest_' + Math.random().toString(36).slice(2);
    const created = recordPatientNotification({
      clinic_id:  'feeltru',
      patient_id: 'PT-00198',
      order_id:   'ORD-WEBHOOK-TEST-1',
      type:       'order_approved',
      template:   'order_approved',
      status:     'Queued',
      channel:    'SMS',
      payload:    { sms_message_id: sid, sms_to_phone: '+447700900000' },
    });
    expect(created.status).toBe('Queued');

    const res = await POST(buildRequest({
      MessageSid:    sid,
      MessageStatus: 'undelivered',
      ErrorCode:     '30003',
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.notification_id).toBe(created.id);
    expect(body.status).toBe('Bounced');

    const stored = MOCK_PATIENT_NOTIFICATIONS.find((n) => n.id === created.id)!;
    expect(stored.status).toBe('Bounced');
    expect(stored.last_error).toMatch(/undelivered/);
    expect(stored.last_error).toMatch(/error_code 30003/);
    expect(stored.next_retry_at).toBeNull();
  });

  it('treats an orphan MessageSid as a benign 200 no-op (no row mutated)', async () => {
    const before = MOCK_PATIENT_NOTIFICATIONS.length;

    const res = await POST(buildRequest({
      MessageSid:    'SMdoes_not_exist_xyz',
      MessageStatus: 'delivered',
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ignored).toBe('no_matching_notification');
    expect(MOCK_PATIENT_NOTIFICATIONS.length).toBe(before);
  });

  it('acknowledges intermediate statuses without mutating the row', async () => {
    const sid = 'SMintermediate_' + Math.random().toString(36).slice(2);
    const created = recordPatientNotification({
      clinic_id:  'feeltru',
      patient_id: 'PT-00198',
      order_id:   'ORD-WEBHOOK-TEST-2',
      type:       'order_approved',
      template:   'order_approved',
      status:     'Delivered',
      channel:    'SMS',
      payload:    { sms_message_id: sid },
    });

    const res = await POST(buildRequest({
      MessageSid:    sid,
      MessageStatus: 'sent',
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ignored).toBe('intermediate_status');

    const stored = MOCK_PATIENT_NOTIFICATIONS.find((n) => n.id === created.id)!;
    expect(stored.status).toBe('Delivered');
  });

  it('short-circuits a duplicate (MessageSid, MessageStatus) replay (Task-207)', async () => {
    const sid = 'SMdupe_' + Math.random().toString(36).slice(2);
    const created = recordPatientNotification({
      clinic_id:  'feeltru',
      patient_id: 'PT-00198',
      order_id:   'ORD-WEBHOOK-DUPE-1',
      type:       'order_approved',
      template:   'order_approved',
      status:     'Queued',
      channel:    'SMS',
      payload:    { sms_message_id: sid, sms_to_phone: '+447700900000' },
    });

    const params = { MessageSid: sid, MessageStatus: 'delivered' };

    // First callback — real work happens.
    const first = await POST(buildRequest(params));
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.ok).toBe(true);
    expect(firstBody.notification_id).toBe(created.id);
    expect(firstBody.status).toBe('Delivered');

    // Simulate a follow-up mutation we should NOT undo on a replay: an
    // operator manually flips the row to something else. If the dedupe
    // genuinely short-circuits, the row stays as the operator left it.
    const row = MOCK_PATIENT_NOTIFICATIONS.find((n) => n.id === created.id)!;
    row.status = 'Bounced';

    // Twilio retries the same (SID, status) — should be a quiet 200 with
    // no fixture mutation and no notification_updated work.
    const replay = await POST(buildRequest(params));
    expect(replay.status).toBe(200);
    const replayBody = await replay.json();
    expect(replayBody.ok).toBe(true);
    expect(replayBody.ignored).toBe('duplicate_callback');

    // Row untouched by the replay — proves we short-circuited before
    // applyTwilioStatusCallback ran.
    const after = MOCK_PATIENT_NOTIFICATIONS.find((n) => n.id === created.id)!;
    expect(after.status).toBe('Bounced');
  });

  it('still processes a NEW status for the same MessageSid (dedupe is per-status)', async () => {
    const sid = 'SMtransition_' + Math.random().toString(36).slice(2);
    const created = recordPatientNotification({
      clinic_id:  'feeltru',
      patient_id: 'PT-00198',
      order_id:   'ORD-WEBHOOK-TRANSITION-1',
      type:       'order_approved',
      template:   'order_approved',
      status:     'Queued',
      channel:    'SMS',
      payload:    { sms_message_id: sid },
    });

    // An intermediate 'sent' arrives first — acknowledged, row untouched.
    const first = await POST(buildRequest({ MessageSid: sid, MessageStatus: 'sent' }));
    expect((await first.json()).ignored).toBe('intermediate_status');

    // The carrier-final 'delivered' is a *different* status for the same SID
    // — must NOT be short-circuited by the dedupe cache.
    const second = await POST(buildRequest({ MessageSid: sid, MessageStatus: 'delivered' }));
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.ignored).toBeUndefined();
    expect(body.notification_id).toBe(created.id);
    expect(body.status).toBe('Delivered');
  });

  it('returns 200 with a missing_message_sid reason when MessageSid is absent', async () => {
    const res = await POST(buildRequest({ MessageStatus: 'delivered' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('missing_message_sid');
  });
});

describe('POST /api/webhooks/twilio/status — live mode signature enforcement', () => {
  beforeEach(() => {
    process.env.LIVERA_SMS_LIVE = 'true';
    process.env.TWILIO_AUTH_TOKEN = 'token-shh';
    process.env.TWILIO_STATUS_CALLBACK_URL = URL;
  });

  it('returns 403 when the X-Twilio-Signature header is wrong', async () => {
    const res = await POST(buildRequest(
      { MessageSid: 'SManything', MessageStatus: 'delivered' },
      { 'X-Twilio-Signature': 'not-a-real-signature' },
    ));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('signature_mismatch');
  });

  it('returns 200 and processes the callback when the signature is valid', async () => {
    const sid = 'SMlive_' + Math.random().toString(36).slice(2);
    const created = recordPatientNotification({
      clinic_id:  'feeltru',
      patient_id: 'PT-00198',
      order_id:   'ORD-WEBHOOK-TEST-3',
      type:       'order_approved',
      template:   'order_approved',
      status:     'Delivered',
      channel:    'SMS',
      payload:    { sms_message_id: sid },
    });

    const params = { MessageSid: sid, MessageStatus: 'delivered' };
    const sig = signTwilio('token-shh', URL, params);

    const res = await POST(buildRequest(params, { 'X-Twilio-Signature': sig }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.notification_id).toBe(created.id);
    expect(body.status).toBe('Delivered');
  });
});
