import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ icon: Icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 bg-surface border-b border-bdr">
      <div
        className="w-[52px] h-[52px] rounded-xl bg-gradient-to-br from-brand to-brand-dark shadow-sm flex items-center justify-center shrink-0"
        suppressHydrationWarning
      >
        <Icon className="w-6 h-6 text-white" aria-hidden={true} suppressHydrationWarning />
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold text-t1 leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-t2 leading-tight mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
