/**
 * Livera Pharmacy Comms fixtures — BLD-5.3 (Wave 4).
 *
 * DEC-23: Order-anchored OR patient-anchored threads. Bidirectional with Primed.
 * DEC-28: Amendment hold after Primed clinical check — admin must use Pharmacy Comms.
 *
 * 3-layer safety chain on all mutations:
 *   Layer 1 (UI): form validation + window check before submit
 *   Layer 2 (server): permission gate + topic + anchor validation here
 *   Layer 3 (audit): [AUDIT] on every create / reply
 *
 * Fix Cycle 1:
 *   BLOCKER 4 — can(CURRENT_USER, 'write', 'pharmacy_comms') guard on createPharmacyCommThread
 *   POLISH    — Date.now() replaced with monotonic counter to stay consistent with NOW
 */

import type { ClinicId, PharmacyCommThread, PharmacyCommMessage } from '../types';
import { delay, APIError, scopedToClinic, CURRENT_USER, NOW } from '../constants';
import { can } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Monotonic counter — avoids Date.now() drift vs NOW (POLISH)
// ---------------------------------------------------------------------------

let _pctmCounter = 100;
function nextPCTM(): string {
  const stamp = NOW.replace(/[^0-9]/g, '').slice(-10);
  return `PCTM-${stamp}-${++_pctmCounter}`;
}

// ---------------------------------------------------------------------------
// Seeds — one thread per anchor type for demo purposes
// ---------------------------------------------------------------------------

