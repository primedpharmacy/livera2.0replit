/**
 * Unit tests — resendPxUploadLink() (Task-91)
 *
 * The resend path is small but every step matters:
 *   - it must rotate the token so the previous link can no longer be used
 *   - it must refuse when the patient has already uploaded
 *   - it must refuse when the order never required an upload at all
 *   - it must append an entry to px_upload_link.resends[] for the timeline
 *   - it must mark previous_expired:true when the old token was past its TTL
 *
 * These tests pin those behaviours so a future refactor (e.g. forgetting to
 * call sendPxUploadLinkEmail, which is what rotates the token) cannot
 * silently leave the old link valid.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resendPxUploadLink,
  attachPxUploadByToken,
  MOCK_ORDERS,
} from '../orders';
import type { Order } from '../../types';
import { APIError } from '../../constants';

// ── Snapshot / restore ─────────────────────────────────────────────────────
// resendPxUploadLink mutates MOCK_ORDERS in place; clone a baseline so each
// case starts from the same fixture state.

let ordersSnapshot: Order[];

function snapshot() {
  ordersSnapshot = MOCK_ORDERS.map((o) => structuredClone(o));
}

function restore() {
  MOCK_ORDERS.splice(0, MOCK_ORDERS.length, ...ordersSnapshot.map((o) => structuredClone(o)));
}

snapshot();

beforeEach(() => {
  restore();
});

// ZARA_ORDER_FEELTRU_PX_PENDING — GLP-1 higher-dose intake on the feeltru
// clinic that already carries the "Px upload pending" contextual flag.
const PX_PENDING_ORDER_ID = 'ORD-00451';
const PX_PENDING_CLINIC: 'feeltru' = 'feeltru';

function getOrder(id: string): Order {
  const o = MOCK_ORDERS.find((o) => o.id === id);
  if (!o) throw new Error(`fixture order ${id} not found`);
  return o;
}

// Seed an existing px_upload_link on the px-pending order so we can assert
// rotation against the previous token. expires_at is configurable so the
// "previous_expired" branch can be exercised too.
function seedExistingLink(
  orderId: string,
  opts: { expiresAt?: string; sentAt?: string } = {},
): { token: string; expires_at: string } {
  const order = getOrder(orderId);
  const expiresAt =
    opts.expiresAt ?? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const sentAt = opts.sentAt ?? '2026-05-10T08:00:00Z';
  const token = 'seeded-original-token-do-not-collide';
  order.px_upload_link = {
    token,
    expires_at: expiresAt,
    sent_at: sentAt,
    consumed_at: null,
    email_message_id: 'mock-pm-seeded',
    to_email: 'zara.ahmed@example.com',
  };
  return { token, expires_at: expiresAt };
}

describe('resendPxUploadLink() — happy path', () => {
  it('rotates the token so the previous one is no longer present on the order', async () => {
    const original = seedExistingLink(PX_PENDING_ORDER_ID);

    const updated = await resendPxUploadLink(PX_PENDING_CLINIC, PX_PENDING_ORDER_ID);

    expect(updated.px_upload_link).not.toBeNull();
    expect(updated.px_upload_link!.token).toBeTruthy();
    expect(updated.px_upload_link!.token).not.toBe(original.token);
    // A fresh TTL is minted — expires_at should also have moved forward.
    expect(new Date(updated.px_upload_link!.expires_at).getTime())
      .toBeGreaterThan(new Date(original.expires_at).getTime());
  });

  it('appends a resends[] entry recording the new sent link', async () => {
    seedExistingLink(PX_PENDING_ORDER_ID);

    const updated = await resendPxUploadLink(PX_PENDING_CLINIC, PX_PENDING_ORDER_ID);
    const newLink = updated.px_upload_link!;

    const resends = newLink.resends ?? [];
    expect(resends).toHaveLength(1);
    expect(resends[0]).toMatchObject({
      sent_at: newLink.sent_at,
      to_email: newLink.to_email,
      expires_at: newLink.expires_at,
      previous_expired: false,
      by_user_id: expect.any(String),
    });

    // A second resend should append (not overwrite) — proving the timeline
    // grows as staff re-issue the link.
    const updated2 = await resendPxUploadLink(PX_PENDING_CLINIC, PX_PENDING_ORDER_ID);
    expect((updated2.px_upload_link!.resends ?? []).length).toBe(2);
  });

  it('marks previous_expired:true when the old token was past its TTL', async () => {
    seedExistingLink(PX_PENDING_ORDER_ID, {
      expiresAt: '2026-04-01T00:00:00Z', // well in the past
    });

    const updated = await resendPxUploadLink(PX_PENDING_CLINIC, PX_PENDING_ORDER_ID);

    const resends = updated.px_upload_link!.resends ?? [];
    expect(resends).toHaveLength(1);
    expect(resends[0].previous_expired).toBe(true);
  });
});

describe('resendPxUploadLink() — refusals', () => {
  it('refuses when px_upload is already set', async () => {
    seedExistingLink(PX_PENDING_ORDER_ID);
    const order = getOrder(PX_PENDING_ORDER_ID);
    order.px_upload = {
      filename: 'already-uploaded.pdf',
      size: 64 * 1024,
      content_type: 'application/pdf',
      object_path: '/objects/uploads/already',
      uploaded_at: '2026-05-15T09:00:00Z',
    };

    await expect(resendPxUploadLink(PX_PENDING_CLINIC, PX_PENDING_ORDER_ID))
      .rejects.toBeInstanceOf(APIError);
    await expect(resendPxUploadLink(PX_PENDING_CLINIC, PX_PENDING_ORDER_ID))
      .rejects.toMatchObject({
        code: 'INVALID_STATE',
        message: expect.stringContaining('already been uploaded'),
      });
  });

  it("refuses when the order doesn't require a Px upload", async () => {
    // JAMES_ORDER_VSC (ORD-00438) has no "Px upload pending" flag — it's a
    // captured/approved order on a different path. Strip the flag explicitly
    // just to be defensive, then attempt a resend.
    const order = getOrder('ORD-00438');
    order.contextual_flags = (order.contextual_flags ?? []).filter(
      (f) => f !== 'Px upload pending',
    );

    await expect(resendPxUploadLink(order.clinic_id, order.id))
      .rejects.toMatchObject({
        code: 'INVALID_STATE',
        message: expect.stringContaining('does not require'),
      });
  });
});

describe('resendPxUploadLink() — old token is invalidated end-to-end', () => {
  it('prevents attachPxUploadByToken from consuming the previous token after a resend', async () => {
    const original = seedExistingLink(PX_PENDING_ORDER_ID);

    await resendPxUploadLink(PX_PENDING_CLINIC, PX_PENDING_ORDER_ID);

    // The previous token must no longer resolve to an order — the resend
    // rotates px_upload_link.token to a fresh value, so attachPxUploadByToken
    // sees the old token as "not_found" and raises SAFETY_VIOLATION.
    await expect(
      attachPxUploadByToken(PX_PENDING_CLINIC, original.token, {
        filename: 'late.pdf',
        size: 32 * 1024,
        content_type: 'application/pdf',
        object_path: '/objects/uploads/late',
      }),
    ).rejects.toMatchObject({ code: 'SAFETY_VIOLATION' });

    // The order must still be awaiting an upload — the safety violation
    // should not have attached anything.
    const order = getOrder(PX_PENDING_ORDER_ID);
    expect(order.px_upload).toBeNull();
  });
});
