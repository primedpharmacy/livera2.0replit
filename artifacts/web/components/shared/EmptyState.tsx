import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-brand" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-t1 mb-1">{title}</h3>
      <p className="text-sm text-t2 max-w-xs leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
