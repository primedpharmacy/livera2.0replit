/**
 * Livera incident fixtures — extracted from mock.ts (Mini-wave 6a cleanup).
 * DEC-29: VSC + FeelTru incidents share Monday board 18402056019 (known anomaly).
 * Contains: MOCK_INCIDENTS, listIncidents, getIncident, updateIncidentStatus,
 *           submitYellowCard, notifyCQC, syncIncidentFromMonday.
 */

import type { ClinicId, Incident, IncidentOrigin, IncidentType, IncidentSeverity, User } from '../types';
import { delay, APIError, scopedToClinic, CURRENT_USER, SYSTEM_USER, NOW } from '../constants';
import { mondayWrite, mondayRead } from '../monday';
import { can } from '@/lib/permissions';
import { allowIntercomClosure } from '@/lib/integrations/intercom';
import { MOCK_PATIENTS } from './patients';

export const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'INC-001',
    clinic_id: 'feeltru',
    patient_id: 'PT-00378',
    order_id: 'ORD-00449',
    consultation_id: null,
    incident_type: 'delayed_dispensing',
    severity: 'mild',
    description: "Patient's Mounjaro 2.5mg order ORD-00449 delayed beyond expected dispatch window due to pharmacy stock issue. Patient informed via SMS. No clinical harm identified.",
    status: 'open',
    triggered_by: 'system',
    reported_at: '2026-05-08T09:15:00Z',
    monday_board_id: '18402056019',
    monday_item_id: 'mbi_001',
    yellow_card_required: false,
    yellow_card_submitted: false,
    yellow_card_reference: null,
    cqc_notification_required: false,
    cqc_notified_at: null,
    escalated_to_user_id: null,
    resolution_notes: null,
    sync_status: 'in_sync',
    created_at: '2026-05-08T09:15:00Z',
    intercom_thread_url: null,
    incident_origin: 'manual',
  },
  {
    id: 'INC-002',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',
    order_id: 'ORD-00441',
    consultation_id: null,
    incident_type: 'adverse_event',
    severity: 'severe',
    description: 'Patient reported severe nausea and vomiting requiring A&E attendance following Mounjaro 7.5mg dose. Possible adverse drug reaction. MHRA Yellow Card required. CQC notification under Regulation 18 to be assessed.',
    status: 'open',
    triggered_by: 'patient_report',
    reported_at: '2026-05-09T11:30:00Z',
    monday_board_id: '18402056019',
    monday_item_id: 'mbi_002',
    yellow_card_required: true,
    yellow_card_submitted: false,
    yellow_card_reference: null,
    cqc_notification_required: true,
    cqc_notified_at: null,
    escalated_to_user_id: 'user_qadir',
    resolution_notes: null,
    sync_status: 'in_sync',
    created_at: '2026-05-09T11:30:00Z',
    intercom_thread_url: null,
    incident_origin: 'manual',
  },
  {
    id: 'INC-003',
    clinic_id: 'vsc',
    patient_id: 'PT-00234',
    order_id: 'ORD-00438',
    consultation_id: null,
    incident_type: 'medication_error',
    severity: 'moderate',
    description: 'Incorrect dose (10mg instead of 5mg) recorded on dispensing label for order ORD-00438. Error caught before dispatch. No patient harm. Dispensing process review required.',
    status: 'investigating',
    triggered_by: 'clinician',
    reported_at: '2026-05-07T14:00:00Z',
    monday_board_id: '18402056019',
    monday_item_id: 'mbi_003',
    yellow_card_required: false,
    yellow_card_submitted: false,
    yellow_card_reference: null,
    cqc_notification_required: false,
    cqc_notified_at: null,
    escalated_to_user_id: null,
    resolution_notes: null,
    sync_status: 'out_of_sync',
    created_at: '2026-05-07T14:00:00Z',
    intercom_thread_url: null,
    incident_origin: 'manual',
  },
  {
    id: 'INC-004',
    clinic_id: 'feeltru',
    patient_id: 'PT-00412',
    order_id: null,
    consultation_id: 'CON-F005',
    incident_type: 'near_miss',
    severity: 'mild',
    description: 'Prescriber almost prescribed Wegovy at incorrect dose (1.7mg vs 1.0mg) during consultation review. Error caught during pre-approval check. No patient harm.',
    status: 'resolved',
    triggered_by: 'admin',
    reported_at: '2026-04-20T10:00:00Z',
    monday_board_id: '18402056019',
    monday_item_id: 'mbi_004',
    yellow_card_required: false,
    yellow_card_submitted: false,
    yellow_card_reference: null,
    cqc_notification_required: false,
    cqc_notified_at: null,
    escalated_to_user_id: null,
    resolution_notes: 'Near miss captured and reviewed. Prescriber briefed. Pre-approval check process reinforced across clinical team.',
    sync_status: 'in_sync',
    created_at: '2026-04-20T10:00:00Z',
    intercom_thread_url: null,
    incident_origin: 'manual',
  },
  {
    id: 'INC-005',
    clinic_id: 'vsc',
    patient_id: 'PT-00301',
    order_id: null,
    consultation_id: null,
    incident_type: 'allergic_reaction',
    severity: 'severe',
    description: 'Patient reported severe allergic reaction (urticaria, facial swelling) after first Mounjaro 2.5mg dose. Advised to attend A&E. Yellow Card submitted to MHRA.',
    status: 'on_hold',
    triggered_by: 'patient_report',
    reported_at: '2026-05-01T08:00:00Z',
    monday_board_id: '18402056019',
    monday_item_id: 'mbi_005',
    yellow_card_required: true,
    yellow_card_submitted: true,
    yellow_card_reference: 'MHRA-2026-005891',
    cqc_notification_required: false,
    cqc_notified_at: null,
    escalated_to_user_id: 'user_qadir',
    resolution_notes: null,
    sync_status: 'in_sync',
    created_at: '2026-05-01T08:00:00Z',
    intercom_thread_url: null,
    incident_origin: 'manual',
  },
];

