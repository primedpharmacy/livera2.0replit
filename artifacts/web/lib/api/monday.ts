/**
 * Livera Monday.com mock proxy — BLD-9.0 (Wave 6).
 * DEC-37 (complaints source-of-truth), DEC-29 (incidents board anomaly).
 * All writes go Monday-first, then mirror to Livera state.
 *
 * Feature-flagged by LIVERA_MONDAY_LIVE env var (default: false).
 * When false: mock path using MOCK_MONDAY_BOARDS.
 * When true:  real Monday GraphQL API (stub — wiring deferred to V1.2).
 *
 * Every call emits [MONDAY READ] / [MONDAY WRITE] log.
 * Never inline Monday board IDs — always pass boardId as a parameter.
 *
 * lib/api/monday.ts  = THIS FILE — mock layer (mondayRead, mondayWrite, MOCK_MONDAY_BOARDS)
 * lib/integrations/monday.ts = Wave 3 writeSlaBreach stub — separate, untouched in Wave 6
 */

import type { MondayItem, MondayBoardState } from './types';
import { delay, NOW } from './constants';

const MONDAY_LIVE = process.env['LIVERA_MONDAY_LIVE'] === 'true';

// ── Etag counter — uses NOW stamp + incrementing sequence, never Date.now() ─
let mondayEtagCounter = 0;
function nextMondayEtag(): string {
  mondayEtagCounter += 1;
  const stamp = NOW.replace(/[^0-9]/g, '').slice(-10);
  return `etag-${stamp}-${String(mondayEtagCounter).padStart(4, '0')}`;
}

// ── Mock Monday board state — PV §7.3 (all 3 boards required) ────────────────
// TODO (DEC-29 anomaly): VSC incidents currently land on FeelTru workspace board 18402056019
export const MOCK_MONDAY_BOARDS: Record<string, MondayBoardState> = {
  '18402056019': {
    name: 'Severe SE incidents (shared)',
    workspace_id: '13529088', // FeelTru workspace — cross-workspace anomaly per DEC-29
    items: [
      { id: 'mbi_001', name: 'INC-001: Delayed dispensing – Zara Ahmed (FeelTru)', column_values: { status: 'open', severity: 'mild', incident_origin: 'manual' }, created_at: '2026-05-08T09:15:00Z', updated_at: '2026-05-08T09:15:00Z' },
      { id: 'mbi_002', name: 'INC-002: Severe adverse event – Sarah Cookland (FeelTru)', column_values: { status: 'open', severity: 'severe', incident_origin: 'manual' }, created_at: '2026-05-09T11:30:00Z', updated_at: '2026-05-09T11:30:00Z' },
      { id: 'mbi_003', name: 'INC-003: Medication error – James Hartley (VSC)', column_values: { status: 'investigating', severity: 'moderate', incident_origin: 'manual' }, created_at: '2026-05-07T14:00:00Z', updated_at: '2026-05-10T09:00:00Z' },
      { id: 'mbi_004', name: 'INC-004: Near miss – Emma Whitfield (FeelTru)', column_values: { status: 'resolved', severity: 'mild', incident_origin: 'manual' }, created_at: '2026-04-20T10:00:00Z', updated_at: '2026-04-25T14:00:00Z' },
      { id: 'mbi_005', name: 'INC-005: Allergic reaction – Priya Shah (VSC)', column_values: { status: 'on_hold', severity: 'severe', incident_origin: 'manual' }, created_at: '2026-05-01T08:00:00Z', updated_at: '2026-05-03T16:00:00Z' },
    ],
    etag: 'etag-init-incidents',
  },
  '18409111860': {
    name: 'VSC — Complaints Register',
    workspace_id: '8633778', // Across Projects workspace
    items: [
      { id: 'mbc_v001', name: 'CMP-004: Unreasonable delay – James Hartley', column_values: { status: 'investigating', severity: 'serious' }, created_at: '2026-04-28T10:00:00Z', updated_at: '2026-05-05T09:00:00Z' },
      { id: 'mbc_v002', name: 'CMP-005: Treatment review concerns', column_values: { status: 'closed', severity: 'formal' }, created_at: '2026-03-15T11:00:00Z', updated_at: '2026-04-10T14:00:00Z' },
    ],
    etag: 'etag-init-vsc-complaints',
  },
  '18402056040': {
    name: 'FeelTru Complaints & Feedback',
    workspace_id: '13529088', // FeelTru workspace
    items: [
      { id: 'mbc_f001', name: 'CMP-001: Side effect concerns – Fiona MacLeod', column_values: { status: 'received', severity: 'serious' }, created_at: '2026-05-09T15:00:00Z', updated_at: '2026-05-09T15:00:00Z' },
      { id: 'mbc_f002', name: 'CMP-002: Delayed response – Zara Ahmed', column_values: { status: 'acknowledged', severity: 'formal' }, created_at: '2026-05-02T10:00:00Z', updated_at: '2026-05-05T11:00:00Z' },
      { id: 'mbc_f003', name: 'CMP-003: Prescription delay (anon)', column_values: { status: 'resolved', severity: 'informal' }, created_at: '2026-04-15T09:00:00Z', updated_at: '2026-04-30T16:00:00Z' },
    ],
    etag: 'etag-init-feeltru-complaints',
  },
};

// ── mondayRead — returns board state from mock; emits [MONDAY READ] ──────────
export async function mondayRead(boardId: string): Promise<MondayBoardState> {
  if (MONDAY_LIVE) {
    throw new Error(
      '[MONDAY] LIVERA_MONDAY_LIVE=true — real Monday GraphQL API wiring deferred to V1.2. ' +
      `Attempted read on board ${boardId}.`
    );
  }
  await delay(150);
  const board = MOCK_MONDAY_BOARDS[boardId] ?? { name: '(unknown)', workspace_id: '', items: [], etag: 'empty' };
  console.log('[MONDAY READ]', { boardId, itemCount: board.items.length, etag: board.etag });
  return board;
}

// ── mondayWrite — creates or updates an item; emits [MONDAY WRITE] ───────────
export async function mondayWrite(
  boardId: string,
  op: 'create' | 'update',
  item: Partial<MondayItem> & { id: string }
): Promise<MondayBoardState> {
  if (MONDAY_LIVE) {
    throw new Error(
      '[MONDAY] LIVERA_MONDAY_LIVE=true — real Monday GraphQL API wiring deferred to V1.2. ' +
      `Attempted ${op} on board ${boardId}, item ${item.id}.`
    );
  }
  await delay(200);
  if (!MOCK_MONDAY_BOARDS[boardId]) {
    MOCK_MONDAY_BOARDS[boardId] = { name: '(dynamic)', workspace_id: '', items: [], etag: nextMondayEtag() };
  }
  const board = MOCK_MONDAY_BOARDS[boardId];
  if (op === 'create') {
    board.items.push({
      id: item.id,
      name: item.name ?? 'New item',
      column_values: item.column_values ?? {},
      created_at: NOW,
      updated_at: NOW,
    });
  } else {
    const existing = board.items.find((i) => i.id === item.id);
    if (existing) {
      existing.column_values = { ...existing.column_values, ...(item.column_values ?? {}) };
      existing.updated_at = NOW;
    }
  }
  board.etag = nextMondayEtag();
  console.log('[MONDAY WRITE]', { boardId, op, itemId: item.id, etag: board.etag });
  return board;
}
