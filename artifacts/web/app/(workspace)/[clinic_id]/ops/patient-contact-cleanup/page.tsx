/**
 * Ops → Patient Contact Cleanup — Task-249.
 *
 * Surfaces the `needs_followup` queue from `cleanupPatientContactData` —
 * the backfill that rewrites phone numbers / postcodes to canonical form
 * but cannot auto-fix records whose values aren't parseable at all.
 *
 * Without this page those records sit invisible in the `[AUDIT]` log
 * stream; ops have no way to see "who do I still need to chase".
 *
 * The page runs the job in `dryRun` mode on every render so the list
 * reflects current fixture state without mutating anything. A "Run
 * cleanup now" button kicks off the real (non-dry-run) job which
 * auto-normalises whatever it can and refreshes this page so any newly
 * cleaned records drop off the list.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, Phone, MapPin, Users } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import {
  cleanupPatientContactData,
  type PatientContactFollowup,
} from '@/lib/api/jobs/cleanupPatientContactData';
import { MOCK_PATIENTS } from '@/lib/api/fixtures/patients';
import { requireServerActionUser } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import type { ClinicId } from '@/lib/api/types';
import { RunCleanupButton } from './RunCleanupButton';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ clinic_id: string }> };

function isClinicId(v: string): v is ClinicId {
  return v === 'vsc' || v === 'feeltru';
}

function patientName(patientId: string): string {
  const p = MOCK_PATIENTS.find((x) => x.id === patientId);
  if (!p) return patientId;
  return p.demographic.full_name?.trim() || patientId;
}

export default async function PatientContactCleanupPage({ params }: Props) {
  const { clinic_id } = await params;

  // Server-side authz — sidebar hides the link but the URL is reachable
  // directly. This page renders patient identifiers + raw bad phone /
  // postcode values (PII), so we re-check the same `read`/`settings`
  // permission the sidebar gate uses. Unauthorised callers see a 404 so
  // the page's existence isn't probeable.
  const actor = await requireServerActionUser();
  if (!can(actor, 'read', 'settings')) {
    notFound();
  }

  if (!isClinicId(clinic_id)) {
    notFound();
  }
  const scoped = clinic_id;

  const result = await cleanupPatientContactData(scoped, { dryRun: true });
  const followups = result.needs_followup;

  const phoneCount    = followups.filter((f) => f.field === 'phone').length;
  const postcodeCount = followups.filter((f) => f.field === 'postcode').length;

  return (
    <>
      <Breadcrumb items={[{ label: 'Ops' }, { label: 'Patient Contact Cleanup' }]} />
      <PageHeader
        icon={Users}
        title="Patient Contact Cleanup"
        subtitle={
          `Records whose phone number or postcode could not be auto-normalised by the ` +
          `contact-data backfill. Scanned ${result.scanned} patient${result.scanned === 1 ? '' : 's'}; ` +
          `${followups.length} still need${followups.length === 1 ? 's' : ''} a manual fix.`
        }
        actions={<RunCleanupButton clinicId={clinic_id} />}
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Patients scanned"
            value={String(result.scanned)}
            sub="Current clinic"
          />
          <StatCard
            label="Bad phone numbers"
            value={String(phoneCount)}
            sub={phoneCount === 0 ? 'All phone numbers parseable' : 'Need manual chase'}
            tone={phoneCount > 0 ? 'warn' : 'ok'}
          />
          <StatCard
            label="Bad postcodes"
            value={String(postcodeCount)}
            sub={postcodeCount === 0 ? 'All postcodes parseable' : 'Need manual chase'}
            tone={postcodeCount > 0 ? 'warn' : 'ok'}
          />
        </div>

        <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-page-bg border-b border-bdr text-t3 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left font-semibold px-3 py-2">Patient</th>
                <th className="text-left font-semibold px-3 py-2">Field</th>
                <th className="text-left font-semibold px-3 py-2">Stored value</th>
                <th className="text-left font-semibold px-3 py-2">Reason</th>
                <th className="text-right font-semibold px-3 py-2">Open</th>
              </tr>
            </thead>
            <tbody>
              {followups.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-t3">
                    No outstanding follow-ups — every patient phone &amp; postcode in
                    this clinic parses cleanly.
                  </td>
                </tr>
              )}
              {followups.map((f, idx) => (
                <FollowupRow
                  key={`${f.patient_id}_${f.field}_${idx}`}
                  followup={f}
                  clinicId={clinic_id}
                />
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-t3">
          List is computed on every page load via a dry-run of
          <code className="mx-1">cleanupPatientContactData</code>. Running the
          cleanup auto-normalises any record that <em>can</em> be parsed
          (E.164 phone, spaced/uppercase postcode); records that remain on
          this list need a person to call the patient and update the value
          by hand.
        </p>
      </div>
    </>
  );
}

function FollowupRow({
  followup,
  clinicId,
}: {
  followup: PatientContactFollowup;
  clinicId: string;
}) {
  const isPhone = followup.field === 'phone';
  const Icon = isPhone ? Phone : MapPin;
  const reasonLabel =
    followup.reason === 'phone_unparseable'
      ? 'Phone number could not be parsed as a UK mobile'
      : 'Postcode is not a valid UK postcode';

  return (
    <tr className="border-b border-bdr last:border-b-0">
      <td className="px-3 py-2 align-top">
        <div className="font-medium text-t1">{patientName(followup.patient_id)}</div>
        <div className="text-[11px] text-t3 font-mono">{followup.patient_id}</div>
      </td>
      <td className="px-3 py-2 align-top">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-px rounded-full bg-warn-bg text-warn border border-warn-bdr">
          <Icon className="w-3 h-3" aria-hidden />
          {isPhone ? 'Phone' : 'Postcode'}
        </span>
      </td>
      <td className="px-3 py-2 align-top font-mono text-t1">{followup.value || '—'}</td>
      <td className="px-3 py-2 align-top text-t2">
        <span className="inline-flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5 text-warn shrink-0" aria-hidden />
          {reasonLabel}
        </span>
      </td>
      <td className="px-3 py-2 align-top text-right">
        <Link
          href={`/${clinicId}/patients/${followup.patient_id}`}
          className="text-[12px] font-semibold text-brand hover:underline"
        >
          Open record →
        </Link>
      </td>
    </tr>
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
