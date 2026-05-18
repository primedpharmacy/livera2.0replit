/**
 * Ops → SMS Bounce Breakdown — Task-302.
 *
 * Clinic-level rollup of bounced / failed outbound SMSes grouped by the
 * structured Twilio error code (`sms_error_code`) captured on each
 * notification row by the Twilio status-callback webhook. The per-patient
 * notification log already shows a friendly summary for each individual
 * bounce; this page answers the *trend* question Ops actually asks —
 * "what's our top reason for failing SMSes this week, and is it getting
 * worse?".
 *
 * Why a dedicated page:
 *   - The friendly summary used to live inside the row renderer, so a
 *     clinic-wide aggregate had to re-parse free-text errors. Task-302
 *     promoted the numeric Twilio code to a first-class field so this page
 *     can group on a structured value.
 *   - Decisions this surfaces drive product investment — e.g. "30006
 *     (landline) is 40% of our bounces, let's add real-time validation at
 *     contact-capture" or "21610 (opted out) is climbing, we should default
 *     more patients to email".
 *
 * Time window:
 *   Selectable via the `?window=` search param (7d / 30d / 90d / all).
 *   The window is anchored on the frozen fixture clock `NOW` rather than
 *   wall-clock `Date.now()` so the page is stable for demo / visual
 *   baselines — same input, same output.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, MessageSquareWarning } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { listPatientNotifications } from '@/lib/api/fixtures/patientNotifications';
import { summaryForTwilioCode } from '@/lib/notifications/smsCarrierReasons';
import { NOW } from '@/lib/api/constants';
import { requireServerActionUser } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import type { ClinicId } from '@/lib/api/types';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ clinic_id: string }>;
  searchParams: Promise<{ window?: string }>;
};

function isClinicId(v: string): v is ClinicId {
  return v === 'vsc' || v === 'feeltru';
}

type WindowKey = '7d' | '30d' | '90d' | 'all';
const WINDOW_OPTIONS: Array<{ key: WindowKey; label: string; days: number | null }> = [
  { key: '7d',  label: 'Last 7 days',  days: 7   },
  { key: '30d', label: 'Last 30 days', days: 30  },
  { key: '90d', label: 'Last 90 days', days: 90  },
  { key: 'all', label: 'All time',     days: null },
];

function resolveWindow(raw: string | undefined): typeof WINDOW_OPTIONS[number] {
  return WINDOW_OPTIONS.find((w) => w.key === raw) ?? WINDOW_OPTIONS[1];
}

export default async function SmsBouncesPage({ params, searchParams }: Props) {
  const { clinic_id } = await params;
  const { window: windowRaw } = await searchParams;

  // Server-side authz — sidebar already gates the link on `read:settings`,
  // re-check here so direct URL access from a Coach (no settings read)
  // hits a 404 instead of leaking aggregate carrier-failure counts.
  const actor = await requireServerActionUser();
  if (!can(actor, 'read', 'settings')) {
    notFound();
  }

  if (!isClinicId(clinic_id)) {
    notFound();
  }

  const window = resolveWindow(windowRaw);
  const cutoffMs =
    window.days === null
      ? null
      : new Date(NOW).getTime() - window.days * 24 * 60 * 60 * 1000;

  const all = await listPatientNotifications(clinic_id);

  // Scope to SMS rows in a carrier-final failure state inside the chosen
  // window. Delivered SMS rows are excluded — the question is "why did
  // sends fail", not "how many sends happened". Email rows are excluded
  // — they have a different (Postmark) error vocabulary and live in the
  // per-patient log; mixing the two here would be confusing.
  const smsFailures = all.filter((n) => {
    if (n.channel !== 'SMS') return false;
    if (n.status !== 'Bounced' && n.status !== 'Failed') return false;
    if (cutoffMs !== null && new Date(n.sent_at).getTime() < cutoffMs) return false;
    return true;
  });

  // Group by structured sms_error_code. Rows captured before Task-302 may
  // have a null sms_error_code even though `last_error` is populated —
  // bucket those under an explicit `unknown` group so they aren't silently
  // dropped from the totals (ops still wants to see them, they just
  // can't drive code-level action).
  type Bucket = { code: number | null; label: string; count: number; sample: string | null };
  const buckets = new Map<string, Bucket>();
  for (const n of smsFailures) {
    const code = n.sms_error_code;
    const key  = code === null ? 'unknown' : String(code);
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.sample && n.last_error) existing.sample = n.last_error;
    } else {
      buckets.set(key, {
        code,
        label:
          code === null
            ? 'No carrier code recorded'
            : summaryForTwilioCode(code),
        count: 1,
        sample: n.last_error,
      });
    }
  }

  const grouped = Array.from(buckets.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    // Stable tie-break by label so the page renders identically across loads.
    return a.label.localeCompare(b.label);
  });
  const total = smsFailures.length;
  const topReason = grouped[0] ?? null;
  const distinctCodes = grouped.filter((g) => g.code !== null).length;

  return (
    <>
      <Breadcrumb items={[{ label: 'Ops' }, { label: 'SMS Bounces' }]} />
      <PageHeader
        icon={MessageSquareWarning}
        title="SMS Bounce Breakdown"
        subtitle={
          total === 0
            ? `No bounced or failed outbound SMSes in this clinic over the selected window.`
            : `${total} bounced or failed outbound SMS${total === 1 ? '' : 'es'} ` +
              `across ${distinctCodes} known Twilio reason${distinctCodes === 1 ? '' : 's'}.`
        }
      />

      <div className="p-6 space-y-6">
        <WindowSwitcher clinicId={clinic_id} active={window.key} />

        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Failed SMSes in window"
            value={String(total)}
            sub={window.label}
            tone={total > 0 ? 'warn' : 'ok'}
          />
          <StatCard
            label="Distinct reasons"
            value={String(distinctCodes)}
            sub={
              distinctCodes === 0
                ? 'No carrier codes recorded'
                : 'Mapped Twilio error codes'
            }
          />
          <StatCard
            label="Top reason"
            value={topReason ? topReason.label : '—'}
            sub={
              topReason
                ? `${topReason.count} of ${total} ` +
                  `(${Math.round((topReason.count / total) * 100)}%)`
                : 'Nothing to show'
            }
            tone={topReason ? 'warn' : 'ok'}
          />
        </div>

        <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
          <table className="w-full text-[13px]" data-testid="sms-bounce-breakdown-table">
            <thead className="bg-page-bg border-b border-bdr text-t3 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left font-semibold px-3 py-2">Reason</th>
                <th className="text-left font-semibold px-3 py-2">Twilio code</th>
                <th className="text-right font-semibold px-3 py-2">Bounces</th>
                <th className="text-right font-semibold px-3 py-2">Share</th>
                <th className="text-left font-semibold px-3 py-2">Sample error</th>
              </tr>
            </thead>
            <tbody>
              {grouped.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-t3">
                    No bounced SMSes in this window — nothing to break down.
                  </td>
                </tr>
              )}
              {grouped.map((g) => (
                <tr
                  key={g.code === null ? 'unknown' : String(g.code)}
                  className="border-b border-bdr last:border-b-0"
                  data-testid={`sms-bounce-row-${g.code ?? 'unknown'}`}
                >
                  <td className="px-3 py-2 align-top font-medium text-t1">{g.label}</td>
                  <td className="px-3 py-2 align-top font-mono text-[11px] text-t2">
                    {g.code === null ? '—' : g.code}
                  </td>
                  <td
                    className="px-3 py-2 align-top text-right font-semibold text-t1"
                    data-testid={`sms-bounce-count-${g.code ?? 'unknown'}`}
                  >
                    {g.count}
                  </td>
                  <td className="px-3 py-2 align-top text-right text-t2">
                    {total === 0 ? '—' : `${Math.round((g.count / total) * 100)}%`}
                  </td>
                  <td className="px-3 py-2 align-top text-t3">
                    {g.sample ? (
                      <span className="inline-flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 mt-0.5 text-err shrink-0" aria-hidden />
                        <span className="truncate" title={g.sample}>{g.sample}</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-t3">
          Bounces are grouped on the structured <code className="mx-1">sms_error_code</code> field
          recorded by the Twilio status-callback webhook. The friendly label table is shared
          with the per-patient notification log row so both surfaces always agree on wording.
          Rows captured before this field existed are grouped under
          <em className="mx-1">No carrier code recorded</em> so they aren&apos;t silently dropped.
        </p>
      </div>
    </>
  );
}

function WindowSwitcher({ clinicId, active }: { clinicId: string; active: WindowKey }) {
  return (
    <div
      className="inline-flex border border-bdr rounded-md overflow-hidden bg-surface"
      data-testid="sms-bounce-window-switcher"
    >
      {WINDOW_OPTIONS.map((opt) => {
        const isActive = opt.key === active;
        return (
          <Link
            key={opt.key}
            href={`/${clinicId}/ops/sms-bounces?window=${opt.key}`}
            className={
              'px-3 py-1.5 text-[12px] font-semibold border-r border-bdr last:border-r-0 ' +
              (isActive
                ? 'bg-brand text-white'
                : 'text-t2 hover:bg-page-bg')
            }
            aria-pressed={isActive}
            data-testid={`sms-bounce-window-${opt.key}`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'default' | 'ok' | 'warn' | 'err';
}) {
  const valueColour =
    tone === 'ok'
      ? 'text-ok'
      : tone === 'warn'
        ? 'text-warn'
        : tone === 'err'
          ? 'text-err'
          : 'text-t1';
  return (
    <div className="bg-surface border border-bdr rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wider text-t3 font-bold">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${valueColour}`}>{value}</div>
      <div className="text-[11px] text-t3 mt-1">{sub}</div>
    </div>
  );
}
