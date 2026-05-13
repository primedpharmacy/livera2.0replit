/**
 * Intercom integration layer — Wave 6 (BLD-8.2 + BLD-8.4).
 *
 * Feature flag: LIVERA_INTERCOM_LIVE (process.env, default false)
 *   false → stub mode: logs [INTERCOM_*_STUB] markers; no real Intercom API calls
 *   true  → real Intercom API paths (V1.2 deferred — currently throws descriptive error)
 *
 * Required Intercom configuration (set in Intercom dashboard):
 *
 *   Tag name: 'Incident'
 *     Clinicians tag a conversation 'Incident' to trigger incident creation in Livera.
 *
 *   Webhook event subscription topic: 'conversation_tag_created'
 *     This is the canonical Intercom webhook topic (API v2.11+) fired when a tag is
 *     added to a conversation. Older Intercom documentation refers to this as
 *     'conversation.tag_added' — both topic strings are handled in route.ts as aliases.
 *     Reference: https://developers.intercom.com/docs/references/webhooks/conversation_tag_created
 *
 *   Additional event: 'conversation_closed'
 *     Required for BLD-8.4 closure-block logic. Fired when an operator or automation
 *     closes a conversation. Reference:
 *     https://developers.intercom.com/docs/references/webhooks/conversation_closed
 *
 *   Webhook signature header: 'X-Hub-Signature'
 *     Intercom signs the raw request body with HMAC-SHA1 using your webhook secret.
 *     Header format: sha1=<hex_digest>
 *     V1.2: verify using INTERCOM_WEBHOOK_SECRET env var via Node.js crypto.createHmac.
 *     Reference:
 *     https://developers.intercom.com/docs/build-an-integration/learn-by-example/webhooks/validate-webhook-signatures/
 *
 *   Intercom user field: external_id
 *     When creating Intercom users from Livera patients, set external_id = patient.id
 *     (e.g. 'PT-00198'). The webhook payload contacts[].external_id is used to look up
 *     the matching patient in BLD-8.3 resolution.
 *
 * Related files:
 *   lib/api/fixtures/incidents.ts — createIncident (BLD-8.3)
 *   app/api/webhooks/intercom/route.ts — POST handler (BLD-8.2/8.3/8.4)
 *   lib/integrations/monday.ts — Wave 3 SLA breach stub (separate; not touched here)
 *
 * LIVERA_INTERCOM_LIVE pattern mirrors LIVERA_MONDAY_LIVE (BLD-9.0) and
 * LIVERA_POSTMARK_LIVE (Wave 5) — consistent deferred-live pattern across integrations.
 */

// Feature flag — default false in V1.1. Set LIVERA_INTERCOM_LIVE=true in deployment
// env when real Intercom API wiring is ready (V1.2 milestone).
export const LIVERA_INTERCOM_LIVE =
  process.env.LIVERA_INTERCOM_LIVE === 'true';

// Intercom App ID — used in building conversation deep-link URLs.
// Set INTERCOM_APP_ID env var in deployment config.
// URL format: https://app.intercom.com/a/inbox/{INTERCOM_APP_ID}/inbox/conversation/{conversation_id}
export const INTERCOM_APP_ID =
  process.env.INTERCOM_APP_ID ?? 'LIVERA_APP_ID_PLACEHOLDER';

// ── buildIntercomThreadUrl ───────────────────────────────────────────────────
/**
 * Build a deep-link URL to an Intercom conversation.
 * Stored on Incident.intercom_thread_url for audit + BLD-8.4 closure-block lookup.
 */
export function buildIntercomThreadUrl(conversation_id: string): string {
  return `https://app.intercom.com/a/inbox/${INTERCOM_APP_ID}/inbox/conversation/${conversation_id}`;
}

// ── verifyIntercomSignature ──────────────────────────────────────────────────
/**
 * Validate the X-Hub-Signature HMAC-SHA1 header on incoming Intercom webhooks.
 *
 * V1.1 stub:
 *   - stub mode (LIVERA_INTERCOM_LIVE=false): always returns true (skipped)
 *   - live mode (LIVERA_INTERCOM_LIVE=true): placeholder — TODO V1.2
 *
 * V1.2: uncomment real HMAC implementation below and set INTERCOM_WEBHOOK_SECRET env var.
 *
 * @param rawBody   Raw request body string (before JSON.parse)
 * @param signature Value of the X-Hub-Signature header (format: "sha1=<hex_digest>")
 */