export async function listIncidents(
  clinic_id: ClinicId,
  opts?: { status?: Incident['status']; severity?: Incident['severity']; incident_type?: Incident['incident_type'] }
): Promise<Incident[]> {
  await delay();
  let results = scopedToClinic(MOCK_INCIDENTS, clinic_id);
  if (opts?.status) results = results.filter((i) => i.status === opts.status);
  if (opts?.severity) results = results.filter((i) => i.severity === opts.severity);
  if (opts?.incident_type) results = results.filter((i) => i.incident_type === opts.incident_type);
  return results;
}

export async function getIncident(clinic_id: ClinicId, id: string): Promise<Incident> {
  await delay();
  const i = MOCK_INCIDENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!i) throw new APIError('NOT_FOUND', 'Incident not found');
  return i;
}

export async function updateIncidentStatus(
  clinic_id: ClinicId,
  id: string,
  status: Incident['status'],
  resolution_notes?: string
): Promise<Incident> {
  await delay(300);
  const i = MOCK_INCIDENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!i) throw new APIError('NOT_FOUND', 'Incident not found');

  const prevStatus = i.status;
  i.status = status;
  if (resolution_notes !== undefined) i.resolution_notes = resolution_notes;
  if (i.monday_item_id) {
    await mondayWrite(i.monday_board_id, 'update', { id: i.monday_item_id, column_values: { status } });
    i.sync_status = 'in_sync';
  }

  // BLD-8.4 closure-allow hook — fires when incident transitions to terminal status
  // AND the incident has an associated Intercom thread.
  // Stub mode: logs [INTERCOM_CLOSURE_ALLOWED] via allowIntercomClosure.
  // Live mode: calls Intercom API to release closure block (deferred to V1.2).
  const TERMINAL_STATUSES: Incident['status'][] = ['resolved', 'closed'];
  const wasTerminal = TERMINAL_STATUSES.includes(prevStatus);
  const isNowTerminal = TERMINAL_STATUSES.includes(status);
  if (isNowTerminal && !wasTerminal && i.intercom_thread_url) {
    // Extract conversation_id from the stored thread URL (last path segment)
    const convId = i.intercom_thread_url.split('/').pop() ?? 'unknown';
    await allowIntercomClosure(convId, id, status);
    console.log('[AUDIT]', {
      event_type: 'intercom_closure_released',
      conversation_id: convId,
      incident_id: id,
      new_status: status,
      timestamp: NOW,
    });
  }

  console.log('[AUDIT]', {
    event_type: 'incident_status_updated',
    incident_id: id,
    prev_status: prevStatus,
    new_status: status,
    clinic_id,
    actor_id: CURRENT_USER.id,
    timestamp: NOW,
  });
  return i;
}

