"use client";

/**
 * MHRA gov.uk drug-device-alerts settings — BLD-INT-MHRA-01 (DEC-39)
 *
 * Daily poll of gov.uk/drug-device-alerts · matched alerts auto-create
 * Intercom conversations tagged `mhra_alert` · CQC Reg 17 + GPhC Standard 1
 * governance evidence.
 *
 * Tabs: Overview · Drug watchlist · Severity routing · Recipients · Alert log
 */

import { useState } from "react";
import { ExternalLink, CheckCircle2, AlertCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { use } from "react";

type Params = Promise<{ clinic_id: string }>;

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey = "overview" | "watchlist" | "routing" | "recipients" | "log";

// ── Mock data ─────────────────────────────────────────────────────────────────

const WATCHLIST_DRUGS = [
  { name: "Mounjaro",     ingredient: "tirzepatide",         locked: true,  note: "Auto-watchlisted · in clinic_config.products · 1 alert match (30d)", blackTriangle: true  },
  { name: "Wegovy",       ingredient: "semaglutide",         locked: true,  note: "Auto-watchlisted · in clinic_config.products · 1 alert match (30d)", blackTriangle: true  },
  { name: "Saxenda",      ingredient: "liraglutide",         locked: false, note: "Watchlisted manually · 0 alert matches (30d)",                       blackTriangle: false },
  { name: "Ozempic",      ingredient: "semaglutide",         locked: false, note: "Watchlisted manually · brand alias for semaglutide · 1 alert match (30d)", blackTriangle: false },
  { name: "FlexPen / KwikPen / Cartridge devices", ingredient: "injection devices", locked: false, note: "Device watchlist · catches FSNs even when active ingredient not named · 0 matches (30d)", blackTriangle: false },
];

type SevClass = "c1" | "c2" | "c3" | "c4" | "dsu";

const ROUTING_ROWS: { cls: SevClass; label: string; desc: string; actions: { kind: "incident" | "task" | "notify" | "audit"; label: string }[]; locked: boolean }[] = [
  {
    cls: "c1", label: "Class 1 recall",
    desc: "Action now · life-threatening or serious health risk · immediate quarantine of affected stock",
    actions: [{ kind: "incident", label: "Create incident" }, { kind: "task", label: "Task to RM (4h SLA)" }, { kind: "notify", label: "Notify all recipients" }, { kind: "audit", label: "AUD-04" }],
    locked: true,
  },
  {
    cls: "c2", label: "Class 2 recall",
    desc: "Action within 48h · significant risk · stop using affected stock pending review",
    actions: [{ kind: "incident", label: "Create incident" }, { kind: "task", label: "Task to RM (24h SLA)" }, { kind: "notify", label: "Notify all recipients" }, { kind: "audit", label: "AUD-04" }],
    locked: true,
  },
  {
    cls: "c3", label: "Class 3 recall",
    desc: "Action within 5 days · low risk · advisory recall, return existing stock at convenience",
    actions: [{ kind: "task", label: "Task to RM (5d SLA)" }, { kind: "notify", label: "Notify all recipients" }, { kind: "audit", label: "AUD-04" }],
    locked: false,
  },
  {
    cls: "c4", label: "Class 4 caution",
    desc: "Caution in use · informational only · update procedures or labelling",
    actions: [{ kind: "task", label: "Task to RM (10d SLA)" }, { kind: "notify", label: "Notify clinical roles only" }, { kind: "audit", label: "AUD-04" }],
    locked: false,
  },
  {
    cls: "dsu", label: "Drug Safety Update",
    desc: "Monthly safety bulletin · prescribing advice update · no immediate stock action",
    actions: [{ kind: "notify", label: "Notify clinical roles only" }, { kind: "audit", label: "AUD-04" }],
    locked: false,
  },
  {
    cls: "dsu", label: "Field Safety Notice",
    desc: "Manufacturer-issued device notice · check FSN-specific instructions",
    actions: [{ kind: "task", label: "Task to RM (5d SLA)" }, { kind: "notify", label: "Notify all recipients" }, { kind: "audit", label: "AUD-04" }],
    locked: false,
  },
];

const SEV_STYLES: Record<SevClass, string> = {
  c1:  "bg-err-bg text-err border border-err-bdr",
  c2:  "bg-orange-50 text-orange-700 border border-orange-200",
  c3:  "bg-warn-bg text-warn border border-warn-bdr",
  c4:  "bg-info-bg text-info border border-info-bdr",
  dsu: "bg-page-bg text-t2 border border-bdr",
};

const ACTION_STYLES: Record<string, string> = {
  incident: "bg-err-bg text-err",
  task:     "bg-brand/10 text-brand",
  notify:   "bg-info-bg text-info",
  audit:    "bg-purple-50 text-purple-700",
};

const RECIPIENTS = [
  { role: "Owner",                   count: "1 person · Qadir Hussain",        active: true  },
  { role: "RM",                      count: "1 person · Qadir Hussain (acting)", active: true  },
  { role: "Prescriber",              count: "3 people · pharmacy IPs (VSC)",   active: true  },
  { role: "Superintendent Pharmacist", count: "1 person · Shahid Mahmood",     active: true  },
  { role: "Admin",                   count: "2 people · Punam, Shannon",        active: false },
  { role: "Coach",                   count: "0 people · FeelTru only",          active: false },
];

const ALERT_LOG = [
  { date: "10 May 04:01", title: "GLP-1 receptor agonists: reports of vision changes — additional monitoring required", ref: "MHRA/2026/04/30/DSU · semaglutide · tirzepatide · liraglutide", cls: "dsu" as SevClass, match: "3 watchlist hits", routed: true  },
  { date: "02 May 04:01", title: "Tirzepatide (Mounjaro): report of severe pancreatitis cases · enhanced monitoring",  ref: "MHRA/2026/04/02/DSU · tirzepatide",                               cls: "dsu" as SevClass, match: "Mounjaro / tirzepatide", routed: true  },
  { date: "28 Apr 04:01", title: "FlexPen injection device — needle attachment guidance update",                       ref: "MHRA/2026/04/28/FSN · injection device",                          cls: "c4"  as SevClass, match: "Device watchlist", routed: true  },
  { date: "22 Apr 04:01", title: "Recall of paracetamol 500mg tablets — batch L24891 · particulate contamination",    ref: "MHRA/2026/04/22/CMDh · paracetamol",                              cls: "c2"  as SevClass, match: "—",          routed: false },
  { date: "18 Apr 04:01", title: "Ibuprofen 400mg — batch recall (cosmetic labelling error)",                         ref: "MHRA/2026/04/18/FSN · ibuprofen",                                 cls: "c3"  as SevClass, match: "—",          routed: false },
  { date: "12 Apr 04:01", title: "Ozempic (semaglutide) pen — dose-button defect in specific batches",                ref: "MHRA/2026/04/12/C3 · semaglutide · Ozempic",                      cls: "c3"  as SevClass, match: "Ozempic / semaglutide", routed: true  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function MhraAlertsSettingsPage({ params }: { params: Params }) {
  const { clinic_id } = use(params);
  void clinic_id;

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [saving, setSaving] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pollingDone, setPollingDone] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [newDrug, setNewDrug] = useState("");
  const [watchlist, setWatchlist] = useState(WATCHLIST_DRUGS);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 700));
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 3000);
    showToast("MHRA alert settings saved");
  }

  async function handlePoll() {
    setPolling(true);
    await new Promise((r) => setTimeout(r, 1500));
    setPolling(false);
    setPollingDone(true);
    showToast("Poll complete · processed 4 entries · 0 matched · 4 skipped");
  }

  function handleAddDrug(e: React.FormEvent) {
    e.preventDefault();
    if (!newDrug.trim()) return;
    setWatchlist((prev) => [...prev, {
      name: newDrug.trim(),
      ingredient: "",
      locked: false,
      note: "Watchlisted manually · 0 alert matches (30d)",
      blackTriangle: false,
    }]);
    setNewDrug("");
    showToast(`Added "${newDrug.trim()}" to watchlist`);
  }

  const TABS: { key: TabKey; label: string; badge?: string }[] = [
    { key: "overview",    label: "Overview" },
    { key: "watchlist",   label: "Drug watchlist", badge: String(watchlist.length) },
    { key: "routing",     label: "Severity routing" },
    { key: "recipients",  label: "Recipients" },
    { key: "log",         label: "Alert log", badge: "30d" },
  ];

  return (
    <div className="relative p-6 space-y-4 max-w-4xl">

      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg bg-ok text-white">
          {toast}
        </div>
      )}

      {/* Page header */}
      <div className="flex items-start gap-4 pb-4 border-b border-bdr">
        <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center shrink-0 text-white text-[9px] font-black leading-tight text-center">
          GOV<br />UK
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[16px] font-bold text-t1">MHRA gov.uk alerts</h2>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-ok-bg text-ok border border-ok-bdr tracking-wide">BLD-INT-MHRA-01</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-ok-bg text-ok border border-ok-bdr">
              <span className="w-1.5 h-1.5 rounded-full bg-ok" />
              Polling
            </span>
          </div>
          <p className="text-[12px] text-t2 mt-1 leading-relaxed">
            Daily poll of{" "}
            <a href="https://www.gov.uk/drug-device-alerts" target="_blank" rel="noopener noreferrer" className="text-brand font-semibold hover:underline inline-flex items-center gap-0.5">
              gov.uk/drug-device-alerts <ExternalLink className="w-3 h-3" />
            </a>
            {" "}· matched alerts auto-create Intercom conversations tagged{" "}
            <code className="text-[11px] bg-page-bg border border-bdr rounded px-1 py-px font-mono">mhra_alert</code>
            {" "}· CQC Reg 17 + GPhC Standard 1 governance evidence · DEC-39
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={handlePoll} disabled={polling} className="h-8 text-[12px] gap-1.5">
            {polling ? "Polling…" : pollingDone ? "✓ Polled" : "Run poll now"}
          </Button>
          <Button size="sm" variant="default" onClick={handleSave} disabled={saving} className="h-8 text-[12px]">
            {saving ? "Saving…" : savedOk ? "✓ Saved" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-bdr -mx-6 px-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors",
              activeTab === tab.key
                ? "border-brand text-brand"
                : "border-transparent text-t2 hover:text-t1"
            )}
          >
            {tab.label}
            {tab.badge && (
              <span className={cn(
                "ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded",
                activeTab === tab.key ? "bg-brand/10 text-brand" : "bg-page-bg text-t3"
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview ───────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { num: "14", cls: "text-ok",   label: "Alerts processed (30d)", sub: "All matched alerts routed successfully" },
              { num: "3",  cls: "text-warn",  label: "Matched, routed (30d)",  sub: "Tirzepatide DSU · Semaglutide FSN · Pen recall (Class 4)" },
              { num: "11", cls: "text-t1",   label: "Skipped (no match)",     sub: "Alerts about non-watchlisted medicines/devices" },
              { num: "04:00", cls: "text-t1", label: "Daily poll time",        sub: "UTC · last poll 10 May 04:01:18 BST · next 11 May 04:00" },
            ].map((s) => (
              <div key={s.label} className="bg-surface border border-bdr rounded-lg p-3">
                <p className={cn("text-[24px] font-bold leading-tight font-mono", s.cls)}>{s.num}</p>
                <p className="text-[10px] uppercase tracking-wider font-bold text-t3 mt-1">{s.label}</p>
                <p className="text-[11px] text-t2 mt-1 leading-relaxed">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Connection status */}
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-page-bg border-b border-bdr">
              <h3 className="text-[12px] font-bold text-t1">Connection status</h3>
            </div>
            <div className="p-4 grid grid-cols-[180px_1fr] gap-x-4 gap-y-3 text-[12px]">
              {[
                { label: "Feed source", sub: "Read-only · platform-locked", value: <code className="text-[11px] bg-page-bg border border-bdr rounded px-1.5 py-0.5 font-mono">https://www.gov.uk/drug-device-alerts.atom</code> },
                { label: "Polling cadence", sub: "Cron schedule", value: (
                  <select className="text-[12px] border border-bdr rounded-md px-2.5 py-1.5 bg-surface focus:outline-none focus:ring-1 focus:ring-brand">
                    <option>Daily at 04:00 UTC (recommended)</option>
                    <option>Twice daily (04:00 and 16:00 UTC)</option>
                    <option>Hourly (high-vigilance — Class 1/2 recall periods)</option>
                  </select>
                )},
                { label: "Status", sub: "Last successful poll", value: <span className="font-mono text-ok font-semibold text-[11px]">✓ 10 May 2026 04:01:18 BST · processed 6 entries · 1 matched · 5 skipped</span> },
                { label: "Etag tracking", sub: "Avoid duplicate processing", value: (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-brand" />
                    <span className="text-t2">Use feed Etag + Last-Modified to skip unchanged polls</span>
                  </label>
                )},
                { label: "Failure alert", sub: "If poll fails N consecutive times", value: (
                  <select className="text-[12px] border border-bdr rounded-md px-2.5 py-1.5 bg-surface focus:outline-none focus:ring-1 focus:ring-brand">
                    <option value="1">1 failure → notify Owner immediately</option>
                    <option value="2">2 consecutive failures → notify Owner + RM</option>
                    <option value="3">3 consecutive failures → escalate to incident</option>
                  </select>
                )},
              ].map((row, i) => (
                <div key={i} className="contents">
                  <div>
                    <p className="font-semibold text-t2">{row.label}</p>
                    {row.sub && <p className="text-[11px] text-t3 mt-0.5">{row.sub}</p>}
                  </div>
                  <div className="flex items-center">{row.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sources monitored */}
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-page-bg border-b border-bdr flex items-center justify-between">
              <h3 className="text-[12px] font-bold text-t1">Sources monitored</h3>
              <span className="text-[11px] text-t3">Future-extensible to additional regulatory feeds</span>
            </div>
            <div className="p-4 grid grid-cols-[180px_1fr] gap-x-4 gap-y-3 text-[12px]">
              {[
                { label: "MHRA Drug & Device Alerts", sub: "gov.uk/drug-device-alerts", checked: true,  desc: "Active · primary feed" },
                { label: "MHRA Drug Safety Update",   sub: "Monthly bulletin · gov.uk/drug-safety-update", checked: false, desc: "Inactive · queued for V1.2.1" },
                { label: "Field Safety Notices (FSN)", sub: "Medical device-specific · gov.uk/field-safety-notices", checked: false, desc: "Inactive · queued for V1.2.1" },
                { label: "DHSC supply issues",         sub: "Medicine supply notifications", checked: false, desc: "Inactive · routes to Primed sync if enabled" },
              ].map((src) => (
                <div key={src.label} className="contents">
                  <div>
                    <p className="font-semibold text-t2">{src.label}</p>
                    <p className="text-[11px] text-t3 mt-0.5">{src.sub}</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked={src.checked} className="accent-brand" />
                    <span className="text-t2">{src.desc}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Info notice */}
          <div className="bg-info-bg border border-info-bdr rounded-lg p-4 flex gap-3 text-[12px] text-info leading-relaxed">
            <span className="text-[18px] shrink-0">ℹ</span>
            <div>
              <p className="font-bold text-[#1e3a8a] mb-1">How matching works</p>
              gov.uk publishes alert text containing medicine names. The matcher extracts tokens from the alert title and body, then checks against the per-clinic drug watchlist. A match creates an Intercom conversation tagged{" "}
              <code className="text-[11px] bg-info/10 px-1 rounded font-mono">mhra_alert</code>
              {" "}routing through the standard tag-action rule. No match = silent skip with audit log entry.
            </div>
          </div>
        </div>
      )}

      {/* ── Drug watchlist ─────────────────────────────────────────────────── */}
      {activeTab === "watchlist" && (
        <div className="space-y-4">
          <div className="bg-info-bg border border-info-bdr rounded-lg p-4 flex gap-3 text-[12px] text-info">
            <span className="text-[18px] shrink-0">💊</span>
            <div>
              <p className="font-bold text-[#1e3a8a] mb-0.5">Pre-populated from clinic product catalogue</p>
              On clinic onboarding, the watchlist is auto-seeded from the medicines configured in{" "}
              <code className="text-[11px] bg-info/10 px-1 rounded font-mono">clinic_config.products</code>.
              {" "}Removing a watchlisted medicine does not retroactively delete past alerts — only future polls are affected.
            </div>
          </div>

          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-page-bg border-b border-bdr flex items-center justify-between">
              <h3 className="text-[12px] font-bold text-t1">Watchlisted medicines · {watchlist.length} active</h3>
              <span className="text-[11px] text-t3">Match against alert title + body (active ingredient OR brand)</span>
            </div>
            <div className="p-4 space-y-2">
              {watchlist.map((drug, i) => (
                <div key={i} className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg border",
                  drug.locked ? "bg-warn-bg/30 border-warn-bdr/40" : "bg-page-bg border-bdr/70"
                )}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-t1">{drug.name}</span>
                      {drug.ingredient && (
                        <code className="text-[11px] text-t2 font-mono">{drug.ingredient}</code>
                      )}
                      {drug.blackTriangle && (
                        <span className="text-[9px] font-bold bg-err text-white px-1.5 py-0.5 rounded uppercase">▼ Black Triangle</span>
                      )}
                    </div>
                    <p className="text-[11px] text-t3 mt-0.5">{drug.note}</p>
                  </div>
                  <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-brand" />
                    <span className="text-[11px] text-t2">Monitoring</span>
                  </label>
                </div>
              ))}

              {/* Add drug */}
              <form onSubmit={handleAddDrug} className="flex gap-2 mt-3 pt-3 border-t border-bdr">
                <input
                  type="text"
                  value={newDrug}
                  onChange={(e) => setNewDrug(e.target.value)}
                  placeholder="Add medicine — brand or active ingredient (e.g. Rybelsus, dulaglutide)"
                  className="flex-1 text-[12px] border border-bdr rounded-md px-2.5 py-2 bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                />
                <Button type="submit" size="sm" variant="default" className="h-9 text-[12px] shrink-0">
                  Add to watchlist
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Severity routing ───────────────────────────────────────────────── */}
      {activeTab === "routing" && (
        <div className="space-y-4">
          <div className="bg-warn-bg border border-warn-bdr rounded-lg p-4 flex gap-3 text-[12px] text-warn">
            <Shield className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-orange-900 mb-0.5">DEC-36 protected</p>
              The <code className="text-[11px] bg-warn/10 px-1 rounded font-mono">mhra_alert</code> tag-action rule cannot be disabled — only configured. Disabling notifications or removing recipient roles is not permitted; at least one notification recipient is always required.
            </div>
          </div>

          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-page-bg border-b border-bdr flex items-center justify-between">
              <h3 className="text-[12px] font-bold text-t1">Routing by alert classification</h3>
              <span className="text-[11px] text-t3">MHRA classification taxonomy</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-bdr bg-page-bg">
                    <th className="text-left text-[11px] font-bold text-t3 px-4 py-2.5">Classification</th>
                    <th className="text-left text-[11px] font-bold text-t3 px-4 py-2.5">Description</th>
                    <th className="text-left text-[11px] font-bold text-t3 px-4 py-2.5 w-[280px]">Actions triggered</th>
                    <th className="text-left text-[11px] font-bold text-t3 px-4 py-2.5 w-[60px]">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr">
                  {ROUTING_ROWS.map((row, i) => (
                    <tr key={i} className="hover:bg-page-bg/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={cn("text-[11px] font-bold px-2 py-1 rounded-full inline-block", SEV_STYLES[row.cls])}>
                          {row.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-t2 leading-relaxed max-w-[220px]">{row.desc}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.actions.map((a, j) => (
                            <span key={j} className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", ACTION_STYLES[a.kind])}>
                              {a.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input type="checkbox" defaultChecked disabled={row.locked} className="accent-brand" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Recipients ─────────────────────────────────────────────────────── */}
      {activeTab === "recipients" && (
        <div className="space-y-4">
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-page-bg border-b border-bdr flex items-center justify-between">
              <h3 className="text-[12px] font-bold text-t1">Notification recipients by role</h3>
              <span className="text-[11px] text-t3">Roles auto-tagged on the Intercom conversation</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-4 gap-3">
                {RECIPIENTS.map((r) => (
                  <div key={r.role} className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-colors",
                    r.active ? "bg-brand/5 border-brand text-brand" : "bg-page-bg border-bdr text-t1"
                  )}>
                    <p className="text-[12px] font-bold">
                      {r.active && "✓ "}{r.role}
                    </p>
                    <p className="text-[11px] text-t2 mt-0.5">{r.count}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-t3 mt-4 leading-relaxed">
                Selected roles are auto-tagged on every{" "}
                <code className="text-[11px] bg-page-bg border border-bdr rounded px-1 font-mono">mhra_alert</code>-tagged
                Intercom conversation. The conversation can be assigned to a single individual for accountability — assignment defaults to RM.
              </p>
            </div>
          </div>

          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-page-bg border-b border-bdr flex items-center justify-between">
              <h3 className="text-[12px] font-bold text-t1">Acknowledgement requirements</h3>
              <span className="text-[11px] text-t3">CQC Reg 17 evidence trail</span>
            </div>
            <div className="p-4 grid grid-cols-[200px_1fr] gap-x-4 gap-y-4 text-[12px]">
              {[
                { label: "RM acknowledgement", sub: "Required for Class 1, 2, 3 + FSN", desc: "RM must acknowledge alert receipt within configured SLA · failure escalates to Owner" },
                { label: "Cascade-to-staff confirmation", sub: "RM confirms team is informed", desc: "RM ticks confirmation in Intercom conversation when team has been briefed" },
                { label: "CQC evidence pack", sub: "Auto-attach to AUD-04", desc: "Original alert + acknowledgement timestamps + cascade confirmation written to AUD-04 governance log" },
              ].map((row) => (
                <div key={row.label} className="contents">
                  <div>
                    <p className="font-semibold text-t2">{row.label}</p>
                    <p className="text-[11px] text-t3 mt-0.5">{row.sub}</p>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-brand mt-0.5 shrink-0" />
                    <span className="text-t2">{row.desc}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Alert log ──────────────────────────────────────────────────────── */}
      {activeTab === "log" && (
        <div className="space-y-4">
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-page-bg border-b border-bdr flex items-center justify-between">
              <h3 className="text-[12px] font-bold text-t1">Alerts processed · last 30 days</h3>
              <span className="text-[11px] text-t3">Showing {ALERT_LOG.length} of 14 entries</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-bdr bg-page-bg">
                    {["Polled at", "Alert", "Class", "Match", "Status"].map((h) => (
                      <th key={h} className="text-left text-[11px] font-bold text-t3 px-4 py-2.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr">
                  {ALERT_LOG.map((row, i) => (
                    <tr key={i} className="hover:bg-page-bg/50 transition-colors">
                      <td className="px-4 py-3 text-t2 whitespace-nowrap font-mono text-[11px]">{row.date}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-t1 leading-snug">{row.title}</p>
                        <p className="text-[11px] text-t3 font-mono mt-0.5">{row.ref}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border inline-block", SEV_STYLES[row.cls])}>
                          {row.cls.toUpperCase().replace("DSU", "DSU")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.routed ? (
                          <span className="text-ok font-semibold">{row.match}</span>
                        ) : (
                          <span className="text-t3">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                          row.routed
                            ? "bg-ok-bg text-ok border-ok-bdr"
                            : "bg-page-bg text-t3 border-bdr"
                        )}>
                          {row.routed ? "✓ Routed" : "Skipped"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
