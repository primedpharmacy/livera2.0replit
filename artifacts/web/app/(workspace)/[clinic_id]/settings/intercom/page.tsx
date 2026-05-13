"use client";

/**
 * Intercom webhook configuration settings — BLD-8.2 + BLD-INT-MHRA-02
 *
 * BLD-8.2: Endpoint URL · signing secret · HMAC-SHA256 verification ·
 *          IP allowlist · idempotency · event subscriptions
 * BLD-INT-MHRA-02: Per-label classifier thresholds — the MHRA tag-action
 *                  configuration that drives incident creation from
 *                  Intercom conversations.
 */

import { useState } from "react";
import {
  CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff,
  Copy, Zap, Shield, Activity, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { use } from "react";

type Params = Promise<{ clinic_id: string }>;

// ── Classifier threshold config (BLD-INT-MHRA-02) ───────────────────────────
type ClassifierLabel = {
  label: string;
  display: string;
  threshold: number;
  defaultSeverity: "mild" | "moderate" | "severe";
  incidentType: string;
};

const DEFAULT_THRESHOLDS: ClassifierLabel[] = [
  { label: "severe_se",        display: "severe_se",        threshold: 0.70, defaultSeverity: "severe",   incidentType: "Side effect — severe"        },
  { label: "allergic_symptom", display: "allergic_symptom", threshold: 0.80, defaultSeverity: "moderate", incidentType: "Allergy / adverse reaction"   },
  { label: "safeguarding",     display: "safeguarding",     threshold: 0.65, defaultSeverity: "severe",   incidentType: "Safeguarding"                },
  { label: "moderate_se",      display: "moderate_se",      threshold: 0.85, defaultSeverity: "moderate", incidentType: "Side effect — moderate"       },
  { label: "dosing_concern",   display: "dosing_concern",   threshold: 0.80, defaultSeverity: "mild",     incidentType: "Dosing concern"              },
];

// ── Event subscriptions ──────────────────────────────────────────────────────
const EVENT_SUBSCRIPTIONS = [
  { topic: "conversation.user.created",   active: true,  note: "Primary trigger — patient starts a new conversation"                            },
  { topic: "conversation.user.replied",   active: true,  note: "Patient follow-up — re-evaluated by classifier in case symptoms escalate"        },
  { topic: "conversation.admin.assigned", active: true,  note: "Conversation reassigned — syncs metadata so closure lock survives handover"      },
  { topic: "conversation.admin.closed",   active: true,  note: "Agent attempts to close — Livera intercepts and enforces BLD-8.4 closure rule"   },
  { topic: "conversation.admin.replied",  active: false, note: "Not subscribed — adds noise without action value"                                },
  { topic: "conversation.admin.snoozed",  active: false, note: "Not subscribed — snooze ≠ close, no clinical impact"                            },
];

// ── Recent activity (mock) ───────────────────────────────────────────────────
const RECENT_ACTIVITY = [
  { time: "14:33:02 today",   topic: "conversation.user.created",   summary: "IC-29481 · classifier=allergic_symptom 0.86 → INC-00347 created", kind: "incident", ms: 238 },
  { time: "14:33:02 today",   topic: "conversation.user.created",   summary: "IC-29481 · idempotent re-delivery (X-Intercom-Delivery-Id matched)",    kind: "dedup",    ms: 12  },
  { time: "14:36:14 today",   topic: "conversation.user.replied",   summary: "IC-29481 · classifier=allergic_symptom 0.71 (below threshold) → no incident", kind: "below",    ms: 94  },
  { time: "11:18:41 today",   topic: "conversation.user.created",   summary: "IC-29478 · classifier=order_question 0.92 (not subscribed label) → no incident", kind: "label",    ms: 87  },
  { time: "29 Apr · 16:42",   topic: "conversation.admin.closed",   summary: "IC-29472 · attempt blocked · INC-00342 still open · returned 423",          kind: "blocked",  ms: 41  },
  { time: "28 Apr · 09:14",   topic: "conversation.user.created",   summary: "IC-29465 · classifier=severe_se 0.78 → INC-00339 created · pager fired",    kind: "incident", ms: 312 },
];

const KIND_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  incident: { bg: "bg-ok-bg",   text: "text-ok",   label: "INCIDENT" },
  dedup:    { bg: "bg-info-bg", text: "text-info",  label: "DEDUP"    },
  below:    { bg: "bg-surface", text: "text-t3",    label: "BELOW"    },
  label:    { bg: "bg-surface", text: "text-t3",    label: "LABEL"    },
  blocked:  { bg: "bg-err-bg",  text: "text-err",   label: "BLOCKED"  },
};

const SEV_STYLES: Record<string, string> = {
  mild:     "bg-info-bg text-info",
  moderate: "bg-warn-bg text-warn",
  severe:   "bg-err-bg text-err",
};

