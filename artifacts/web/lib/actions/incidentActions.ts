'use server';

/**
 * Incident server actions — Task-194 / Task-293.
 *
 * Wraps lib/api/fixtures/incidents.ts mutations so the real signed-in user is
 * resolved server-side via `requireServerActionUser()` and threaded through as
 * the `actor` parameter. Anonymous callers are rejected with
 * UnauthenticatedActionError.
 *
 * Task-293: per-action role/capability gate runs before the fixture.
 *   - General incident triage (comment, status, CQC notify, Monday sync) is
 *     limited to Owner/Admin/Prescriber (Coach is read-only per BLD-2.1).
 *   - Yellow Card actions are limited to Owner/Prescriber — the MHRA filing
 *     is a clinical decision and must not be raised by a non-clinician.
 *   - Rejected callers get a uniform PermissionDeniedError plus a
 *     `<event>_blocked` audit line.
 */

import {
  requireServerActionUser,
  requireAnyRole,
} from '@/lib/auth/session';
import {
  addIncidentComment,
  updateIncidentStatus,
  submitYellowCard,
  recordYellowCardDecision,
  notifyCQC,
  syncIncidentFromMonday,
} from '@/lib/api/mock';
import type { ClinicId, Incident, IncidentComment } from '@/lib/api/types';

const INCIDENT_WRITER_ROLES = ['Owner', 'RM', 'Admin', 'Prescriber'] as const;
const YELLOW_CARD_ROLES = ['Owner', 'RM', 'Prescriber'] as const;

type YellowCardDecision = Parameters<typeof recordYellowCardDecision>[2];

export async function addIncidentCommentAction(
  clinicId: ClinicId,
  incidentId: string,
  body: string,
): Promise<IncidentComment> {
  const actor = await requireServerActionUser();
  requireAnyRole(actor, INCIDENT_WRITER_ROLES, 'incident_comment');
  return addIncidentComment(clinicId, incidentId, body, actor);
}

export async function updateIncidentStatusAction(
  clinicId: ClinicId,
  incidentId: string,
  status: Incident['status'],
  resolutionNotes?: string,
): Promise<Incident> {
  const actor = await requireServerActionUser();
  requireAnyRole(actor, INCIDENT_WRITER_ROLES, 'incident_status_update');
  return updateIncidentStatus(clinicId, incidentId, status, resolutionNotes, actor);
}

export async function submitYellowCardAction(
  clinicId: ClinicId,
  incidentId: string,
): Promise<Incident> {
  const actor = await requireServerActionUser();
  requireAnyRole(actor, YELLOW_CARD_ROLES, 'yellow_card_submit');
  return submitYellowCard(clinicId, incidentId, actor);
}

export async function recordYellowCardDecisionAction(
  clinicId: ClinicId,
  incidentId: string,
  decision: YellowCardDecision,
  reference?: string,
): Promise<Incident> {
  const actor = await requireServerActionUser();
  requireAnyRole(actor, YELLOW_CARD_ROLES, 'yellow_card_decision');
  return recordYellowCardDecision(clinicId, incidentId, decision, reference, actor);
}

export async function notifyCQCAction(
  clinicId: ClinicId,
  incidentId: string,
): Promise<Incident> {
  const actor = await requireServerActionUser();
  requireAnyRole(actor, INCIDENT_WRITER_ROLES, 'incident_notify_cqc');
  return notifyCQC(clinicId, incidentId, actor);
}

export async function syncIncidentFromMondayAction(
  clinicId: ClinicId,
  incidentId: string,
): Promise<Incident> {
  const actor = await requireServerActionUser();
  requireAnyRole(actor, INCIDENT_WRITER_ROLES, 'incident_sync_monday');
  return syncIncidentFromMonday(clinicId, incidentId, actor);
}
