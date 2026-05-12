/**
 * Working-hours utilities — BLD-2.7.
 *
 * addWorkingHours: advances an ISO timestamp by N working hours,
 * skipping UK weekends and the clinic's holiday_calendar.
 */

export type HolidayEntry = { date: string; name: string };

/**
 * Return a new ISO timestamp that is `hours` working-hours after `startISO`.
 * Weekends (Sat/Sun) and dates in `holidayCalendar` are skipped.
 */
export function addWorkingHours(
  startISO: string,
  hours: number,
  holidayCalendar: HolidayEntry[] = []
): string {
  const holidays = new Set(holidayCalendar.map((h) => h.date));
  let dt = new Date(startISO);
  let remaining = hours;

  while (remaining > 0) {
    dt = new Date(dt.getTime() + 60 * 60 * 1000); // advance 1 hour
    const day = dt.getDay();                       // 0=Sun 6=Sat
    const dateStr = dt.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidays.has(dateStr)) {
      remaining--;
    }
  }

  return dt.toISOString();
}

/**
 * Return the number of working hours between two ISO timestamps.
 * Fractional hours are truncated.
 */
export function diffWorkingHours(
  startISO: string,
  endISO: string,
  holidayCalendar: HolidayEntry[] = []
): number {
  const holidays = new Set(holidayCalendar.map((h) => h.date));
  let dt = new Date(startISO);
  const end = new Date(endISO);
  let count = 0;

  while (dt < end) {
    dt = new Date(dt.getTime() + 60 * 60 * 1000);
    const day = dt.getDay();
    const dateStr = dt.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidays.has(dateStr)) {
      count++;
    }
  }
  return count;
}
