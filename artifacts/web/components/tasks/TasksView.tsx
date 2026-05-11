"use client";

// TODO (Mini-wave 6b stub): Full task surface arriving in Mini-wave 6b.
//   Build-out: task list with assignment, due dates, priorities, and filters.
//   For now this renders a placeholder so the sidebar nav link resolves without 404.

import { CheckSquare } from "lucide-react";

interface Props {
  clinicId: string;
}

export function TasksView({ clinicId: _clinicId }: Props) {
  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
            <CheckSquare className="w-4.5 h-4.5 text-brand" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-t1">Tasks</h1>
            <p className="text-[12px] text-t3">Coming in Mini-wave 6b</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center mb-4">
          <CheckSquare className="w-7 h-7 text-brand" />
        </div>
        <h2 className="text-base font-semibold text-t1 mb-2">Task management is on its way</h2>
        <p className="text-[13px] text-t2 max-w-sm leading-relaxed">
          Task management surface arrives in the next wave. For now, work items
          live on monday.com.
        </p>
      </div>
    </div>
  );
}
