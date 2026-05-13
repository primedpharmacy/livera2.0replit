import type { LucideIcon } from 'lucide-react';
import { Clock } from 'lucide-react';

interface FuturePlaceholderCardProps {
  title: string;
  wave_reference: string;
  description: string;
  icon?: LucideIcon;
}

export function FuturePlaceholderCard({
  title,
  wave_reference,
  description,
  icon: Icon,
}: FuturePlaceholderCardProps) {
  return (
    <div className="relative border border-dashed border-bdr rounded-lg px-4 py-3 bg-page-bg">
      <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface text-t3 border border-bdr whitespace-nowrap">
        Coming in {wave_reference}
      </span>
      <div className="flex items-start gap-3 pr-40">
        {Icon ? (
          <Icon className="w-4 h-4 text-t3 shrink-0 mt-0.5" />
        ) : (
          <Clock className="w-4 h-4 text-t3 shrink-0 mt-0.5" />
        )}
        <div>
          <p className="text-[13px] font-semibold text-t2">{title}</p>
          <p className="text-[12px] text-t3 mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}
