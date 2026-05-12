/**
 * Livera Mock API — barrel re-export.
 *
 * Wave 1 additions:
 *   fixtures/users.ts  — team members + assignOwnerRole (BLD-1.6)
 *
 * This file is a pure barrel so that every existing import path
 * (e.g. `from "@/lib/api/mock"`) continues to work without change.
 *
 * When Yohan's backend is ready, swap implementations in the fixture files;
 * import paths in components stay unchanged.
 *
 * Sub-modules:
 *   types.ts            — all entity type definitions (API contract, §6.1)
 *   constants.ts        — NOW, CURRENT_USER, USERS_REGISTRY, delay, APIError, scopedToClinic
 *   monday.ts           — MOCK_MONDAY_BOARDS, mondayRead, mondayWrite
 *   fixtures/
 *     clinics.ts        — MOCK_CLINICS, getClinic, listClinics, getClinicSync
 *     users.ts          — MOCK_TEAM_MEMBERS, listTeamMembers, getTeamMember, assignOwnerRole
 *     patients.ts       — MOCK_PATIENTS, listPatients, getPatient
 *     orders.ts         — MOCK_ORDERS, listOrders, getOrder, decideOrder, getClinicalCheckQueue
 *     amendments.ts     — MOCK_AMENDMENTS, listAmendments, getAmendment, decideAmendment
 *     consultations.ts  — MOCK_CONSULTATIONS, listConsultations, getConsultation
 *     coaching.ts       — MOCK_COACHING_LOGS, listCoachingLogs, addCoachingLog
 *     gpLetters.ts      — MOCK_GP_LETTERS, MOCK_GP_LETTER_TEMPLATES, all GP letter endpoints
 *     complaints.ts       — MOCK_COMPLAINTS, all complaint endpoints
 *     incidents.ts        — MOCK_INCIDENTS, all incident endpoints
 *     clinicalNotes.ts    — MOCK_CLINICAL_NOTES, listClinicalNotes, getClinicalNote, createClinicalNote, updateClinicalNote  (BLD-4.1, 4.2, 4.5)
 *     slaBreaches.ts      — MOCK_SLA_BREACHES, listSlaBreaches, acknowledgeSlaBreachRecord  (BLD-3.2, 3.3)
 */

export * from './types';
export * from './constants';
export * from './monday';
export * from './fixtures/clinics';
export * from './fixtures/users';
export * from './fixtures/patients';
export * from './fixtures/orders';
export * from './fixtures/amendments';
export * from './fixtures/consultations';
export * from './fixtures/coaching';
export * from './fixtures/clinicalEscalationFlags';
export * from './fixtures/gpLetters';
export * from './fixtures/complaints';
export * from './fixtures/incidents';
export * from './fixtures/clinicalNotes';
export * from './fixtures/slaBreaches';