export function verifyIntercomSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!LIVERA_INTERCOM_LIVE) {
    // Stub mode — skip signature verification entirely; logged in route.ts
    return true;
  }

  // TODO V1.2: implement real HMAC-SHA1 verification
  // import { createHmac, timingSafeEqual } from 'crypto';
  // const secret = process.env.INTERCOM_WEBHOOK_SECRET ?? '';
  // if (!secret) throw new Error('[INTERCOM] INTERCOM_WEBHOOK_SECRET env var not set');
  // const expected = `sha1=${createHmac('sha1', secret).update(rawBody).digest('hex')}`;
  // return timingSafeEqual(Buffer.from(expected), Buffer.from(signature ?? ''));
  console.warn('[INTERCOM] Signature verification placeholder — deferred to V1.2');
  void rawBody;
  void signature;
  return true;
}

// ── blockIntercomClosure ─────────────────────────────────────────────────────
/**
 * Prevent an Intercom conversation from being closed while the linked Incident
 * is not yet in a terminal status (resolved / closed).
 *
 * V1.1 stub: logs [INTERCOM_CLOSURE_BLOCKED]; no real Intercom API call.
 *
 * V1.2: Intercom does not expose a native "prevent close" verb. Options:
 *   1. Re-open the conversation: PATCH /conversations/{id} { "state": "open" }
 *   2. Post an internal note warning the team not to close until incident resolved.
 *   Deferred pending Intercom support confirmation of preferred approach.
 *
 * Called from:
 *   app/api/webhooks/intercom/route.ts → handleConversationClosed (BLD-8.4)
 */
export async function blockIntercomClosure(
  conversation_id: string,
  incident_id: string,
  reason: string
): Promise<void> {
  if (LIVERA_INTERCOM_LIVE) {
    // TODO V1.2: implement real Intercom API call to re-open or annotate conversation
    // e.g. PATCH https://api.intercom.io/conversations/{conversation_id}
    //   body: { "state": "open" }
    //   headers: { Authorization: `Bearer ${process.env.INTERCOM_ACCESS_TOKEN}` }
    throw new Error(
      '[INTERCOM] blockIntercomClosure: real API call deferred to V1.2. ' +
        'Stub mode only in V1.1. Set LIVERA_INTERCOM_LIVE=false to suppress.'
    );
  }

  // Stub mode — log only, no API call
  console.log('[INTERCOM_CLOSURE_BLOCKED]', {
    conversation_id,
    incident_id,
    reason,
  });
}

// ── allowIntercomClosure ─────────────────────────────────────────────────────
/**
 * Release any programmatic block on an Intercom conversation once the linked
 * Incident reaches a terminal status (resolved / closed).
 *
 * V1.1 stub: logs [INTERCOM_CLOSURE_ALLOWED]; no real Intercom API call.
 *
 * V1.2: Post clearance note or close the conversation programmatically.
 *
 * Called from:
 *   lib/api/fixtures/incidents.ts → updateIncidentStatus (BLD-8.4 hook)
 *   when Incident.status transitions to 'resolved' or 'closed' AND
 *   Incident.intercom_thread_url is set.
 */
export async function allowIntercomClosure(
  conversation_id: string,
  incident_id: string,
  new_status: string
): Promise<void> {
  if (LIVERA_INTERCOM_LIVE) {
    // TODO V1.2: implement real Intercom API call to release closure block
    throw new Error(
      '[INTERCOM] allowIntercomClosure: real API call deferred to V1.2. ' +
        'Stub mode only in V1.1. Set LIVERA_INTERCOM_LIVE=false to suppress.'
    );
  }

  // Stub mode — log only, no API call
  console.log('[INTERCOM_CLOSURE_ALLOWED]', {
    conversation_id,
    incident_id,
    new_status,
  });
}
