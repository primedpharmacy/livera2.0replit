/**
 * Livera Welcome Calls fixture — BLD-13.3.
 *
 * NOW = '2026-05-11T08:00:00Z'
 * Three canonical records covering the full status lifecycle:
 *   WC-0053: Michelle Clarke — completed (1 attempt, flag raised)
 *   WC-0058: Sarah Chen     — awaiting (no attempts yet, 53h since trigger)
 *   WC-0047: Beth Newman    — unreachable (3 attempts, escalation due)
 */

import type {
  WelcomeCall,
  WelcomeCallAttempt,
  WelcomeCallAttemptType,
  ClinicId,
} from '../types';
import {
  APIError,
  CURRENT_USER,
  NOW,
  delay,
  scopedToClinic,
} from '../constants';

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

export const MOCK_WELCOME_CALLS: WelcomeCall[] = [
  // ── WC-0053: Completed ───────────────────────────────────────────────────
  {
    id: 'WC-0053',
    patient_id: 'PT-00210',
    order_id: 'ORD-01278',
    clinic_id: 'feeltru',
    status: 'completed',
    owner_user_id: 'user_mobeen',
    trigger_description: 'First paid order dispatched 28 hours ago · 2-day welcome call rule',
    triggered_at: '2026-05-05T07:00:00Z',
    attempts: [
      {
        id: 'att-a1',
        type: 'success',
        timestamp: '2026-05-06T11:14:00Z',
        by_user_id: 'user_mobeen',
        duration_display: '8 min',
        channel: 'Intercom telephone',
        body: 'Connected with patient. Walked through expectations for first injection, dose escalation timeline, side-effect monitoring, and the patient app.',
        notes: 'Patient confirmed receipt of order, understood injection technique demonstrated in app video. Reported feeling positive about starting treatment. Asked about timing of meals around dosing — referred to in-app guidance and confirmed she would speak to her GP about her existing thyroid medication. No clinical concerns raised. Comfortable with side-effect reporting flow. Welcome call complete; flagged the thyroid medication query as a follow-up note for the prescriber.',
      },
    ],
    outcome: {
      outcome_summary: 'Completed — clinical concern noted',
      patient_receptive: true,
      comfortable_with_app: true,
      side_effects_understood: true,
      follow_up_needed: true,
      follow_up_note: 'Thyroid medication query (levothyroxine) — routed to prescriber for review',
      flag_raised_text: 'Yes (FLAG-004 v1 · welcome call concern)',
    },
    flag_raised: {
      flag_id: 'FLAG-004',
      flag_name: 'Welcome call — clinical concern raised',
      severity: 'MEDIUM',
      reason: 'Patient on existing thyroid medication (levothyroxine 50mcg). Wants to clarify timing/interaction with GLP-1. Routing to prescriber for clinical review.',
      raised_by_user_id: 'user_mobeen',
    },
    created_at: '2026-05-05T07:00:00Z',
    updated_at: '2026-05-06T11:25:00Z',
  },

  // ── WC-0058: Awaiting ────────────────────────────────────────────────────
  {
    id: 'WC-0058',
    patient_id: 'PT-00214',
    order_id: 'ORD-01287',
    clinic_id: 'feeltru',
    status: 'awaiting',
    owner_user_id: 'user_mobeen',
    trigger_description: 'First paid order dispatched 53 hours ago · 2-day welcome call rule',
    triggered_at: '2026-05-08T07:00:00Z',
    attempts: [],
    created_at: '2026-05-08T07:00:00Z',
    updated_at: '2026-05-08T07:00:00Z',
  },

  // ── WC-0047: Unreachable ─────────────────────────────────────────────────
  {
    id: 'WC-0047',
    patient_id: 'PT-00199',
    order_id: 'ORD-01258',
    clinic_id: 'feeltru',
    status: 'unreachable',
    owner_user_id: 'user_mobeen',
    trigger_description: 'First paid order dispatched 96 hours ago · 2-day welcome call rule',
    triggered_at: '2026-05-07T08:00:00Z',
    attempts: [
      {
        id: 'att-b1',
        type: 'no_answer',
        timestamp: '2026-05-09T10:14:00Z',
        by_user_id: 'user_mobeen',
        duration_display: '0:32',
        channel: 'Intercom telephone',
        body: 'No answer. Rang out to voicemail; voicemail box was full so no message could be left.',
      },
      {
        id: 'att-b2',
        type: 'no_answer',
        timestamp: '2026-05-10T14:08:00Z',
        by_user_id: 'user_mobeen',
        duration_display: '0:28',
        channel: 'Intercom telephone',
        body: 'No answer. Voicemail still full. SMS sent via Intercom: "Hi Beth, this is Mobeen from FeelTru — please ring us when convenient on 020 8000 0000."',
      },
      {
        id: 'att-b3',
        type: 'no_answer',
        timestamp: '2026-05-11T07:42:00Z',
        by_user_id: 'user_mobeen',
        duration_display: '0:25',
        channel: 'Intercom telephone',
        body: 'No answer. Email sent as final attempt before flagging unreachable.',
      },
    ],
    outcome: {
      outcome_summary: 'Unreachable — 3 attempts over 2 days',
      follow_up_needed: true,
      follow_up_note: 'Escalation pending — owner to review with prescriber',
    },
    created_at: '2026-05-07T08:00:00Z',
    updated_at: '2026-05-11T07:42:00Z',
  },
];

