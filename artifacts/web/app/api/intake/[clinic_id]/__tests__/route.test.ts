/**
 * Unit tests — POST /api/intake/:clinic_id validation (Task-115)
 *
 * The intake form already validates phone + postcode client-side, but the
 * API route must independently re-validate so bad data cannot reach the
 * patient record via direct API calls / replays / forged requests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../route';

vi.mock('@/lib/api/fixtures/orders', () => ({
  createIntakeOrder: vi.fn(async () =>
    ({ id: 'ORD-TEST-115', status: 'clinical_check', clinic_id: 'feeltru' })),
}));

import { createIntakeOrder } from '@/lib/api/fixtures/orders';

const VALID_PERSONAL = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  dob: '1990-01-01',
  phone: '07700 900123',
  sexAtBirth: 'female',
};
const VALID_ADDRESS = {
  formatted: '1 Test St, Oxford OX4 2NE, UK',
  line1: '1 Test St',
  line2: '',
  city: 'Oxford',
  postcode: 'OX4 2NE',
};

function buildReq(body: unknown): { req: Request; params: Promise<{ clinic_id: string }> } {
  const req = new Request('http://localhost/api/intake/feeltru', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { req, params: Promise.resolve({ clinic_id: 'feeltru' }) };
}

beforeEach(() => {
  vi.mocked(createIntakeOrder).mockClear();
});

describe('POST /api/intake/:clinic_id — phone validation', () => {
  it('rejects a malformed phone with 400', async () => {
    const { req, params } = buildReq({
      personal: { ...VALID_PERSONAL, phone: '07700' },
      address: VALID_ADDRESS,
      responses: {},
    });
    const res = await POST(req as never, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/phone/i);
    expect(createIntakeOrder).not.toHaveBeenCalled();
  });

  it('rejects a missing phone with 400', async () => {
    const { req, params } = buildReq({
      personal: { ...VALID_PERSONAL, phone: '' },
      address: VALID_ADDRESS,
      responses: {},
    });
    const res = await POST(req as never, { params });
    expect(res.status).toBe(400);
    expect(createIntakeOrder).not.toHaveBeenCalled();
  });

  it('normalises an accepted phone to E.164 before persisting', async () => {
    const { req, params } = buildReq({
      personal: { ...VALID_PERSONAL, phone: '07700 900 123' },
      address: VALID_ADDRESS,
      responses: {},
    });
    const res = await POST(req as never, { params });
    expect(res.status).toBe(201);
    expect(createIntakeOrder).toHaveBeenCalledTimes(1);
    const personalArg = vi.mocked(createIntakeOrder).mock.calls[0][1];
    expect(personalArg.phone).toBe('+447700900123');
  });
});

describe('POST /api/intake/:clinic_id — postcode validation', () => {
  it('rejects a malformed postcode with 400', async () => {
    const { req, params } = buildReq({
      personal: VALID_PERSONAL,
      address: { ...VALID_ADDRESS, postcode: 'OXFORD' },
      responses: {},
    });
    const res = await POST(req as never, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/postcode/i);
    expect(createIntakeOrder).not.toHaveBeenCalled();
  });

  it('rejects the task-example typo "OX42NE" wait — that IS valid; instead reject "0X4 2NE"', async () => {
    const { req, params } = buildReq({
      personal: VALID_PERSONAL,
      address: { ...VALID_ADDRESS, postcode: '0X4 2NE' },
      responses: {},
    });
    const res = await POST(req as never, { params });
    expect(res.status).toBe(400);
  });

  it('normalises spacing/case before persisting', async () => {
    const { req, params } = buildReq({
      personal: VALID_PERSONAL,
      address: { ...VALID_ADDRESS, postcode: 'ox42ne' },
      responses: {},
    });
    const res = await POST(req as never, { params });
    expect(res.status).toBe(201);
    const addressArg = vi.mocked(createIntakeOrder).mock.calls[0][2];
    expect(addressArg.postcode).toBe('OX4 2NE');
  });
});

describe('POST /api/intake/:clinic_id — happy path', () => {
  it('accepts a fully valid submission and returns 201 with order metadata', async () => {
    const { req, params } = buildReq({
      personal: VALID_PERSONAL,
      address: VALID_ADDRESS,
      responses: { ft_oq_1: 'yes' },
    });
    const res = await POST(req as never, { params });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      order_id: 'ORD-TEST-115',
      clinic_id: 'feeltru',
    });
  });
});
