/**
 * Settings → Holiday Calendar — BLD-4.6.7 (Wave 4).
 *
 * Allows Owner/RM to manage the clinic's holiday_calendar.
 * Changes affect addWorkingHours + dispatchCalculator immediately.
 *
 * Only Owner / RM can reach this via settings (permission: "settings").
 */

import { getClinicSync, updateClinicHolidays } from "@/lib/api/mock";
import { CURRENT_USER } from "@/lib/api/mock";
import { HolidayCalendarEditor } from "@/components/settings/HolidayCalendarEditor";
import type { ClinicId } from "@/types";

type HolidaysPageProps = { params: Promise<{ clinic_id: string }> };

export default async function HolidaysPage({ params }: HolidaysPageProps) {
  const { clinic_id } = await params;
  const clinic = getClinicSync(clinic_id as ClinicId);

  async function handleHolidayUpdate(
    action: "add" | "remove",
    entry: { date: string; name: string },
  ) {
    "use server";
    await updateClinicHolidays(clinic_id as ClinicId, action, entry, CURRENT_USER.id);
  }

  return (
    <div className="px-6 py-6 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-[15px] font-bold text-t1">Holiday calendar</h2>
        <p className="text-[12px] text-t3 mt-1">
          Manage UK public holidays and clinic-specific closure dates.
          These dates are excluded from working-hours SLA calculations and dispatch date estimates.
        </p>
      </div>

      <HolidayCalendarEditor
        clinicId={clinic_id as ClinicId}
        initialHolidays={clinic.config.holiday_calendar}
        onUpdate={handleHolidayUpdate}
      />
    </div>
  );
}
