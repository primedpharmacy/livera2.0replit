/**
 * dispatchCalculator — BLD-4.6.3
 *
 * Four-scenario dispatch date calculator for UK pharmacy orders.
 * Uses the clinic's holiday_calendar to skip UK bank holidays.
 *
 * Scenario A — Same-day dispatch
 *   Approved before SAME_DAY_CUTOFF_HOUR on a working day → dispatches today.
 *
 * Scenario B — Standard next-working-day
 *   Approved after cutoff on a weekday with no holiday → dispatches next WD.
 *
 * Scenario C — Bank holiday skip
 *   The next calendar day (or today if same-day) is a bank holiday → advance
 *   to the next non-holiday working day.
 *
 * Scenario D — Pre-weekend (Friday after cutoff)
 *   Approved after cutoff on Friday → dispatches Monday (skipping holidays).
 *
 * All times are assumed UK local time (BST/GMT — no TZ conversion needed
 * for a mock; a production build would use date-fns-tz).
 */

export type DispatchScenario = "same_day" | "next_working_day" | "holiday_skip" | "pre_weekend";

export interface DispatchResult {
  scenario:         DispatchScenario;
  dispatchDate:     Date;
  dispatchDateStr:  string;          // "Wed 20 May 2026"
  cutoffMet:        boolean;         // true  → same-day eligible
  skippedHolidays:  string[];        // names of any skipped bank holidays
  workingDaysAdded: number;          // 0 = same-day, 1 = next WD, 2+ = holiday skip
  explanation:      string;
}

export interface HolidayEntry {
  date: string;   // YYYY-MM-DD
  name: string;
}

/** Daily cutoff hour (24h, UK local). Orders approved before this hour
 *  qualify for same-day dispatch. */
export const SAME_DAY_CUTOFF_HOUR = 13;

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function isHoliday(d: Date, holidays: HolidayEntry[]): HolidayEntry | null {
  const ds = toDateStr(d);
  return holidays.find((h) => h.date === ds) ?? null;
}

function isWorkingDay(d: Date, holidays: HolidayEntry[]): boolean {
  return !isWeekend(d) && !isHoliday(d, holidays);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Returns the next working day on or after `from`. */
function nextWorkingDayOnOrAfter(from: Date, holidays: HolidayEntry[]): {
  date: Date;
  skipped: string[];
} {
  let cur = new Date(from);
  const skipped: string[] = [];
  while (!isWorkingDay(cur, holidays)) {
    const h = isHoliday(cur, holidays);
    if (h) skipped.push(h.name);
    cur = addDays(cur, 1);
  }
  return { date: cur, skipped };
}

/** Advances one calendar day, then finds the next working day. */
function nextWorkingDayAfter(from: Date, holidays: HolidayEntry[]): {
  date: Date;
  skipped: string[];
} {
  return nextWorkingDayOnOrAfter(addDays(from, 1), holidays);
}

function formatDispatchDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Calculate expected dispatch date.
 *
 * @param approvedAt  ISO timestamp of clinical approval
 * @param holidays    Clinic holiday_calendar entries
 */
export function calculateDispatchDate(
  approvedAt: string,
  holidays: HolidayEntry[]
): DispatchResult {
  const dt = new Date(approvedAt);
  const hour = dt.getHours();
  const isFriday = dt.getDay() === 5;
  const todayIsWorkingDay = isWorkingDay(dt, holidays);
  const cutoffMet = hour < SAME_DAY_CUTOFF_HOUR && todayIsWorkingDay;

  // ── Scenario A — Same-day dispatch ─────────────────────────────────────────
  if (cutoffMet) {
    return {
      scenario:         "same_day",
      dispatchDate:     dt,
      dispatchDateStr:  formatDispatchDate(dt),
      cutoffMet:        true,
      skippedHolidays:  [],
      workingDaysAdded: 0,
      explanation:
        `Order approved before ${SAME_DAY_CUTOFF_HOUR}:00. ` +
        "Qualifies for same-day dispatch — pharmacy will process today.",
    };
  }

  // ── Scenarios B / C / D — Next working day ─────────────────────────────────
  const { date: candidate, skipped } = nextWorkingDayAfter(dt, holidays);

  // ── Scenario D — Pre-weekend ────────────────────────────────────────────────
  if (isFriday && !cutoffMet && skipped.length === 0) {
    return {
      scenario:         "pre_weekend",
      dispatchDate:     candidate,
      dispatchDateStr:  formatDispatchDate(candidate),
      cutoffMet:        false,
      skippedHolidays:  [],
      workingDaysAdded: Math.round(
        (candidate.getTime() - dt.getTime()) / 86_400_000
      ),
      explanation:
        "Order approved after cut-off on Friday. " +
        `Next working day is ${formatDispatchDate(candidate)} (weekend skip). ` +
        "Dispatch will be processed first thing Monday.",
    };
  }

  // ── Scenario C — Bank holiday skip ──────────────────────────────────────────
  if (skipped.length > 0) {
    return {
      scenario:         "holiday_skip",
      dispatchDate:     candidate,
      dispatchDateStr:  formatDispatchDate(candidate),
      cutoffMet:        false,
      skippedHolidays:  skipped,
      workingDaysAdded: Math.round(
        (candidate.getTime() - dt.getTime()) / 86_400_000
      ),
      explanation:
        `Bank holiday${skipped.length > 1 ? "s" : ""} (${skipped.join(", ")}) ` +
        `on the next working day. Dispatch advanced to ${formatDispatchDate(candidate)}.`,
    };
  }

  // ── Scenario B — Standard next working day ──────────────────────────────────
  return {
    scenario:         "next_working_day",
    dispatchDate:     candidate,
    dispatchDateStr:  formatDispatchDate(candidate),
    cutoffMet:        false,
    skippedHolidays:  [],
    workingDaysAdded: Math.round(
      (candidate.getTime() - dt.getTime()) / 86_400_000
    ),
    explanation:
      `Order approved after ${SAME_DAY_CUTOFF_HOUR}:00 cut-off. ` +
      `Standard next working day dispatch: ${formatDispatchDate(candidate)}.`,
  };
}