export default function IntercomSettingsPage({ params }: { params: Params }) {
  const { clinic_id } = use(params);
  const workspaceId = clinic_id === "feeltru" ? "app_feeltru_h7k29x" : "app_vsc_k4m71r";
  const endpointUrl = `https://api.livera.health/v1/webhooks/intercom/${clinic_id}`;

  const [thresholds, setThresholds] = useState<ClassifierLabel[]>(DEFAULT_THRESHOLDS);
  const [secretVisible, setSecretVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function handleCopy() {
    navigator.clipboard.writeText(endpointUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 3000);
    showToast("Classifier thresholds saved");
    console.log("[AUDIT]", { action: "intercom.classifier_thresholds_updated", clinic_id, user: "user_qadir", thresholds });
  }

  async function handleTest() {
    setTesting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setTesting(false);
    showToast("Test webhook delivered — 200 OK in 94ms");
  }

  function updateThreshold(label: string, value: number) {
    setThresholds((prev) =>
      prev.map((t) => (t.label === label ? { ...t, threshold: Math.min(1, Math.max(0, value)) } : t))
    );
  }

  return (
    <div className="relative p-6 space-y-5 max-w-3xl">

      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg bg-ok text-white">
          {toast}
        </div>
      )}

      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-t1">Intercom · Webhook configuration</h2>
          <p className="text-[12px] text-t2 mt-0.5">
            BLD-8.2 · BLD-INT-MHRA-02 · per-workspace · changes affect incident creation immediately
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleTest} disabled={testing} className="h-8 text-[12px] gap-1.5">
            <Zap className={cn("w-3.5 h-3.5", testing && "animate-pulse")} />
            {testing ? "Testing…" : "Test webhook"}
          </Button>
          <Button size="sm" variant="default" onClick={handleSave} disabled={saving} className="h-8 text-[12px] gap-1.5">
            {saving ? "Saving…" : savedOk ? "✓ Saved" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* Webhook status banner */}
      <div className="bg-ok-bg border border-ok-bdr rounded-lg p-4 flex items-start gap-3">
        <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px] font-bold text-ok">Webhook is live and verified</span>
            <span className="text-[11px] bg-ok/10 text-ok px-2 py-0.5 rounded-full font-semibold">99.7% success</span>
          </div>
          <p className="text-[12px] text-t2">
            Last successful delivery 14:33 today · 12 incidents auto-created from Intercom in the past 30 days · 0 signature failures · 1 idempotent re-delivery (deduplicated)
          </p>
        </div>
      </div>

      {/* Endpoint configuration */}
      <div className="bg-surface border border-bdr rounded-lg p-4 space-y-4">
        <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3">Endpoint configuration</h3>

        <div>
          <label className="block text-[11px] text-t3 mb-1.5">Endpoint URL</label>
          <p className="text-[11px] text-t3 mb-1.5">Configured in Intercom Developer Hub · this is the URL Intercom POSTs to</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[12px] bg-page-bg border border-bdr rounded px-3 py-2 font-mono text-t1 truncate">
              {endpointUrl}
            </code>
            <Button size="sm" variant="outline" onClick={handleCopy} className="h-8 text-[12px] shrink-0 gap-1.5">
              <Copy className="w-3.5 h-3.5" />
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] text-t3 mb-1.5">Workspace identifier</label>
            <p className="text-[11px] text-t3 mb-1.5">Intercom App ID · used to look up the correct tenant on receipt</p>
            <code className="block text-[12px] bg-page-bg border border-bdr rounded px-3 py-2 font-mono text-t1">
              {workspaceId}
            </code>
          </div>
          <div>
            <label className="block text-[11px] text-t3 mb-1.5">Signing secret</label>
            <p className="text-[11px] text-t3 mb-1.5">Shared with Intercom · verifies X-Hub-Signature-256 header</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[12px] bg-page-bg border border-bdr rounded px-3 py-2 font-mono text-t1 truncate">
                {secretVisible ? "whsec_a7f3b2c9d1e84f6a2b3c9d1e8a2f1c" : "whsec_••••••••••••••••••••••••8a2f1c"}
              </code>
              <Button size="sm" variant="ghost" onClick={() => setSecretVisible(!secretVisible)} className="h-8 w-8 p-0 shrink-0">
                {secretVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-[11px] shrink-0 gap-1 text-t2">
                <RefreshCw className="w-3 h-3" /> Rotate
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-surface border border-bdr rounded-lg p-4 space-y-3">
        <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3">Security</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Shield, label: "Signature verification", detail: "HMAC-SHA256 · Last 30d: 0 rejected", status: "Active" },
            { icon: RefreshCw, label: "Idempotency", detail: "Keyed by X-Intercom-Delivery-Id · 24h window · Last 30d: 1 dedup", status: "Enabled" },
            { icon: Shield, label: "IP allowlist", detail: "Intercom egress CIDRs · refreshes daily", status: "Enforced" },
          ].map((item) => (
            <div key={item.label} className="bg-ok-bg border border-ok-bdr rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-ok" />
                <span className="text-[11px] font-semibold text-ok">{item.status}</span>
              </div>
              <p className="text-[12px] font-medium text-t1 mb-0.5">{item.label}</p>
              <p className="text-[11px] text-t2">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Event subscriptions */}
      <div className="bg-surface border border-bdr rounded-lg p-4 space-y-3">
        <div>
          <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-0.5">Event subscriptions</h3>
          <p className="text-[12px] text-t2">
            These gate which events Intercom sends. The handler only creates an incident if the classifier threshold is also met.
          </p>
        </div>
        <div className="divide-y divide-bdr">
          {EVENT_SUBSCRIPTIONS.map((ev) => (
            <div key={ev.topic} className="flex items-start gap-3 py-2.5">
              <div className={cn(
                "mt-0.5 w-4 h-4 rounded shrink-0 flex items-center justify-center",
                ev.active ? "bg-ok" : "bg-t3/20"
              )}>
                {ev.active && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <code className={cn("text-[12px] font-mono font-semibold", ev.active ? "text-t1" : "text-t3")}>
                  {ev.topic}
                </code>
                <p className="text-[11px] text-t2 mt-0.5">{ev.note}</p>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5",
                ev.active ? "bg-ok/10 text-ok" : "bg-t3/10 text-t3"
              )}>
                {ev.active ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* BLD-INT-MHRA-02 — Classifier thresholds */}
      <div className="bg-surface border border-bdr rounded-lg p-4 space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3">Classifier thresholds</h3>
            <span className="text-[10px] bg-warn-bg text-warn px-1.5 py-0.5 rounded font-semibold">BLD-INT-MHRA-02</span>
          </div>
          <p className="text-[12px] text-t2">
            Webhook handler only creates an incident when classifier confidence ≥ threshold for the matched label.
            Below threshold → conversation flows normally to support. Configurable per workspace.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-bdr">
                <th className="text-left text-[11px] font-bold text-t3 pb-2 pr-4">Classifier label</th>
                <th className="text-left text-[11px] font-bold text-t3 pb-2 pr-4">Threshold</th>
                <th className="text-left text-[11px] font-bold text-t3 pb-2 pr-4">Default severity</th>
                <th className="text-left text-[11px] font-bold text-t3 pb-2">Maps to incident type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bdr">
              {thresholds.map((t) => (
                <tr key={t.label} className="hover:bg-page-bg/50 transition-colors">
                  <td className="py-2.5 pr-4">
                    <code className="font-mono text-t1 font-semibold bg-page-bg px-1.5 py-0.5 rounded text-[11px]">
                      {t.display}
                    </code>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-t1 font-semibold w-8">≥ {t.threshold.toFixed(2)}</span>
                      <input
                        type="range"
                        min="0.5"
                        max="0.99"
                        step="0.01"
                        value={t.threshold}
                        onChange={(e) => updateThreshold(t.label, parseFloat(e.target.value))}
                        className="w-24 h-1.5 accent-brand cursor-pointer"
                      />
                    </div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={cn(
                      "text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize",
                      SEV_STYLES[t.defaultSeverity]
                    )}>
                      {t.defaultSeverity}
                    </span>
                  </td>
                  <td className="py-2.5 text-t2">{t.incidentType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-t3">
          Adjust thresholds with care — lower values increase sensitivity and may increase false-positive incident creation.
          All threshold changes are audit-logged.
        </p>
      </div>

      {/* Recent webhook activity */}
      <div className="bg-surface border border-bdr rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3">Recent webhook activity</h3>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] text-t2 gap-1">
            <Activity className="w-3 h-3" /> View all
          </Button>
        </div>
        <div className="divide-y divide-bdr">
          {RECENT_ACTIVITY.map((ev, i) => {
            const style = KIND_STYLES[ev.kind] ?? KIND_STYLES.below;
            return (
              <div key={i} className="flex items-start gap-3 py-2.5">
                <div className="shrink-0 text-right w-32">
                  <p className="text-[11px] text-t3">{ev.time}</p>
                  <p className="text-[10px] text-t3 mt-0.5">{ev.ms}ms</p>
                </div>
                <div className="flex-1 min-w-0">
                  <code className="text-[11px] font-mono text-t2">{ev.topic}</code>
                  <p className="text-[12px] text-t1 mt-0.5 leading-relaxed">{ev.summary}</p>
                </div>
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5",
                  style.bg, style.text
                )}>
                  {style.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payload reference */}
      <div className="bg-surface border border-bdr rounded-lg p-4">
        <button
          className="flex items-center gap-2 w-full text-left group"
          onClick={() => {}}
        >
          <ChevronRight className="w-4 h-4 text-t3 group-hover:text-t1 transition-colors" />
          <h3 className="text-[12px] font-semibold text-t2 group-hover:text-t1 transition-colors">
            Reference · webhook payload shape
          </h3>
          <span className="text-[11px] text-t3 ml-auto">For Yohan · BLD-8.3 handler</span>
        </button>
      </div>

    </div>
  );
}
