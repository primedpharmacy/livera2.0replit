/**
 * Livera consultation fixtures — extracted from mock.ts (Mini-wave 6a cleanup).
 * Contains: MOCK_CONSULTATIONS, listConsultations, getConsultation.
 * DEC-40: unified consultation model, recording/transcription always disabled.
 */

import type { ClinicId, Consultation } from '../types';
import { delay, APIError, scopedToClinic, CURRENT_USER } from '../constants';

export const MOCK_CONSULTATIONS: Consultation[] = [
  // ─── FeelTru consultations ────────────────────────────────────────────────
  {
    id: 'CON-F001',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',        // Sarah Cookland
    clinician_id: 'user_claire',
    consultation_type: 'clinical_consult',
    modality: 'video',
    scheduled_start: '2026-05-12T09:00:00Z',
    scheduled_end:   '2026-05-12T09:45:00Z',
    actual_start: null,
    actual_end: null,
    status: 'scheduled',
    provider: 'calendly+google_meet',
    provider_event_id: 'evt_8a3f72e1',
    join_url_clinician: 'https://meet.google.com/abc-defg-hij',
    join_url_patient:   'https://meet.google.com/abc-defg-hij',
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: null,
    linked_order_id: 'ORD-00441',
  },
  {
    id: 'CON-F002',
    clinic_id: 'feeltru',
    patient_id: 'PT-00378',        // Zara Ahmed
    clinician_id: 'user_admin',
    consultation_type: 'welcome_call',
    modality: 'phone',
    scheduled_start: '2026-05-11T10:00:00Z',
    scheduled_end:   '2026-05-11T10:30:00Z',
    actual_start: null,
    actual_end: null,
    status: 'scheduled',
    provider: 'intercom_phone',
    provider_event_id: null,
    join_url_clinician: null,
    join_url_patient: null,
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: null,
    linked_order_id: null,
  },
  {
    id: 'CON-F003',
    clinic_id: 'feeltru',
    patient_id: 'PT-00412',        // Emma Whitfield
    clinician_id: 'user_olwyn',
    consultation_type: 'coaching',
    modality: 'video',
    scheduled_start: '2026-05-11T14:00:00Z',
    scheduled_end:   '2026-05-11T14:30:00Z',
    actual_start: null,
    actual_end: null,
    status: 'scheduled',
    provider: 'calendly+google_meet',
    provider_event_id: 'evt_coaching_f003',
    join_url_clinician: 'https://meet.google.com/xyz-pqrs-tuv',
    join_url_patient:   'https://meet.google.com/xyz-pqrs-tuv',
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: null,
    linked_order_id: null,
  },
  {
    id: 'CON-F004',
    clinic_id: 'feeltru',
    patient_id: 'PT-00445',        // Fiona MacLeod
    clinician_id: 'user_olwyn',
    consultation_type: 'coaching',
    modality: 'video',
    scheduled_start: '2026-05-13T11:00:00Z',
    scheduled_end:   '2026-05-13T11:30:00Z',
    actual_start: null,
    actual_end: null,
    status: 'scheduled',
    provider: 'calendly+google_meet',
    provider_event_id: 'evt_coaching_f004',
    join_url_clinician: 'https://meet.google.com/mno-qrst-uvw',
    join_url_patient:   'https://meet.google.com/mno-qrst-uvw',
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: null,
    linked_order_id: null,
  },
  {
    id: 'CON-F005',
    clinic_id: 'feeltru',
    patient_id: 'PT-00412',        // Emma Whitfield — past completed
    clinician_id: 'user_olwyn',
    consultation_type: 'coaching',
    modality: 'video',
    scheduled_start: '2026-04-28T11:00:00Z',
    scheduled_end:   '2026-04-28T11:30:00Z',
    actual_start: '2026-04-28T11:02:00Z',
    actual_end:   '2026-04-28T11:32:00Z',
    status: 'completed',
    provider: 'calendly+google_meet',
    provider_event_id: 'evt_coaching_f005',
    join_url_clinician: null,
    join_url_patient: null,
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: 'note_f005',
    linked_order_id: null,
  },
  {
    id: 'CON-F006',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',        // Sarah Cookland — past completed
    clinician_id: 'user_olwyn',
    consultation_type: 'coaching',
    modality: 'video',
    scheduled_start: '2026-04-28T14:00:00Z',
    scheduled_end:   '2026-04-28T14:30:00Z',
    actual_start: '2026-04-28T14:01:00Z',
    actual_end:   '2026-04-28T14:31:00Z',
    status: 'completed',
    provider: 'calendly+google_meet',
    provider_event_id: 'evt_coaching_f006',
    join_url_clinician: null,
    join_url_patient: null,
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: 'note_f006',
    linked_order_id: null,
  },
  // ─── VSC consultations ────────────────────────────────────────────────────
  {
    id: 'CON-V001',
    clinic_id: 'vsc',
    patient_id: 'PT-00089',        // Tom Fletcher
    clinician_id: 'user_admin',
    consultation_type: 'welcome_call',
    modality: 'phone',
    scheduled_start: '2026-05-11T11:00:00Z',
    scheduled_end:   '2026-05-11T11:30:00Z',
    actual_start: null,
    actual_end: null,
    status: 'scheduled',
    provider: 'intercom_phone',
    provider_event_id: null,
    join_url_clinician: null,
    join_url_patient: null,
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: null,
    linked_order_id: null,
  },
  {
    id: 'CON-V002',
    clinic_id: 'vsc',
    patient_id: 'PT-00234',        // James Hartley
    clinician_id: 'user_claire',
    consultation_type: 'follow_up',
    modality: 'video',
    scheduled_start: '2026-05-14T10:00:00Z',
    scheduled_end:   '2026-05-14T10:45:00Z',
    actual_start: null,
    actual_end: null,
    status: 'scheduled',
    provider: 'calendly+google_meet',
    provider_event_id: 'evt_followup_v002',
    join_url_clinician: 'https://meet.google.com/def-ghij-klm',
    join_url_patient:   'https://meet.google.com/def-ghij-klm',
    recording_enabled: false,
    transcription_enabled: false,
    clinical_note_id: null,
    linked_order_id: 'ORD-00438',
  },
];

