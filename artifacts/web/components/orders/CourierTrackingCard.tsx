/**
 * CourierTrackingCard — BLD-11.2 / BLD-11.4 (Wave 11).
 *
 * Renders a compact Royal Mail tracking timeline for an order.
 * Used in:
 *   - OrderDetailClient (left panel, when order is dispatched/delivered)
 *   - Patient Profile Journey tab (grouped by order)
 *
 * Exception styling: exception events are highlighted in red with
 * actionable copy (schedule redelivery / contact patient).
 */

import { format, parseISO } from "date-fns";
import {
  Package, CheckCircle2, Truck, MapPin, Home, AlertTriangle, Clock, Mail,
} from "lucide-react";
import { exceptionCodeLabel } from "@/lib/integrations/royalMail";
import type { CourierEvent, CourierEventType } from "@/types";

interface Props {
  trackingId: string | null;
  events: CourierEvent[];
  compact?: boolean;
}

const EVENT_CONFIG: Record<CourierEventType, {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  cls: string;
}> = {
  accepted:          { label: "Accepted by Royal Mail",      Icon: Package,      cls: "text-t2"    },
  collected:         { label: "Collected from depot",        Icon: Truck,        cls: "text-t2"    },
  in_transit:        { label: "In transit",                  Icon: MapPin,       cls: "text-info"  },
  out_for_delivery:  { label: "Out for delivery today",      Icon: Truck,        cls: "text-ok"    },
  delivered:         { label: "Delivered",                   Icon: CheckCircle2, cls: "text-ok"    },
  exception:         { label: "Delivery exception",          Icon: AlertTriangle,cls: "text-err"   },
};

export function CourierTrackingCard({ trackingId, events, compact = false }: Props) {
  if (events.length === 0 && !trackingId) return null;

  const sorted = [...events].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const latest = sorted[0] ?? null;
  const hasException = events.some((e) => e.is_exception);
  const isDelivered  = events.some((e) => e.event_type === "delivered");

  return (
    <div className={`bg-surface border rounded-lg overflow-hidden ${hasException ? "border-err-bdr" : "border-bdr"}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${hasException ? "bg-err-bg border-err-bdr" : "bg-page-bg border-bdr"}`}>
        <div className="flex items-center gap-2">
          <Truck className={`w-3.5 h-3.5 ${hasException ? "text-err" : "text-brand"}`} />
          <h3 className={`text-[11px] font-bold uppercase tracking-wider ${hasException ? "text-err" : "text-t2"}`}>
            Royal Mail tracking
          </h3>
          {hasException && (
            <span className="text-[10px] font-bold bg-err text-white px-1.5 py-px rounded">
              Exception
            </span>
          )}
          {isDelivered && !hasException && (
            <span className="text-[10px] font-bold bg-ok text-white px-1.5 py-px rounded">
              Delivered
            </span>
          )}
        </div>
        {trackingId && (
          <span className="text-[11px] font-mono text-t3">{trackingId}</span>
        )}
      </div>

      {/* Exception action banner */}
      {hasException && !isDelivered && (
        <div className="px-4 py-2.5 bg-err-bg border-b border-err-bdr">
          {sorted.filter((e) => e.is_exception).map((e) => (
            <div key={e.id} className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-err shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-semibold text-err">
                  {exceptionCodeLabel(e.exception_code)}
                </p>
                <p className="text-[11px] text-err/70 mt-0.5">{e.description}</p>
                <p className="text-[11px] text-err/60 mt-1 font-medium">
                  Action required: contact patient to arrange redelivery or collection from depot.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="divide-y divide-bdr">
        {(compact ? sorted.slice(0, 3) : sorted).map((event, idx) => {
          const cfg = EVENT_CONFIG[event.event_type];
          const Icon = cfg.Icon;
          return (
            <div key={event.id} className={`flex items-start gap-3 px-4 py-2.5 ${event.is_exception ? "bg-err-bg/40" : idx === 0 ? "bg-brand/[0.02]" : ""}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${event.is_exception ? "bg-err-bg" : "bg-page-bg"}`}>
                <Icon className={`w-3 h-3 ${cfg.cls}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[12px] font-semibold ${event.is_exception ? "text-err" : "text-t1"}`}>
                    {cfg.label}
                  </span>
                  {idx === 0 && !event.is_exception && (
                    <span className="text-[9px] font-bold bg-brand/10 text-brand px-1.5 py-px rounded uppercase tracking-wide">
                      Latest
                    </span>
                  )}
                </div>
                {event.location && (
                  <p className="text-[11px] text-t3 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                    {event.location}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="flex items-center gap-1 text-t3">
                  <Clock className="w-3 h-3" />
                  <span className="text-[10.5px]">
                    {format(parseISO(event.occurred_at), "d MMM, HH:mm")}
                  </span>
                </div>
                {event.postmark_triggered && (
                  <span className="inline-flex items-center gap-1 text-[9.5px] font-medium text-info px-1.5 py-0.5 rounded bg-info-bg border border-info-bdr">
                    <Mail className="w-2.5 h-2.5" />
                    Patient notified
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {compact && sorted.length > 3 && (
          <div className="px-4 py-2 text-[11px] text-t3 text-center">
            +{sorted.length - 3} earlier events
          </div>
        )}
        {events.length === 0 && (
          <div className="px-4 py-4 text-[12px] text-t3 text-center">
            No tracking events recorded yet
          </div>
        )}
      </div>
    </div>
  );
}

// ── Compact status chip (for use in order lists) ───────────────────────────────

export function CourierStatusChip({ events }: { events: CourierEvent[] }) {
  if (events.length === 0) return null;
  const sorted = [...events].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const latest = sorted[0];
  const hasException = events.some((e) => e.is_exception);

  if (hasException) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-err-bg text-err border border-err-bdr">
        <AlertTriangle className="w-2.5 h-2.5" />
        Delivery exception
      </span>
    );
  }
  const cfg = EVENT_CONFIG[latest.event_type];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-ok-bg text-ok border border-ok-bdr">
      <CheckCircle2 className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}
