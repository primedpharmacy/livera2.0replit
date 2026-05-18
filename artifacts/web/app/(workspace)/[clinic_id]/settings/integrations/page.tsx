"use client";

/**
 * Settings → Integrations — BLD-CONS-PROVIDER-01 · BLD-1.7 · BLD-9.0
 *
 * Unified hub for the three core platform integrations:
 *   1. Google Workspace — calendar sync + Meet link generation (BLD-CONS-PROVIDER-01)
 *   2. SumSub — identity verification SDK (BLD-1.7)
 *   3. Monday.com — live board write access (BLD-9.0)
 *
 * Owner-only. All connection status + config fields are mocked.
 */

import { useState }       from "react";
import { use }            from "react";
import {
  CheckCircle2, AlertCircle, ExternalLink, RefreshCw,
  Calendar, Shield, LayoutGrid, ChevronDown, ChevronUp, Copy,
} from "lucide-react";
import { Button }         from "@/components/ui/button";
import { cn }             from "@/lib/utils";

type Params = Promise<{ clinic_id: string }>;

// ── Types ──────────────────────────────────────────────────────────────────────

type ConnStatus = "connected" | "disconnected" | "error";

interface IntegrationState {
  google: {
    status: ConnStatus;
    account: string;
    calendar_id: string;
    meet_enabled: boolean;
    default_duration: number;
    open: boolean;
  };
  sumsub: {
    status: ConnStatus;
    app_token: string;
    secret_key: string;
    level_name: string;
    webhook_verified: boolean;
    open: boolean;
  };
  monday: {
    status: ConnStatus;
    api_key_tail: string;
    incident_board: string;
    complaints_board: string;
    sla_breach_board: string;
    open: boolean;
  };
}

const INITIAL: IntegrationState = {
  google: {
    status: "connected",
    account: "scheduling@vsc-clinic.co.uk",
    calendar_id: "c_vsc_consultations@group.calendar.google.com",
    meet_enabled: true,
    default_duration: 30,
    open: false,
  },
  sumsub: {
    status: "connected",
    app_token: "sbx-token-••••••••••••••••••7a4f",
    secret_key: "••••••••••••••••••••••••••••••••",
    level_name: "basic-kyc-level",
    webhook_verified: true,
    open: false,
  },
  monday: {
    status: "connected",
    api_key_tail: "••••••••••••jk7w",
    incident_board: "18402056040",
    complaints_board: "18402056041",
    sla_breach_board: "18402056042",
    open: false,
  },
};

// ── Helper components ──────────────────────────────────────────────────────────

function StatusPill({ status }: { status: ConnStatus }) {
  const cfg = {
    connected:    { cls: "bg-ok-bg text-ok border-ok-bdr",   Icon: CheckCircle2, label: "Connected"    },
    disconnected: { cls: "bg-page-bg text-t3 border-bdr",    Icon: AlertCircle,  label: "Disconnected" },
    error:        { cls: "bg-err-bg text-err border-err-bdr", Icon: AlertCircle,  label: "Error"        },
  }[status];
  const Icon = cfg.Icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border", cfg.cls)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", status === "connected" ? "bg-ok" : status === "error" ? "bg-err" : "bg-t3")} />
      {cfg.label}
    </span>
  );
}

function IntegrationCard({
  id, icon: Icon, title, bldRef, description, status,
  open, onToggle, children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  bldRef: string;
  description: string;
  status: ConnStatus;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-page-bg/60 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-page-bg border border-bdr flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-t2" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-t1">{title}</span>
            <span className="text-[9px] font-bold bg-page-bg border border-bdr text-t3 px-1.5 py-0.5 rounded">{bldRef}</span>
            <StatusPill status={status} />
          </div>
          <p className="text-[11px] text-t2 mt-0.5">{description}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-t3 shrink-0" /> : <ChevronDown className="w-4 h-4 text-t3 shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-bdr px-5 py-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-4 items-start text-[12px]">
      <div>
        <p className="font-semibold text-t2">{label}</p>
        {sub && <p className="text-[11px] text-t3 mt-0.5">{sub}</p>}
      </div>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

function MaskedField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="text-[11px] font-mono bg-page-bg border border-bdr rounded px-2 py-1 text-t2">{value}</code>
      <button
        onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }}
        className="p-1 rounded border border-bdr hover:bg-page-bg text-t3"
        title="Copy"
      >
        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ── Page component ─────────────────────────────────────────────────────────────