export const MOCK_PHARMACY_COMM_THREADS: PharmacyCommThread[] = [
  {
    id: 'PCT-001',
    clinic_id: 'feeltru',
    anchor_type: 'order',
    anchor_id: 'ORD-00447',
    topic: 'amendment_address_change',
    priority: 'routine',
    status: 'awaiting_response',
    created_by_user_id: 'user_qadir',
    created_at: '2026-05-10T10:00:00Z',
    updated_at: '2026-05-10T10:00:00Z',
    amendment_id: 'AMEND-002',
    messages: [
      {
        id: 'PCTM-001',
        thread_id: 'PCT-001',
        direction: 'outbound',
        body: 'Patient address has changed. Please update dispatch address for ORD-00447 before next dispatch. Order is post-Primed clinical check — amendment held pending your confirmation (DEC-28).',
        sent_by_user_id: 'user_qadir',
        sent_at: '2026-05-10T10:00:00Z',
        attachments: [],
      },
    ],
  },
  {
    id: 'PCT-002',
    clinic_id: 'vsc',
    anchor_type: 'patient',
    anchor_id: 'PT-00234',
    topic: 'clinical_query',
    priority: 'routine',
    status: 'resolved',
    created_by_user_id: 'user_qadir',
    created_at: '2026-05-02T14:00:00Z',
    updated_at: '2026-05-04T09:00:00Z',
    amendment_id: null,
    messages: [
      {
        id: 'PCTM-002',
        thread_id: 'PCT-002',
        direction: 'outbound',
        body: 'Clinical query re: patient PT-00234. Patient started metformin. Please confirm dispensing team is aware before next order is processed.',
        sent_by_user_id: 'user_qadir',
        sent_at: '2026-05-02T14:00:00Z',
        attachments: [],
      },
      {
        id: 'PCTM-003',
        thread_id: 'PCT-002',
        direction: 'inbound',
        body: 'Confirmed — dispensing team noted. Metformin interaction reviewed. No contraindication for concurrent Mounjaro at current doses. Thread resolved.',
        sent_by_user_id: null,
        sent_at: '2026-05-04T09:00:00Z',
        attachments: [],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function listPharmacyCommThreads(
  clinic_id: ClinicId,
  opts?: { anchor_type?: PharmacyCommThread['anchor_type']; anchor_id?: string; status?: PharmacyCommThread['status'] },
): Promise<PharmacyCommThread[]> {
  await delay();
  let results = scopedToClinic(MOCK_PHARMACY_COMM_THREADS, clinic_id);
  if (opts?.anchor_type) results = results.filter((t) => t.anchor_type === opts.anchor_type);
  if (opts?.anchor_id)   results = results.filter((t) => t.anchor_id   === opts.anchor_id);
  if (opts?.status)      results = results.filter((t) => t.status      === opts.status);
  return results.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getPharmacyCommThread(
  clinic_id: ClinicId,
  thread_id: string,
): Promise<PharmacyCommThread> {
  await delay();
  const t = MOCK_PHARMACY_COMM_THREADS.find((x) => x.id === thread_id && x.clinic_id === clinic_id);
  if (!t) throw new APIError('NOT_FOUND', `Pharmacy comm thread '${thread_id}' not found`);
  return t;
}

/**
 * createPharmacyCommThread — BLD-5.3 / DEC-23
 * Creates an outbound thread. Can be called internally by createAmendment (DEC-28).
 *
 * Fix Cycle 1 — BLOCKER 4: permission gate added.
 */
export async function createPharmacyCommThread(
  clinic_id: ClinicId,
  payload: {
    anchor_type: PharmacyCommThread['anchor_type'];
    anchor_id: string;
    topic: string;
    priority: PharmacyCommThread['priority'];
    body: string;
    amendment_id?: string | null;
  },
): Promise<PharmacyCommThread> {
  await delay();

  // Layer 2 — BLOCKER 4: permission gate (Fix Cycle 1)
  if (!can(CURRENT_USER, 'write', 'pharmacy_comms')) {
    console.log('[AUDIT]', {
      event_type: 'pharmacy_comm_thread_create_blocked',
      outcome:    'PERMISSION_DENIED',
      actor_id:   CURRENT_USER.id,
      clinic_id,
      timestamp:  NOW,
    });
    throw new APIError('SAFETY_VIOLATION', 'Only Admins and Owners may create pharmacy comm threads');
  }

  // Layer 2 — anchor validation
  if (!payload.anchor_id || !payload.topic.trim()) {
    throw new APIError('SAFETY_VIOLATION', 'Pharmacy comm thread requires anchor_id and topic');
  }

  const threadId  = `PCT-${String(MOCK_PHARMACY_COMM_THREADS.length + 1).padStart(3, '0')}`;
  const messageId = nextPCTM();

  const thread: PharmacyCommThread = {
    id: threadId,
    clinic_id,
    anchor_type: payload.anchor_type,
    anchor_id:   payload.anchor_id,
    topic:       payload.topic,
    priority:    payload.priority,
    status:      'open',
    created_by_user_id: CURRENT_USER.id,
    created_at:  NOW,
    updated_at:  NOW,
    amendment_id: payload.amendment_id ?? null,
    messages: [
      {
        id:              messageId,
        thread_id:       threadId,
        direction:       'outbound',
        body:            payload.body,
        sent_by_user_id: CURRENT_USER.id,
        sent_at:         NOW,
        attachments:     [],
      },
    ],
  };

  MOCK_PHARMACY_COMM_THREADS.push(thread);

  // Layer 3 — audit
  console.log('[AUDIT]', {
    event_type:   'pharmacy_comm_thread_created',
    outcome:      'success',
    actor_id:     CURRENT_USER.id,
    thread_id:    threadId,
    clinic_id,
    anchor_type:  payload.anchor_type,
    anchor_id:    payload.anchor_id,
    topic:        payload.topic,
    amendment_id: payload.amendment_id ?? null,
    timestamp:    NOW,
  });

  return thread;
}

/**
 * replyToThread — add a message (outbound) to an existing thread.
 *
 * Fix Cycle 1 — POLISH: nextPCTM() replaces Date.now() for ID generation.
 */
export async function replyToPharmacyCommThread(
  clinic_id: ClinicId,
  thread_id: string,
  body: string,
  attachments: string[] = [],
): Promise<PharmacyCommMessage> {
  await delay();

  const thread = MOCK_PHARMACY_COMM_THREADS.find((t) => t.id === thread_id && t.clinic_id === clinic_id);
  if (!thread) throw new APIError('NOT_FOUND', `Thread '${thread_id}' not found`);
  if (thread.status === 'resolved') {
    throw new APIError('SAFETY_VIOLATION', 'Cannot reply to a resolved pharmacy comm thread');
  }

  if (!body.trim()) {
    throw new APIError('SAFETY_VIOLATION', 'Message body cannot be empty');
  }

  const message: PharmacyCommMessage = {
    id:              nextPCTM(),
    thread_id,
    direction:       'outbound',
    body,
    sent_by_user_id: CURRENT_USER.id,
    sent_at:         NOW,
    attachments,
  };

  thread.messages.push(message);
  thread.status     = 'awaiting_response';
  thread.updated_at = NOW;

  console.log('[AUDIT]', {
    event_type: 'pharmacy_comm_reply_sent',
    outcome:    'success',
    actor_id:   CURRENT_USER.id,
    thread_id,
    clinic_id,
    timestamp:  NOW,
  });

  return message;
}
