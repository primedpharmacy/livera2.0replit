/**
 * Unit tests — sendPatientSMS() (Task-102)
 *
 * Guards the Twilio provider mapping in sms.ts so the patient notification
 * flow (notifyPatient) can rely on a stable Delivered / Bounced / Failed
 * result vocabulary regardless of how Twilio reports the outcome.
 *
 * Covered branches:
 *   - mock mode (LIVERA_SMS_LIVE !== 'true')
 *   - missing env vars in live mode
 *   - HTTP 2xx + accepted intermediate status   → Delivered
 *   - HTTP 2xx + error_code in bounce set       → Bounced
 *   - HTTP 2xx + error_code outside bounce set  → Failed
 *   - HTTP 4xx auth error                       → Failed (with detail)
 *   - HTTP 4xx + bounce error code              → Bounced
 *   - network failure (fetch throws)            → Failed
 *   - MessagingServiceSid vs From routing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendPatientSMS } from '../sms';

type FetchMock = ReturnType<typeof vi.fn>;

const ORIGINAL_ENV = { ...process.env };
let fetchMock: FetchMock;

function setEnv(env: Record<string, string | undefined>) {
  for (const key of Object.keys(env)) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.LIVERA_SMS_LIVE;
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_FROM_NUMBER;
  delete process.env.TWILIO_STATUS_CALLBACK_URL;

  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
});

describe('sendPatientSMS — mock mode', () => {
  it('returns a Delivered synthetic message id and never calls fetch when LIVERA_SMS_LIVE is unset', async () => {
    const res = await sendPatientSMS({
      to_phone:  '+447700900000',
      text_body: 'Hello',
      template:  'refund_initiated',
    });

    expect(res.status).toBe('Delivered');
    expect(res.message_id).toMatch(/^mock-sms-/);
    expect(res.error_message).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('also runs in mock mode when LIVERA_SMS_LIVE is something other than "true"', async () => {
    setEnv({ LIVERA_SMS_LIVE: 'false' });

    const res = await sendPatientSMS({
      to_phone:  '+447700900000',
      text_body: 'Hi',
      template:  'cancellation_confirmed',
    });

    expect(res.status).toBe('Delivered');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('sendPatientSMS — live mode', () => {
  describe('environment configuration', () => {
    it('fails loudly when Twilio env vars are missing and does not call fetch', async () => {
      setEnv({ LIVERA_SMS_LIVE: 'true' });

      const res = await sendPatientSMS({
        to_phone:  '+447700900000',
        text_body: 'Hi',
        template:  'refund_initiated',
      });

      expect(res.status).toBe('Failed');
      expect(res.message_id).toBeNull();
      expect(res.error_message).toMatch(/Twilio env vars missing/);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('successful Twilio responses', () => {
    beforeEach(() => {
      setEnv({
        LIVERA_SMS_LIVE:    'true',
        TWILIO_ACCOUNT_SID: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TWILIO_AUTH_TOKEN:  'token-shh',
        TWILIO_FROM_NUMBER: '+441234567890',
      });
    });

    it('maps HTTP 2xx with an accepted intermediate status to Delivered and posts From=number', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(201, { sid: 'SM123', status: 'queued', error_code: null }),
      );

      const res = await sendPatientSMS({
        to_phone:  '+447700900000',
        text_body: 'Hello',
        template:  'refund_initiated',
      });

      expect(res).toEqual({ message_id: 'SM123', status: 'Delivered' });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/Accounts/ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/Messages.json');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toMatch(/^Basic /);
      const body = String(init.body);
      expect(body).toContain('To=%2B447700900000');
      expect(body).toContain('From=%2B441234567890');
      expect(body).not.toContain('MessagingServiceSid=');
      expect(body).not.toContain('StatusCallback=');
    });

    it('uses MessagingServiceSid when TWILIO_FROM_NUMBER starts with "MG"', async () => {
      setEnv({ TWILIO_FROM_NUMBER: 'MGabcdef' });
      fetchMock.mockResolvedValueOnce(
        jsonResponse(201, { sid: 'SM999', status: 'accepted', error_code: null }),
      );

      const res = await sendPatientSMS({
        to_phone:  '+447700900000',
        text_body: 'Hi',
        template:  'refund_initiated',
      });

      expect(res.status).toBe('Delivered');
      const body = String(fetchMock.mock.calls[0][1].body);
      expect(body).toContain('MessagingServiceSid=MGabcdef');
      expect(body).not.toMatch(/(^|&)From=/);
    });

    it('forwards StatusCallback when TWILIO_STATUS_CALLBACK_URL is set', async () => {
      setEnv({ TWILIO_STATUS_CALLBACK_URL: 'https://example.test/api/webhooks/twilio/status' });
      fetchMock.mockResolvedValueOnce(
        jsonResponse(201, { sid: 'SM1', status: 'queued', error_code: null }),
      );

      await sendPatientSMS({ to_phone: '+447700900001', text_body: 'x', template: 't' });

      const body = String(fetchMock.mock.calls[0][1].body);
      expect(body).toContain('StatusCallback=https%3A%2F%2Fexample.test%2Fapi%2Fwebhooks%2Ftwilio%2Fstatus');
    });

    it('maps HTTP 2xx + error_code in TWILIO_BOUNCE_CODES (21610 STOP) to Bounced', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(201, {
          sid:           'SMbounce',
          status:        'sent',
          error_code:    21610,
          error_message: 'Recipient has opted out',
        }),
      );

      const res = await sendPatientSMS({
        to_phone:  '+447700900000',
        text_body: 'x',
        template:  't',
      });

      expect(res.status).toBe('Bounced');
      expect(res.message_id).toBe('SMbounce');
      expect(res.error_message).toMatch(/21610/);
      expect(res.error_message).toMatch(/Recipient has opted out/);
    });

    it('maps HTTP 2xx + non-bounce error_code to Failed', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(201, {
          sid:           'SMfail',
          status:        'sent',
          error_code:    30007, // carrier filter — not in TWILIO_BOUNCE_CODES
          error_message: 'Message filtered',
        }),
      );

      const res = await sendPatientSMS({
        to_phone:  '+447700900000',
        text_body: 'x',
        template:  't',
      });

      expect(res.status).toBe('Failed');
      expect(res.message_id).toBe('SMfail');
      expect(res.error_message).toMatch(/30007/);
    });

    it('maps unknown/unexpected status strings to Failed so email fallback kicks in', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(201, { sid: 'SMx', status: 'mystery', error_code: null }),
      );

      const res = await sendPatientSMS({
        to_phone:  '+447700900000',
        text_body: 'x',
        template:  't',
      });

      expect(res.status).toBe('Failed');
      expect(res.error_message).toMatch(/unexpected status="mystery"/);
    });
  });

  describe('HTTP 4xx / 5xx responses', () => {
    beforeEach(() => {
      setEnv({
        LIVERA_SMS_LIVE:    'true',
        TWILIO_ACCOUNT_SID: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TWILIO_AUTH_TOKEN:  'token-shh',
        TWILIO_FROM_NUMBER: '+441234567890',
      });
    });

    it('maps a 401 auth error to Failed with status + detail', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: 20003, message: 'Authentication Error' }),
          { status: 401, statusText: 'Unauthorized', headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const res = await sendPatientSMS({
        to_phone:  '+447700900000',
        text_body: 'x',
        template:  't',
      });

      expect(res.status).toBe('Failed');
      expect(res.message_id).toBeNull();
      expect(res.error_message).toMatch(/^Twilio 401/);
      expect(res.error_message).toMatch(/code 20003/);
      expect(res.error_message).toMatch(/Authentication Error/);
    });

    it('maps a 4xx body whose code is in the bounce set to Bounced', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: 21211, message: "Invalid 'To' phone number" }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const res = await sendPatientSMS({
        to_phone:  'not-a-number',
        text_body: 'x',
        template:  't',
      });

      expect(res.status).toBe('Bounced');
      expect(res.message_id).toBeNull();
      expect(res.error_message).toMatch(/code 21211/);
    });
  });

  describe('network failures', () => {
    beforeEach(() => {
      setEnv({
        LIVERA_SMS_LIVE:    'true',
        TWILIO_ACCOUNT_SID: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        TWILIO_AUTH_TOKEN:  'token-shh',
        TWILIO_FROM_NUMBER: '+441234567890',
      });
    });

    it('returns Failed with the fetch error message when the HTTP request throws', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));

      const res = await sendPatientSMS({
        to_phone:  '+447700900000',
        text_body: 'x',
        template:  't',
      });

      expect(res.status).toBe('Failed');
      expect(res.message_id).toBeNull();
      expect(res.error_message).toMatch(/Twilio HTTP request failed: ECONNRESET/);
    });
  });
});