export async function listConsultations(
  clinic_id: ClinicId,
  opts?: { from?: string; to?: string; clinician_id?: string; type?: Consultation['consultation_type'] }
): Promise<Consultation[]> {
  await delay();
  let results = scopedToClinic(MOCK_CONSULTATIONS, clinic_id);
  if (opts?.from) results = results.filter((c) => c.scheduled_start >= opts.from!);
  if (opts?.to) results = results.filter((c) => c.scheduled_start <= opts.to!);
  if (opts?.clinician_id) results = results.filter((c) => c.clinician_id === opts.clinician_id);
  if (opts?.type) results = results.filter((c) => c.consultation_type === opts.type);
  return results;
}

export async function getConsultation(clinic_id: ClinicId, id: string): Promise<Consultation> {
  await delay();
  const c = MOCK_CONSULTATIONS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', 'Consultation not found');
  return c;
}

// ── BLD-CONS-DETAIL-01 — updateConsultationStatus ─────────────────────────────
// Advances the consultation through its 4-phase lifecycle.
// Writes AUD-04 audit trail entry on every status transition.
export async function updateConsultationStatus(
  clinic_id: ClinicId,
  consultation_id: string,
  status: Consultation['status'],
  actor = CURRENT_USER
): Promise<Consultation> {
  await delay(400);

  const idx = MOCK_CONSULTATIONS.findIndex(
    (c) => c.clinic_id === clinic_id && c.id === consultation_id
  );
  if (idx === -1) throw new APIError('NOT_FOUND', `Consultation ${consultation_id} not found`);

  const now           = new Date().toISOString();
  const previousStatus = MOCK_CONSULTATIONS[idx].status;   // capture BEFORE mutation
  const updated        = { ...MOCK_CONSULTATIONS[idx] };

  updated.status = status;

  if (status === 'in_progress' && !updated.actual_start) {
    updated.actual_start = now;
  }
  if (
    (status === 'completed' || status === 'no_show' || status === 'cancelled') &&
    !updated.actual_end
  ) {
    updated.actual_end = now;
  }

  MOCK_CONSULTATIONS[idx] = updated;

  console.log('[AUDIT] AUD-04', {
    event_type: 'consultation_status_changed',
    outcome: 'success',
    consultation_id,
    clinic_id,
    actor_id: actor.id,
    previous_status: previousStatus,
    new_status: status,
    timestamp: now,
    legal_basis: 'UK GDPR Art 9(2)(h) — health care and treatment (DEC-40)',
  });

  return updated;
}