// VSC mirror
const VSC_CALLS: WelcomeCall[] = MOCK_WELCOME_CALLS.map((wc) => ({
  ...wc,
  clinic_id: 'vsc' as ClinicId,
}));

const ALL_WELCOME_CALLS = [...MOCK_WELCOME_CALLS, ...VSC_CALLS];

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export async function listWelcomeCalls(clinicId: ClinicId): Promise<WelcomeCall[]> {
  await delay(80);
  return scopedToClinic(ALL_WELCOME_CALLS, clinicId);
}

export async function getWelcomeCall(clinicId: ClinicId, callId: string): Promise<WelcomeCall> {
  await delay(60);
  const call = ALL_WELCOME_CALLS.find((wc) => wc.clinic_id === clinicId && wc.id === callId);
  if (!call) throw new APIError('404', `Welcome call ${callId} not found`);
  return call;
}

// ---------------------------------------------------------------------------
// Mutations — Task-157
//
// Replace the toast-only stubs on the Welcome Call detail page with real
// persisted transitions. These mutate the in-memory MOCK_WELCOME_CALLS so
// that a hard refresh reflects the saved state, matching the calling
// contract of other queue mutations (acknowledgeComplaint, etc).
// ---------------------------------------------------------------------------

function findWelcomeCall(clinic_id: ClinicId, callId: string): WelcomeCall {
  const wc = ALL_WELCOME_CALLS.find(
    (c) => c.clinic_id === clinic_id && c.id === callId,
  );
  if (!wc) throw new APIError('404', `Welcome call ${callId} not found`);
  return wc;
}

function nextAttemptId(wc: WelcomeCall): string {
  return `att-${wc.id.toLowerCase()}-${wc.attempts.length + 1}`;
}

const ATTEMPT_BODY: Record<WelcomeCallAttemptType, string> = {
  success:   'Connected with patient. Welcome call completed.',
  no_answer: 'No answer.',
  voicemail: 'Left voicemail message.',
};

const ATTEMPT_DEFAULT_DURATION: Record<WelcomeCallAttemptType, string> = {
  success:   '5 min',
  no_answer: '0:30',
  voicemail: '0:45',
};

export type LogWelcomeCallAttemptInput = {
  type: WelcomeCallAttemptType;
  duration_display?: string;
  notes?: string;
  channel?: string;
  flag?: {
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    reason: string;
  };
};

export async function logWelcomeCallAttempt(
  clinic_id: ClinicId,
  callId: string,
  input: LogWelcomeCallAttemptInput,
): Promise<WelcomeCall> {
  await delay(200);
  const wc = findWelcomeCall(clinic_id, callId);
  if (wc.status === 'completed' || wc.status === 'unreachable') {
    throw new APIError(
      'INVALID_STATE',
      `Cannot log attempt: call is already ${wc.status}.`,
    );
  }
  const attempt: WelcomeCallAttempt = {
    id: nextAttemptId(wc),
    type: input.type,
    timestamp: NOW,
    by_user_id: CURRENT_USER.id,
    duration_display:
      input.duration_display?.trim() || ATTEMPT_DEFAULT_DURATION[input.type],
    channel: input.channel ?? 'Intercom telephone',
    body: ATTEMPT_BODY[input.type],
    notes: input.notes?.trim() || undefined,
  };
  wc.attempts = [...wc.attempts, attempt];
  if (input.type === 'success') {
    wc.status = 'completed';
    const flagReason = input.flag?.reason.trim();
    const flag = input.flag && flagReason
      ? {
          flag_id: 'FLAG-004',
          flag_name: 'Welcome call — clinical concern raised',
          severity: input.flag.severity,
          reason: flagReason,
          raised_by_user_id: CURRENT_USER.id,
        }
      : undefined;
    wc.outcome = {
      outcome_summary: flag ? 'Completed — clinical concern noted' : 'Completed',
      follow_up_needed: Boolean(flag),
      ...(input.notes?.trim() ? { follow_up_note: input.notes.trim() } : {}),
      ...(flag ? { flag_raised_text: `Yes (FLAG-004 v1 · ${flag.severity.toLowerCase()} severity)` } : {}),
    };
    if (flag) {
      wc.flag_raised = flag;
    }
  } else {
    wc.status = 'attempted';
  }
  wc.updated_at = NOW;
  console.log('[AUDIT]', {
    event_type: 'welcome_call_attempt_logged',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    clinic_id,
    welcome_call_id: callId,
    attempt_type: input.type,
    new_status: wc.status,
    timestamp: NOW,
  });
  if (input.type === 'success' && wc.flag_raised && input.flag) {
    console.log('[AUDIT]', {
      event_type: 'welcome_call_flag_raised',
      outcome: 'success',
      actor_id: CURRENT_USER.id,
      clinic_id,
      welcome_call_id: callId,
      flag_id: wc.flag_raised.flag_id,
      severity: wc.flag_raised.severity,
      reason: wc.flag_raised.reason,
      timestamp: NOW,
    });
  }
  return wc;
}