export async function submitYellowCard(clinic_id: ClinicId, id: string): Promise<Incident> {
  await delay(600);
  const i = MOCK_INCIDENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!i) throw new APIError('NOT_FOUND', 'Incident not found');
  if (i.yellow_card_submitted) throw new APIError('ALREADY_SUBMITTED', 'Yellow Card already submitted for this incident');
  i.yellow_card_submitted = true;
  i.yellow_card_reference = `MHRA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(6, '0')}`;
  console.log('[AUDIT]', { action: 'yellow_card.submitted', incident_id: id, reference: i.yellow_card_reference, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return i;
}

export async function notifyCQC(clinic_id: ClinicId, id: string): Promise<Incident> {
  await delay(400);
  const i = MOCK_INCIDENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!i) throw new APIError('NOT_FOUND', 'Incident not found');
  if (i.cqc_notified_at) throw new APIError('ALREADY_NOTIFIED', 'CQC has already been notified for this incident');
  i.cqc_notified_at = new Date().toISOString();
  console.log('[AUDIT]', { action: 'cqc.notified', incident_id: id, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return i;
}

// ── createIncident — BLD-8.3 (Wave 6) ────────────────────────────────────────
// Primary caller: app/api/webhooks/intercom/route.ts with actor=SYSTEM_USER
//   (origin='intercom_tag', intercom_thread_url set)
// Future callers may create incidents manually (origin='manual', actor=CURRENT_USER).
//
// Layer 1 (UI gate): n/a for webhook-driven path — no Livera UI calls this in V1.1
// Layer 2 (server gate): can() check on 'incidents' resource
// Layer 3 (audit): [AUDIT] 'incident_created' with origin, source_url, resolved_patient_id
export async function createIncident(
  patient_id: string,
  origin: IncidentOrigin,
  body: string,
  options?: {
    intercom_thread_url?: string;
    clinic_id?: string;
    incident_type?: IncidentType;
    severity?: IncidentSeverity;
  },
  actor: User = CURRENT_USER
): Promise<Incident> {
  await delay(300);

  // Layer 2 — server gate (SYSTEM_USER has write:incidents per permissions.ts BLD-8.3 case)
  if (!can(actor, 'write', 'incidents')) {
    throw new APIError('PERMISSION_DENIED', `User ${actor.id} cannot write incidents`);
  }

  // Infer clinic_id from options or patient lookup (BLD-8.3 acceptance criterion 1)
  let clinic_id: ClinicId;
  if (options?.clinic_id) {
    clinic_id = options.clinic_id as ClinicId;
  } else {
    const patient = MOCK_PATIENTS.find((p) => p.id === patient_id);
    if (!patient) {
      throw new APIError(
        'NOT_FOUND',
        `Cannot infer clinic_id: patient ${patient_id} not found in MOCK_PATIENTS`
      );
    }
    clinic_id = patient.clinic_id;
  }

  const id = `INC-${String(MOCK_INCIDENTS.length + 1).padStart(3, '0')}`;

  // DEC-29: VSC + FeelTru incidents share board 18402056019 (known anomaly).
  // TODO V1.2: move to clinic.config.monday_incidents_board_id once DEC-29 resolved.
  const monday_board_id = '18402056019';

  const incident: Incident = {
    id,
    clinic_id,
    patient_id,
    order_id: null,
    consultation_id: null,
    // incident_type defaults to 'other' for Intercom-tagged incidents.
    // Clinical team classifies retrospectively in Monday.com until V1.2 auto-classification.
    incident_type: options?.incident_type ?? 'other',
    severity: options?.severity ?? 'mild',
    description: body,
    status: 'open',
    triggered_by: 'patient_report',  // Intercom = patient conversation
    reported_at: NOW,
    monday_board_id,
    monday_item_id: null,   // not yet synced to Monday
    yellow_card_required: false,
    yellow_card_submitted: false,
    yellow_card_reference: null,
    cqc_notification_required: false,
    cqc_notified_at: null,
    escalated_to_user_id: null,
    resolution_notes: null,
    sync_status: 'out_of_sync',  // reflects monday_item_id: null
    created_at: NOW,
    intercom_thread_url: options?.intercom_thread_url ?? null,
    incident_origin: origin,
  };

  MOCK_INCIDENTS.push(incident);

  // Layer 3 — audit
  console.log('[AUDIT]', {
    event_type: 'incident_created',
    outcome: 'success',
    actor_id: actor.id,
    clinic_id,
    incident_id: id,
    origin,
    source_url: options?.intercom_thread_url ?? null,
    resolved_patient_id: patient_id,
    timestamp: NOW,
  });

  return incident;
}

export async function syncIncidentFromMonday(clinic_id: ClinicId, id: string): Promise<Incident> {
  const i = MOCK_INCIDENTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!i) throw new APIError('NOT_FOUND', 'Incident not found');
  await mondayRead(i.monday_board_id);
  i.sync_status = 'in_sync';
  console.log('[AUDIT]', { action: 'incident.synced_from_monday', incident_id: id, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return i;
}
