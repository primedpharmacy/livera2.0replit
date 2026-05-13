/**
 * Livera Welcome Calls fixture — BLD-13.3.
 *
 * NOW = '2026-05-11T08:00:00Z'
 * Three canonical records covering the full status lifecycle:
 *   WC-0053: Michelle Clarke — completed (1 attempt, flag raised)
 *   WC-0058: Sarah Chen     — awaiting (no attempts yet, 53h since trigger)
 *   WC-0047: Beth Newman    — unreachable (3 attempts, escalation due)
 */

import type { WelcomeCall, ClinicId } from '../types';
import { APIError, delay, scopedToClinic } from '../constants';

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