export async function markWelcomeCallUnreachable(
  clinic_id: ClinicId,
  callId: string,
  reason: string,
): Promise<WelcomeCall> {
  await delay(200);
  const wc = findWelcomeCall(clinic_id, callId);
  if (wc.status === 'unreachable') return wc;
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new APIError('VALIDATION', 'A reason is required to mark unreachable.');
  }
  wc.status = 'unreachable';
  wc.outcome = {
    outcome_summary: `Unreachable — ${wc.attempts.length} attempt${wc.attempts.length === 1 ? '' : 's'}`,
    follow_up_needed: true,
    follow_up_note: trimmed,
  };
  wc.updated_at = NOW;
  console.log('[AUDIT]', {
    event_type: 'welcome_call_marked_unreachable',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    clinic_id,
    welcome_call_id: callId,
    reason: trimmed,
    timestamp: NOW,
  });
  return wc;
}

export type EditWelcomeCallAttemptInput = {
  notes?: string;
  duration_display?: string;
};

export async function editWelcomeCallAttempt(
  clinic_id: ClinicId,
  callId: string,
  attemptId: string,
  input: EditWelcomeCallAttemptInput,
): Promise<WelcomeCall> {
  await delay(150);
  const wc = findWelcomeCall(clinic_id, callId);
  const attempt = wc.attempts.find((a) => a.id === attemptId);
  if (!attempt) {
    throw new APIError('404', `Attempt ${attemptId} not found on ${callId}.`);
  }
  const trimmedDuration = input.duration_display?.trim();
  const trimmedNotes = input.notes?.trim();
  if (trimmedDuration !== undefined && trimmedDuration.length > 0) {
    attempt.duration_display = trimmedDuration;
  }
  attempt.notes = trimmedNotes && trimmedNotes.length > 0 ? trimmedNotes : undefined;
  wc.updated_at = NOW;
  console.log('[AUDIT]', {
    event_type: 'welcome_call_attempt_edited',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    clinic_id,
    welcome_call_id: callId,
    attempt_id: attemptId,
    timestamp: NOW,
  });
  return wc;
}

export async function addWelcomeCallNote(
  clinic_id: ClinicId,
  callId: string,
  body: string,
): Promise<WelcomeCall> {
  await delay(150);
  const wc = findWelcomeCall(clinic_id, callId);
  const trimmed = body.trim();
  if (!trimmed) {
    throw new APIError('VALIDATION', 'A note body is required.');
  }
  if (!wc.outcome) {
    throw new APIError(
      'INVALID_STATE',
      'Cannot add a note to a call that has no recorded outcome.',
    );
  }
  const note = {
    id: `wcn-${wc.id.toLowerCase()}-${(wc.outcome.additional_notes?.length ?? 0) + 1}`,
    body: trimmed,
    by_user_id: CURRENT_USER.id,
    timestamp: NOW,
  };
  wc.outcome = {
    ...wc.outcome,
    additional_notes: [...(wc.outcome.additional_notes ?? []), note],
  };
  wc.updated_at = NOW;
  console.log('[AUDIT]', {
    event_type: 'welcome_call_note_added',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    clinic_id,
    welcome_call_id: callId,
    note_id: note.id,
    timestamp: NOW,
  });
  return wc;
}

export async function reopenWelcomeCall(
  clinic_id: ClinicId,
  callId: string,
): Promise<WelcomeCall> {
  await delay(200);
  const wc = findWelcomeCall(clinic_id, callId);
  if (wc.status !== 'completed' && wc.status !== 'unreachable') {
    throw new APIError(
      'INVALID_STATE',
      'Only completed or unreachable calls can be reopened.',
    );
  }
  // Per Task-157 acceptance: Reopen always returns the call to 'attempted',
  // even if it was closed as unreachable with zero attempts logged.
  wc.status = 'attempted';
  wc.outcome = undefined;
  wc.updated_at = NOW;
  console.log('[AUDIT]', {
    event_type: 'welcome_call_reopened',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    clinic_id,
    welcome_call_id: callId,
    new_status: wc.status,
    timestamp: NOW,
  });
  return wc;
}