export default function IntegrationsPage({ params }: { params: Params }) {
  const { clinic_id } = use(params);
  void clinic_id;

  const [s, setS] = useState<IntegrationState>(INITIAL);
  const [toast, setToast] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function testConnection(key: string, label: string) {
    setTesting(key);
    await new Promise((r) => setTimeout(r, 1200));
    setTesting(null);
    showToast(`${label} connection verified · latency 42ms`);
  }

  function toggle(key: keyof IntegrationState) {
    setS((prev) => ({
      ...prev,
      [key]: { ...prev[key], open: !prev[key].open },
    }));
  }

  return (
    <div className="relative p-6 max-w-4xl space-y-5">

      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg bg-ok text-white">
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-[15px] font-bold text-t1">Integrations</h2>
        <p className="text-[12px] text-t2 mt-0.5">
          Third-party platform connections — changes affect all users in this workspace immediately.
        </p>
      </div>

      {/* ── Google Workspace ───────────────────────────────────────────────── */}
      <IntegrationCard
        id="google"
        icon={Calendar}
        title="Google Workspace"
        bldRef="BLD-CONS-PROVIDER-01"
        description="Calendar sync for consultations + Google Meet link auto-generation · OAuth 2.0"
        status={s.google.status}
        open={s.google.open}
        onToggle={() => toggle("google")}
      >
        <div className="space-y-3">
          <FieldRow label="Connected account" sub="OAuth 2.0 service account">
            <div className="flex items-center gap-2">
              <code className="text-[11px] font-mono bg-page-bg border border-bdr rounded px-2 py-1 text-t2">
                {s.google.account}
              </code>
              <Button
                size="sm" variant="outline"
                onClick={() => showToast("Google OAuth re-authorisation flow launched")}
                className="h-7 text-[11px] gap-1"
              >
                <ExternalLink className="w-3 h-3" /> Re-authorise
              </Button>
            </div>
          </FieldRow>
          <FieldRow label="Primary calendar ID" sub="Events written to this calendar">
            <input
              defaultValue={s.google.calendar_id}
              className="text-[12px] border border-bdr rounded-md px-2.5 py-1.5 bg-surface focus:outline-none focus:ring-1 focus:ring-brand w-80"
            />
          </FieldRow>
          <FieldRow label="Default duration" sub="Applied when consultation type has no override">
            <select
              value={s.google.default_duration}
              onChange={(e) => setS((prev) => ({ ...prev, google: { ...prev.google, default_duration: Number(e.target.value) } }))}
              className="text-[12px] border border-bdr rounded-md px-2.5 py-1.5 bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Google Meet links" sub="Auto-attach a Meet link to every video consultation">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={s.google.meet_enabled}
                onChange={(e) => setS((prev) => ({ ...prev, google: { ...prev.google, meet_enabled: e.target.checked } }))}
                className="accent-brand"
              />
              <span className="text-[12px] text-t2">Generate Meet link on consultation creation</span>
            </label>
          </FieldRow>
          <FieldRow label="Calendar sync scope" sub="Read + write access required">
            <span className="text-[11px] text-ok font-semibold">✓ calendar.events · calendar.readonly</span>
          </FieldRow>
        </div>
        <div className="flex gap-2 pt-2 border-t border-bdr">
          <Button
            size="sm" variant="outline"
            onClick={() => testConnection("google", "Google Workspace")}
            disabled={testing === "google"}
            className="h-8 text-[12px] gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", testing === "google" && "animate-spin")} />
            {testing === "google" ? "Testing…" : "Test connection"}
          </Button>
          <Button size="sm" variant="default" onClick={() => showToast("Google Workspace settings saved")} className="h-8 text-[12px]">
            Save
          </Button>
        </div>
      </IntegrationCard>

      {/* ── SumSub ─────────────────────────────────────────────────────────── */}
      <IntegrationCard
        id="sumsub"
        icon={Shield}
        title="SumSub"
        bldRef="BLD-1.7"
        description="Identity & KYC verification SDK · replaces manual photo-ID uploads · UK GDPR Art 5 compliant"
        status={s.sumsub.status}
        open={s.sumsub.open}
        onToggle={() => toggle("sumsub")}
      >
        <div className="space-y-3">
          <div className="bg-warn-bg border border-warn-bdr rounded-lg p-3 text-[11px] text-warn leading-relaxed">
            <strong>Sandbox mode active.</strong> Switch to production keys once KYC testing passes all flows.
            Never commit production keys — use environment secrets in Livera Deploy.
          </div>
          <FieldRow label="App token" sub="Public identifier — safe to expose">
            <MaskedField value={s.sumsub.app_token} />
          </FieldRow>
          <FieldRow label="Secret key" sub="Server-side only — never sent to client">
            <MaskedField value={s.sumsub.secret_key} />
          </FieldRow>
          <FieldRow label="Verification level" sub="Maps to SumSub applicant level config">
            <input
              defaultValue={s.sumsub.level_name}
              className="text-[12px] border border-bdr rounded-md px-2.5 py-1.5 bg-surface focus:outline-none focus:ring-1 focus:ring-brand w-64"
            />
          </FieldRow>
          <FieldRow label="Webhook" sub="Receives verification status events">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <code className="text-[11px] font-mono bg-page-bg border border-bdr rounded px-2 py-1 text-t2">
                  POST /api/webhooks/sumsub
                </code>
                {s.sumsub.webhook_verified && (
                  <span className="text-[10px] font-bold text-ok bg-ok-bg border border-ok-bdr px-1.5 py-0.5 rounded">✓ Verified</span>
                )}
              </div>
            </div>
          </FieldRow>
          <FieldRow label="Supported flows" sub="Active verification flows">
            <div className="flex gap-1 flex-wrap">
              {["Identity check", "Liveness check", "Document scan", "Face match"].map((f) => (
                <span key={f} className="text-[10px] bg-ok-bg text-ok border border-ok-bdr px-1.5 py-0.5 rounded">{f}</span>
              ))}
            </div>
          </FieldRow>
        </div>
        <div className="flex gap-2 pt-2 border-t border-bdr">
          <Button
            size="sm" variant="outline"
            onClick={() => testConnection("sumsub", "SumSub")}
            disabled={testing === "sumsub"}
            className="h-8 text-[12px] gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", testing === "sumsub" && "animate-spin")} />
            {testing === "sumsub" ? "Testing…" : "Test connection"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => showToast("SumSub applicant test created · check SumSub dashboard")} className="h-8 text-[12px]">
            Run test applicant
          </Button>
          <Button size="sm" variant="default" onClick={() => showToast("SumSub settings saved")} className="h-8 text-[12px]">
            Save
          </Button>
        </div>
      </IntegrationCard>

      {/* ── Monday.com ─────────────────────────────────────────────────────── */}
      <IntegrationCard
        id="monday"
        icon={LayoutGrid}
        title="Monday.com"
        bldRef="BLD-9.0"
        description="Live board write access — incidents, complaints, and SLA breaches auto-created as Monday items"
        status={s.monday.status}
        open={s.monday.open}
        onToggle={() => toggle("monday")}
      >
        <div className="space-y-3">
          <div className="bg-info-bg border border-info-bdr rounded-lg p-3 text-[11px] text-info leading-relaxed">
            Monday.com is the source of truth for incidents and complaints (DEC-37).
            Livera writes items to Monday on creation; Monday status changes are not mirrored back to Livera in V1.1.
          </div>
          <FieldRow label="API key (V2)" sub="Personal API token or service-account key">
            <MaskedField value={`App-••••••••••••${s.monday.api_key_tail}`} />
          </FieldRow>
          <FieldRow label="Incidents board" sub="Board receives new incident rows">
            <div className="flex items-center gap-2">
              <input
                defaultValue={s.monday.incident_board}
                className="text-[12px] border border-bdr rounded-md px-2.5 py-1.5 bg-surface focus:outline-none focus:ring-1 focus:ring-brand w-40"
              />
              <a
                href={`https://primedpharmacy-company.monday.com/boards/${s.monday.incident_board}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Open
              </a>
            </div>
          </FieldRow>
          <FieldRow label="Complaints board" sub="Board receives new complaint rows">
            <div className="flex items-center gap-2">
              <input
                defaultValue={s.monday.complaints_board}
                className="text-[12px] border border-bdr rounded-md px-2.5 py-1.5 bg-surface focus:outline-none focus:ring-1 focus:ring-brand w-40"
              />
              <a
                href={`https://primedpharmacy-company.monday.com/boards/${s.monday.complaints_board}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Open
              </a>
            </div>
          </FieldRow>
          <FieldRow label="SLA breach board" sub="Board receives SLA breach alerts">
            <div className="flex items-center gap-2">
              <input
                defaultValue={s.monday.sla_breach_board}
                className="text-[12px] border border-bdr rounded-md px-2.5 py-1.5 bg-surface focus:outline-none focus:ring-1 focus:ring-brand w-40"
              />
              <a
                href={`https://primedpharmacy-company.monday.com/boards/${s.monday.sla_breach_board}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Open
              </a>
            </div>
          </FieldRow>
          <FieldRow label="Write operations" sub="Actions that trigger Monday writes">
            <div className="flex flex-col gap-1">
              {[
                { label: "Incident created",      status: "live"   },
                { label: "Complaint created",     status: "live"   },
                { label: "SLA breach detected",   status: "live"   },
                { label: "Incident status sync",  status: "v1.2"   },
                { label: "Complaint status sync", status: "v1.2"   },
              ].map((op) => (
                <div key={op.label} className="flex items-center gap-2 text-[11px]">
                  <span className={cn(
                    "font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide",
                    op.status === "live" ? "bg-ok-bg text-ok border border-ok-bdr" : "bg-page-bg text-t3 border border-bdr"
                  )}>
                    {op.status}
                  </span>
                  <span className="text-t2">{op.label}</span>
                </div>
              ))}
            </div>
          </FieldRow>
        </div>
        <div className="flex gap-2 pt-2 border-t border-bdr">
          <Button
            size="sm" variant="outline"
            onClick={() => testConnection("monday", "Monday.com")}
            disabled={testing === "monday"}
            className="h-8 text-[12px] gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", testing === "monday" && "animate-spin")} />
            {testing === "monday" ? "Testing…" : "Test connection"}
          </Button>
          <Button size="sm" variant="default" onClick={() => showToast("Monday.com settings saved")} className="h-8 text-[12px]">
            Save
          </Button>
        </div>
      </IntegrationCard>

    </div>
  );
}
