"use client";

/**
 * UI primitive components shared across consultation sub-components.
 * Kept in a .tsx file so JSX is valid. Imported alongside consultationConfig.ts.
 */

export function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-t2 uppercase tracking-wide font-medium mb-0.5">{label}</p>
      <p className="text-sm font-medium text-t1">{value}</p>
    </div>
  );
}

export function RailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-t3 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-t2">{label}</p>
        <p className="text-xs font-medium text-t1">{value}</p>
      </div>
    </div>
  );
}
