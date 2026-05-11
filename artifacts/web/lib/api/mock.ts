/**
 * Livera Mock API — barrel re-export.
 *
 * Mini-wave 6a: split into modular files under lib/api/. This file is now a
 * pure barrel so that every existing import path (e.g. `from "@/lib/api/mock"`)
 * continues to work without change.
 *
 * When Yohan's backend is ready, swap implementations in the fixture files;
 * import paths in components stay unchanged.
 *
 * Sub-modules:
 *   types.ts          — all entity type definitions (API contract)
 *   constants.ts      — NOW, CURRENT_USER, delay, APIError, scopedToClinic
 *   monday.ts         — MOCK_MONDAY_BOARDS, mondayRead, mondayWrite
 *   fixtures/
 *     clinics.ts      — MOCK_CLINICS, getClinic, listClinics, getClinicSync
 *     patients.ts     — MOCK_PATIENTS, listPatients, getPatient
 *     orders.ts       — MOCK_ORDERS, listOrders, getOrder, decideOrder, getClinicalCheckQueue
 *     amendments.ts   — MOCK_AMENDMENTS, listAmendments, getAmendment, decideAmendment
 *     consultations.ts— MOCK_CONSULTATIONS, listConsultations, getConsultation
 *     coaching.ts     — MOCK_COACHING_LOGS, listCoachingLogs, addCoachingLog
 *     gpLetters.ts    — MOCK_GP_LETTERS, MOCK_GP_LETTER_TEMPLATES, all GP letter endpoints
 *     complaints.ts   — MOCK_COMPLAINTS, all complaint endpoints
 *     incidents.ts    — MOCK_INCIDENTS, all incident endpoints
 */

export * from './types';
export * from './constants';
export * from './monday';
export * from './fixtures/clinics';
export * from './fixtures/patients';
export * from './fixtures/orders';
export * from './fixtures/amendments';
export * from './fixtures/consultations';
export * from './fixtures/coaching';
export * from './fixtures/gpLetters';
export * from './fixtures/complaints';
export * from './fixtures/incidents';
