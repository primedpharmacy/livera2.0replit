/**
 * Dispatch date calculator — BLD-4.6.6 (Wave 4).
 *
 * DEC-15: Four-scenario dispatch date calculator.
 * Inputs: order_at (ISO), delivery_type, holiday_calendar.
 * Outputs: dispatch_date (YYYY-MM-DD), delivery_date (YYYY-MM-DD).
 *
 * Four scenarios:
 *   1. Weekday before 14:00 → same-day dispatch
 *   2. Weekday at/after 14:00 → next working day dispatch
 *   3. Weekend → next working day dispatch
 *   4. Public holiday → next non-holiday working day dispatch
 *
 * Delivery lead times (working days from dispatch):
 *   standard  → +2 WD
 *   next_day  → +1 WD
 *   timed     → provided by caller via delivery_offset_wd
 *
 * Pure function — no side effects, no imports from mock API.
 * Uses NO new Date() — caller must pass a deterministic order_at.
 */

export type DeliveryType = 'standard' | 'next_day' | 'timed';

export interface DispatchInput {
  order_at: string;             // ISO timestamp of order submission
  delivery_type: DeliveryType;
  holiday_calendar: Array<{ date: string; name: string }>;
  delivery_offset_wd?: number;  // only used when delivery_type === 'timed'
}

export interface DispatchResult {
  dispatch_date: string;   // YYYY-MM-DD
  delivery_date: string;   // YYYY-MM-DD
  scenario: 1 | 2 | 3 | 4;
  scenario_label: string;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function isHoliday(d: Date, holidays: Set<string>): boolean {
  return holidays.has(toDateStr(d));
}

function isWorkingDay(d: Date, holidays: Set<string>): boolean {
  return !isWeekend(d) && !isHoliday(d, holidays);
}

/** Advance date by N working days, skipping weekends and holidays. */
function addWorkingDays(from: Date, wd: number, holidays: Set<string>): Date {
  let dt = new Date(from.getTime());
  let remaining = wd;
  while (remaining > 0) {
    dt = new Date(dt.getTime() + 24 * 60 * 60 * 1000);
    if (isWorkingDay(dt, holidays)) remaining--;
  }
  return dt;
}

/** Next working day at or after the given date. */
function nextWorkingDay(from: Date, holidays: Set<string>): Date {
  let dt = new Date(from.getTime());
  while (!isWorkingDay(dt, holidays)) {
    dt = new Date(dt.getTime() + 24 * 60 * 60 * 1000);
  }
  return dt;
}

export function calculateDispatch(input: DispatchInput): DispatchResult {
  const { order_at, delivery_type, holiday_calendar, delivery_offset_wd } = input;
  const holidays = new Set(holiday_calendar.map((h) => h.date));

  const orderDt = new Date(order_at);
  const hourUTC = orderDt.getUTCHours();
  const orderDateDt = new Date(Date.UTC(orderDt.getUTCFullYear(), orderDt.getUTCMonth(), orderDt.getUTCDate()));

  let dispatchDt: Date;
  let scenario: 1 | 2 | 3 | 4;
  let scenarioLabel: string;

  const todayIsWorking = isWorkingDay(orderDateDt, holidays);

  if (!todayIsWorking && isWeekend(orderDateDt)) {
    // Scenario 3 — Weekend
    scenario = 3;
    scenarioLabel = 'Weekend order — dispatches next working day';
    dispatchDt = nextWorkingDay(new Date(orderDateDt.getTime() + 24 * 60 * 60 * 1000), holidays);
  } else if (!todayIsWorking && isHoliday(orderDateDt, holidays)) {
    // Scenario 4 — Public holiday
    scenario = 4;
    scenarioLabel = 'Public holiday — dispatches next non-holiday working day';
    dispatchDt = nextWorkingDay(new Date(orderDateDt.getTime() + 24 * 60 * 60 * 1000), holidays);
  } else if (hourUTC < 14) {
    // Scenario 1 — Weekday before 14:00 UTC
    scenario = 1;
    scenarioLabel = 'Weekday before 14:00 — same-day dispatch';
    dispatchDt = orderDateDt;
  } else {
    // Scenario 2 — Weekday at/after 14:00
    scenario = 2;
    scenarioLabel = 'Weekday at or after 14:00 — next working day dispatch';
    dispatchDt = nextWorkingDay(new Date(orderDateDt.getTime() + 24 * 60 * 60 * 1000), holidays);
  }

  // Delivery date from dispatch date
  const leadDays =
    delivery_type === 'next_day' ? 1 :
    delivery_type === 'timed'    ? (delivery_offset_wd ?? 2) :
    2; // standard = 2 WD

  const deliveryDt = addWorkingDays(dispatchDt, leadDays, holidays);

  return {
    dispatch_date: toDateStr(dispatchDt),
    delivery_date: toDateStr(deliveryDt),
    scenario,
    scenario_label: scenarioLabel,
  };
}

// ---------------------------------------------------------------------------
// Inline tests — run via: ts-node lib/utils/dispatchCalculator.ts
// ---------------------------------------------------------------------------

if (process.env['NODE_ENV'] === 'test') {
  const holidays = [{ date: '2026-05-25', name: 'Spring Bank Holiday' }];

  // Scenario 1: weekday 08:00
  const r1 = calculateDispatch({ order_at: '2026-05-11T08:00:00Z', delivery_type: 'standard', holiday_calendar: holidays });
  console.assert(r1.scenario === 1, 'S1 failed');
  console.assert(r1.dispatch_date === '2026-05-11', `S1 dispatch wrong: ${r1.dispatch_date}`);
  console.assert(r1.delivery_date === '2026-05-13', `S1 delivery wrong: ${r1.delivery_date}`);

  // Scenario 2: weekday 16:00
  const r2 = calculateDispatch({ order_at: '2026-05-11T16:00:00Z', delivery_type: 'next_day', holiday_calendar: holidays });
  console.assert(r2.scenario === 2, 'S2 failed');
  console.assert(r2.dispatch_date === '2026-05-12', `S2 dispatch wrong: ${r2.dispatch_date}`);
  console.assert(r2.delivery_date === '2026-05-13', `S2 delivery wrong: ${r2.delivery_date}`);

  // Scenario 3: Saturday
  const r3 = calculateDispatch({ order_at: '2026-05-09T10:00:00Z', delivery_type: 'standard', holiday_calendar: holidays });
  console.assert(r3.scenario === 3, 'S3 failed');
  console.assert(r3.dispatch_date === '2026-05-11', `S3 dispatch wrong: ${r3.dispatch_date}`);

  // Scenario 4: public holiday (2026-05-25 = Spring Bank Holiday)
  const r4 = calculateDispatch({ order_at: '2026-05-25T09:00:00Z', delivery_type: 'standard', holiday_calendar: holidays });
  console.assert(r4.scenario === 4, 'S4 failed');
  console.assert(r4.dispatch_date === '2026-05-26', `S4 dispatch wrong: ${r4.dispatch_date}`);

  console.log('✓ All dispatch calculator tests passed');
}
