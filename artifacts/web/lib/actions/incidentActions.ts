'use server';

/**
 * Incident server actions — Task-194.
 *
 * Wraps lib/api/fixtures/incidents.ts mutations so the real signed-in user is
 * resolved server-side via `requireServerActionUser()` and threaded through as
 * the `actor` parameter. Anonymous callers are rejected with
 * UnauthenticatedActionError.
 */

import { requireServerActionUser } from '@/lib/auth/session';
import {
  addIncidentComment,
  updateIncidentStatus,
  submitYellowCard,
  recordYellowCardDecision,
  notifyCQC,
  syncIncidentFromMonday,
} from '@/lib/api/mock';
import type { ClinicId, Incident, IncidentComment } from '@/lib/api/types';

type YellowCardDecision = Parameters<typeof recordYellowCardDecision>[2];

export async function addIncidentCommentAction(
  clinicId: ClinicId,
  incidentId: string,
  body: string,
): Promise<IncidentComment> {
  const actor = await requireServerActionUser();
  return addIncidentComment(clinicId, incidentId, body, actor);
}

export async function updateIncidentStatusAction(
  clinicId: ClinicId,
  incidentId: string,
  status: Incident['status'],
  resolutionNotes?: string,
): Promise<Incident> {
  const actor = await requireServerActionUser();
  return updateIncidentStatus(clinicId, incidentId, status, resolutionNotes, actor);
}

export async function submitYellowCardAction(
  clinicId: ClinicId,
  incidentId: string,
): Promise<Incident> {
  const actor = await requireServerActionUser();
  return submitYellowCard(clinicId, incidentId, actor);
}

export async function recordYellowCardDecisionAction(
  clinicId: ClinicId,
  incidentId: string,
  decision: YellowCardDecision,
  reference?: string,
): Promise<Incident> {
  const actor = await requireServerActionUser();
  return recordYellowCardDecision(clinicId, incidentId, decision, reference, actor);
}

export async function notifyCQCAction(
  clinicId: ClinicId,
  incidentId: string,
): Promise<Incident> {
  const actor = await requireServerActionUser();
  return notifyCQC(clinicId, incidentId, actor);
}

export async function syncIncidentFromMondayAction(
  clinicId: ClinicId,
  incidentId: string,
): Promise<Incident> {
  const actor = await requireServerActionUser();
  return syncIncidentFromMonday(clinicId, incidentId, actor);
}
