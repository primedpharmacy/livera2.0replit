/**
 * Intercom webhook route handler — Wave 6 (BLD-8.2 + BLD-8.3 + BLD-8.4).
 *
 * POST /api/webhooks/intercom
 *
 * Design invariant: always returns HTTP 200 to Intercom.
 *   Intercom retries webhooks on non-200 responses, which could cause duplicate
 *   incident creation or infinite retry loops. All failure paths log [AUDIT] and
 *   return 200. Idempotency is a V1.2 concern (BLD-8.5 backlog).
 *
 * Topics handled:
 *   'conversation_tag_created' (+ alias 'conversation.tag_added')
 *     → BLD-8.3: if tag = 'Incident', resolve patient + create Livera incident
 *   'conversation_closed' (+ alias 'conversation.closed')
 *     → BLD-8.4: if linked incident not terminal, log closure block
 *
 * Signature verification (X-Hub-Signature HMAC-SHA1):
 *   - stub mode (LIVERA_INTERCOM_LIVE=false): skipped, logged
 *   - live mode (LIVERA_INTERCOM_LIVE=true): placeholder — TODO V1.2
 *
 * Stub mode (LIVERA_INTERCOM_LIVE=false):
 *   Short-circuits BEFORE calling createIncident.
 *   Logs '[INTERCOM_WEBHOOK_STUB] would_create_incident ...' and returns 200.
 *   No Incident records are created. No Monday writes occur.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  LIVERA_INTERCOM_LIVE,
  verifyIntercomSignature,
  buildIntercomThreadUrl,
  blockIntercomClosure,
} from '@/lib/integrations/intercom';
import { MOCK_PATIENTS } from '@/lib/api/fixtures/patients';
import { MOCK_INCIDENTS, createIncident } from '@/lib/api/fixtures/incidents';
import { SYSTEM_USER, NOW } from '@/lib/api/constants';

// ── Intercom webhook payload shape (v2.11 API) ───────────────────────────────
// Only fields relevant to Livera are typed; additional fields are ignored.
interface IntercomContact {
  type: string;
  id: string;
  external_id?: string | null;  // our patient.id or patient.intercom_user_id
}

interface IntercomTag {
  id: string;
  name: string;
}

// Extracted as a standalone interface so handler functions can type their `item`
// parameter without double-optional indexing (`payload['data']['item']` doesn't
// compile when `data` itself is optional).
interface IntercomItem {
  type?: string;
  id?: string;  // conversation_id
  source?: {
    subject?: string;
    body?: string;
  };
  contacts?: {
    contacts?: IntercomContact[];
  };
  tags?: {
    tags?: IntercomTag[];
  };
}

interface IntercomWebhookPayload {
  type?: string;
  topic?: string;
  app_id?: string;
  data?: {
    item?: IntercomItem;
  };
}

// Intercom tag name that triggers incident creation (configured in Intercom dashboard)
const INCIDENT_TAG_NAME = 'Incident';

// ── POST handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let rawBody: string;
  let payload: IntercomWebhookPayload;

  // Step 1: Read + parse body
  try {
    rawBody = await request.text();
    payload = JSON.parse(rawBody) as IntercomWebhookPayload;
  } catch (err) {
    // Parse failure — still return 200
    console.log('[AUDIT]', {
      event_type: 'incident_webhook_failed',
      reason: 'parse_error',
      error: err instanceof Error ? err.message : String(err),
      timestamp: NOW,
    });
    return NextResponse.json({ ok: false, reason: 'parse_error' }, { status: 200 });
  }

  // Step 2: Signature verification
  if (!LIVERA_INTERCOM_LIVE) {
    console.log('[INTERCOM_WEBHOOK_STUB] signature_check=skipped');
  } else {
    const sig = request.headers.get('X-Hub-Signature');
    const valid = verifyIntercomSignature(rawBody, sig);
    if (!valid) {
      console.log('[AUDIT]', {
        event_type: 'intercom_webhook_rejected',
        reason: 'signature_mismatch',
        timestamp: NOW,
      });
      // Still return 200 — do not trigger Intercom retry loop
      return NextResponse.json({ ok: false, reason: 'signature_mismatch' }, { status: 200 });
    }
  }

  // Step 3: Route to topic handler
  const topic = payload.topic ?? payload.type ?? '';
  const item = payload.data?.item;

  try {
    if (
      topic === 'conversation_tag_created' ||
      topic === 'conversation.tag_added'   // legacy alias
    ) {
      await handleTagAdded(item);
    } else if (
      topic === 'conversation_closed' ||
      topic === 'conversation.closed'  // legacy alias
    ) {
      await handleConversationClosed(item);
    } else {
      // Unknown topic — log + ignore; do not error
      console.log('[INTERCOM_WEBHOOK_STUB]', { action: 'unknown_topic_ignored', topic, timestamp: NOW });
    }
  } catch (err) {
    // Catch-all: still return 200 — log failure without retrying
    console.log('[AUDIT]', {
      event_type: 'incident_webhook_failed',
      topic,
      error: err instanceof Error ? err.message : String(err),
      timestamp: NOW,
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// ── BLD-8.3: conversation_tag_created ────────────────────────────────────────
// Only acts when the added tag name === 'Incident'.
// Stub mode: logs would_create_incident and returns without calling createIncident.
// Live mode: resolves patient by intercom_user_id → creates Livera Incident.
async function handleTagAdded(item: IntercomItem | undefined) {
  const tags = item?.tags?.tags ?? [];
  const hasIncidentTag = tags.some((t) => t.name === INCIDENT_TAG_NAME);

  if (!hasIncidentTag) {
    // Tag added but not 'Incident' — skip silently
    return;
  }

  const conversation_id = item?.id ?? 'unknown';
  const intercom_thread_url = buildIntercomThreadUrl(conversation_id);

  // BLD-8.3 acceptance criterion 5: stub mode short-circuits BEFORE createIncident
  if (!LIVERA_INTERCOM_LIVE) {
    const contacts = item?.contacts?.contacts ?? [];
    // external_id is set to patient.id when patient is created in Intercom
    const intercomUserId = contacts[0]?.external_id ?? contacts[0]?.id ?? 'unknown';
    console.log('[INTERCOM_WEBHOOK_STUB]', {
      action: 'would_create_incident',
      patient_intercom_user_id: intercomUserId,
      origin: 'intercom_tag',
      conversation_id,
      intercom_thread_url,
      timestamp: NOW,
    });
    return;
  }

  // Live mode: resolve patient_id from Intercom external_id (= patient.intercom_user_id)
  const contacts = item?.contacts?.contacts ?? [];
  // external_id is set on the Intercom contact to our patient.id or intercom_user_id
  const intercomUserId = contacts[0]?.external_id ?? null;

  if (!intercomUserId) {
    // BLD-8.3: no user ID in payload — orphan audit, no incident created
    console.log('[AUDIT]', {
      event_type: 'incident_webhook_orphan',
      reason: 'no_intercom_user_id_in_payload',
      conversation_id,
      timestamp: NOW,
    });
    return;
  }

  // Look up patient by intercom_user_id (BLD-8.3 acceptance criterion 2)
  const patient = MOCK_PATIENTS.find((p) => p.intercom_user_id === intercomUserId);

  if (!patient) {
    // BLD-8.3: patient not found — orphan audit, no incident, manual reconciliation later
    console.log('[AUDIT]', {
      event_type: 'incident_webhook_orphan',
      reason: 'patient_not_found',
      intercom_user_id: intercomUserId,
      conversation_id,
      timestamp: NOW,
    });
    return;
  }

  // Build description from conversation source (BLD-8.3 acceptance criterion 3)
  const subject = item?.source?.subject ?? '';
  const sourceBody = item?.source?.body ?? '';
  const body = subject || sourceBody
    ? [subject, sourceBody].filter(Boolean).join('\n\n')
    : `Intercom thread: ${conversation_id}`;
  // TODO V1.2: strip HTML from sourceBody if Intercom sends rich text

  // BLD-8.3 acceptance criterion 3: call createIncident with origin='intercom_tag'
  // Layer 2 (server gate) and Layer 3 (audit) are inside createIncident.
  await createIncident(
    patient.id,
    'intercom_tag',
    body,
    {
      intercom_thread_url,
      clinic_id: patient.clinic_id,
    },
    SYSTEM_USER
  );
}

// ── BLD-8.4: conversation_closed ─────────────────────────────────────────────
// Looks up linked Incident by intercom_thread_url.
// If Incident is not terminal: log [INTERCOM_CLOSURE_BLOCKED] + [AUDIT].
// If Incident is terminal or no linked incident: allow naturally (no action).
async function handleConversationClosed(item: IntercomItem | undefined) {
  const conversation_id = item?.id ?? 'unknown';
  const intercom_thread_url = buildIntercomThreadUrl(conversation_id);

  // Find incident linked to this Intercom conversation
  const incident = MOCK_INCIDENTS.find((i) => i.intercom_thread_url === intercom_thread_url);

  if (!incident) {
    // No linked incident — conversation can close naturally
    return;
  }

  const TERMINAL_STATUSES: typeof incident.status[] = ['resolved', 'closed'];
  const isTerminal = TERMINAL_STATUSES.includes(incident.status);

  if (!isTerminal) {
    // BLD-8.4 closure-block path
    console.log('[AUDIT]', {
      event_type: 'intercom_closure_blocked',
      conversation_id,
      incident_id: incident.id,
      incident_status: incident.status,
      reason: 'incident_not_resolved',
      timestamp: NOW,
    });
    // blockIntercomClosure: stub → [INTERCOM_CLOSURE_BLOCKED] log; live → Intercom API (V1.2)
    await blockIntercomClosure(conversation_id, incident.id, 'incident_not_resolved');
  } else {
    // BLD-8.4 closure-allow path — incident already terminal, allow closure naturally
    console.log('[AUDIT]', {
      event_type: 'intercom_closure_allowed',
      conversation_id,
      incident_id: incident.id,
      incident_status: incident.status,
      timestamp: NOW,
    });
  }
}
