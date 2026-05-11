/**
 * Livera Monday.com mock proxy — extracted from mock.ts (Mini-wave 6a cleanup).
 * DEC-37 (complaints source-of-truth), DEC-29 (incidents board anomaly).
 * All writes go Monday-first, then mirror to Livera state.
 */

import type { MondayItem, MondayBoardState } from './types';
import { delay } from './constants';

// TODO (DEC-29 anomaly: VSC incidents currently land on FeelTru workspace board 18402056019)
export const MOCK_MONDAY_BOARDS: Record<string, MondayBoardState> = {
  '18402056019': {
    // Shared incidents board — both VSC and FeelTru write here (DEC-29 anomaly)
    items: [
      { id: 'mbi_001', name: 'INC-001: Delayed dispensing – Zara Ahmed (FeelTru)', column_values: { status: 'open', severity: 'mild' }, created_at: '2026-05-08T09:15:00Z', updated_at: '2026-05-08T09:15:00Z' },
      { id: 'mbi_002', name: 'INC-002: Severe adverse event – Sarah Cookland (FeelTru)', column_values: { status: 'open', severity: 'severe' }, created_at: '2026-05-09T11:30:00Z', updated_at: '2026-05-09T11:30:00Z' },
      { id: 'mbi_003', name: 'INC-003: Medication error – James Hartley (VSC)', column_values: { status: 'investigating', severity: 'moderate' }, created_at: '2026-05-07T14:00:00Z', updated_at: '2026-05-10T09:00:00Z' },
      { id: 'mbi_004', name: 'INC-004: Near miss – Emma Whitfield (FeelTru)', column_values: { status: 'resolved', severity: 'mild' }, created_at: '2026-04-20T10:00:00Z', updated_at: '2026-04-25T14:00:00Z' },
      { id: 'mbi_005', name: 'INC-005: Allergic reaction – Priya Shah (VSC)', column_values: { status: 'on_hold', severity: 'severe' }, created_at: '2026-05-01T08:00:00Z', updated_at: '2026-05-03T16:00:00Z' },
    ],
    etag: 'v1',
  },
  '18409111860': {
    // VSC complaints board (DEC-37)
    items: [
      { id: 'mbc_v001', name: 'CMP-004: Unreasonable delay – James Hartley', column_values: { status: 'investigating', severity: 'high' }, created_at: '2026-04-28T10:00:00Z', updated_at: '2026-05-05T09:00:00Z' },
      { id: 'mbc_v002', name: 'CMP-005: Treatment review concerns', column_values: { status: 'closed', severity: 'medium' }, created_at: '2026-03-15T11:00:00Z', updated_at: '2026-04-10T14:00:00Z' },
    ],
    etag: 'v1',
  },
  '18402056040': {
    // FeelTru complaints board (DEC-37)
    items: [
      { id: 'mbc_f001', name: 'CMP-001: Side effect concerns – Fiona MacLeod', column_values: { status: 'received', severity: 'high' }, created_at: '2026-05-09T15:00:00Z', updated_at: '2026-05-09T15:00:00Z' },
      { id: 'mbc_f002', name: 'CMP-002: Delayed response – Zara Ahmed', column_values: { status: 'acknowledged', severity: 'medium' }, created_at: '2026-05-02T10:00:00Z', updated_at: '2026-05-05T11:00:00Z' },
      { id: 'mbc_f003', name: 'CMP-003: Prescription delay (anon)', column_values: { status: 'resolved', severity: 'low' }, created_at: '2026-04-15T09:00:00Z', updated_at: '2026-04-30T16:00:00Z' },
    ],
    etag: 'v1',
  },
};

export async function mondayRead(boardId: string): Promise<MondayBoardState> {
  await delay(150);
  const board = MOCK_MONDAY_BOARDS[boardId] ?? { items: [], etag: 'empty' };
  console.log('[MONDAY READ]', { boardId, etag: board?.etag ?? '(missing)' });
  return board;
}

export async function mondayWrite(
  boardId: string,
  op: 'create' | 'update',
  item: Partial<MondayItem> & { id: string }
): Promise<MondayBoardState> {
  await delay(200);
  if (!MOCK_MONDAY_BOARDS[boardId]) {
    MOCK_MONDAY_BOARDS[boardId] = { items: [], etag: 'v1' };
  }
  const board = MOCK_MONDAY_BOARDS[boardId];
  if (op === 'create') {
    board.items.push({
      id: item.id,
      name: item.name ?? 'New item',
      column_values: item.column_values ?? {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else {
    const existing = board.items.find((i) => i.id === item.id);
    if (existing) {
      existing.column_values = { ...existing.column_values, ...(item.column_values ?? {}) };
      existing.updated_at = new Date().toISOString();
    }
  }
  board.etag = `v${Date.now()}`;
  console.log('[MONDAY WRITE]', { boardId, op, etag: board.etag });
  return board;
}
