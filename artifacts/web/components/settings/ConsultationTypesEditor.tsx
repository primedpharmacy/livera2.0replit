"use client";

/**
 * ConsultationTypesEditor — BLD-CONS-SETTINGS-01
 *
 * Lets clinic Owners configure the consultation type catalogue:
 * name, modality, provider, default duration, eligible roles,
 * DPIA reference, and Calendly event type ID.
 *
 * State is local (mock) — persists within the session only.
 * welcomecall type is always present and cannot be deleted (DEC-34).
 */

import { useState } from "react";
import {
  Phone, Video, MessageSquare, Plus, Trash2, Check,
  ChevronDown, ChevronUp, Shield, Calendar, Clock, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConsultationTypeConfig, ClinicConfig, Role } from "@/types";

const ALL_ROLES: Role[] = ["Owner", "Admin", "Prescriber", "Coach"];

const MODALITY_ICONS: Record<ConsultationTypeConfig["modality"], React.ElementType> = {
  phone: Phone,
  video: Video,
  chat:  MessageSquare,
};

const MODALITY_STYLES: Record<ConsultationTypeConfig["modality"], string> = {
  phone: "bg-blue-50 text-blue-700 border border-blue-200",
  video: "bg-purple-50 text-purple-700 border border-purple-200",
  chat:  "bg-ok-bg text-ok border border-ok-bdr",
};

const PROVIDER_OPTIONS: { value: string; label: string; modality: ConsultationTypeConfig["modality"] }[] = [
  { value: "intercom_phone",       label: "Intercom Phone",         modality: "phone" },
  { value: "calendly+google_meet", label: "Calendly + Google Meet", modality: "video" },
  { value: "zoom",                 label: "Zoom",                   modality: "video" },
  { value: "teams",                label: "Microsoft Teams",        modality: "video" },
  { value: "intercom_chat",        label: "Intercom Chat",          modality: "chat"  },
];

function generateId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

interface EditorProps {
  config: ClinicConfig;
  clinicId: string;
}

export function ConsultationTypesEditor({ config }: EditorProps) {
  const [types, setTypes]       = useState<ConsultationTypeConfig[]>(config.consultation_types);
  const [expandedId, setExpId]  = useState<string | null>(null);
  const [adding, setAdding]     = useState(false);
  const [saved, setSaved]       = useState<Record<string, boolean>>({});
  const [toast, setToast]       = useState<string | null>(null);

  // Draft for currently-expanded / new type
  const [draft, setDraft] = useState<Partial<ConsultationTypeConfig>>({});

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function openEdit(type: ConsultationTypeConfig) {
    if (expandedId === type.id) { setExpId(null); return; }
    setAdding(false);
    setExpId(type.id);
    setDraft({ ...type });
  }

  function openNew() {
    setExpId(null);
    setAdding(true);
    setDraft({
      id:                    "",
      name:                  "",
      modality:              "phone",
      provider:              "intercom_phone",
      default_duration_min:  30,
      eligible_roles:        [],
      dpia_reference:        null,
      calendly_event_type_id: null,
    });
  }

  function toggleRole(role: Role) {
    const current = draft.eligible_roles ?? [];
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    setDraft((d) => ({ ...d, eligible_roles: next }));
  }

  function saveEdit() {
    if (!draft.id || !draft.name) return;
    setTypes((prev) =>
      prev.map((t) => (t.id === draft.id ? (draft as ConsultationTypeConfig) : t))
    );
    setSaved((s) => ({ ...s, [draft.id!]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [draft.id!]: false })), 2500);
    setExpId(null);
    showToast(`"${draft.name}" saved`);
  }

  function saveNew() {
    if (!draft.name?.trim()) return;
    const id = generateId(draft.name);
    const newType: ConsultationTypeConfig = {
      id,
      name:                  draft.name.trim(),
      modality:              draft.modality ?? "phone",
      provider:              draft.provider ?? "intercom_phone",
      default_duration_min:  draft.default_duration_min ?? 30,
      eligible_roles:        draft.eligible_roles ?? [],
      dpia_reference:        draft.dpia_reference ?? null,
      calendly_event_type_id: draft.calendly_event_type_id ?? null,
    };
    setTypes((prev) => [...prev, newType]);
    setAdding(false);
    setDraft({});
    showToast(`"${newType.name}" added`);
  }

  function deleteType(id: string) {
    setTypes((prev) => prev.filter((t) => t.id !== id));
    if (expandedId === id) setExpId(null);
    showToast("Consultation type removed");
  }

  return (
    <div className="space-y-4 relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-[12px] font-semibold shadow-lg bg-ok text-white flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />
          {toast}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-t1">Consultation types</h2>
          <p className="text-[12px] text-t3 mt-0.5">
            {types.length} type{types.length !== 1 ? "s" : ""} configured ·{" "}
            Welcome Call is always present (DEC-34)
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold bg-brand text-white"
        >
          <Plus className="w-3.5 h-3.5" />
          Add type
        </button>
      </div>

      {/* Type list */}
      <div className="bg-surface border border-bdr rounded-lg overflow-hidden divide-y divide-bdr">
        {types.map((type) => {
          const isExpanded = expandedId === type.id;
          const isSaved    = saved[type.id];
          const Icon       = MODALITY_ICONS[type.modality];
          const isLocked   = type.id === "welcome_call";

          return (
            <div key={type.id}>
              {/* Row summary */}
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-page-bg/40 transition-colors",
                  isExpanded && "bg-brand/5"
                )}
                onClick={() => openEdit(type)}
              >
                {/* Modality icon */}
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  MODALITY_STYLES[type.modality]
                )}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-t1 truncate">
                      {type.name}
                    </span>
                    {isLocked && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-ok-bg text-ok border border-ok-bdr uppercase tracking-wide">
                        Required
                      </span>
                    )}
                    {isSaved && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-ok-bg text-ok border border-ok-bdr flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Saved
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-t3 flex-wrap">
                    <span className={cn(
                      "text-[9.5px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                      MODALITY_STYLES[type.modality]
                    )}>
                      {type.modality}
                    </span>
                    <span>·</span>
                    <span>{type.provider}</span>
                    <span>·</span>
                    <span>{type.default_duration_min} min</span>
                    {type.eligible_roles.length > 0 && (
                      <>
                        <span>·</span>
                        <span>{type.eligible_roles.join(", ")}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {!isLocked && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteType(type.id); }}
                      className="p-1.5 rounded hover:bg-err-bg text-t3 hover:text-err transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-t3" />
                    : <ChevronDown className="w-4 h-4 text-t3" />
                  }
                </div>
              </div>

              {/* Expanded edit form */}
              {isExpanded && (
                <TypeForm
                  draft={draft}
                  setDraft={setDraft}
                  onSave={saveEdit}
                  onCancel={() => setExpId(null)}
                  toggleRole={toggleRole}
                  isNew={false}
                />
              )}
            </div>
          );
        })}

        {/* Empty */}
        {types.length === 0 && (
          <div className="flex flex-col items-center py-12 text-t3">
            <Clock className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-[13px]">No consultation types configured.</p>
          </div>
        )}
      </div>

      {/* New type form */}
      {adding && (
        <div className="bg-surface border border-brand/30 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-brand/5 border-b border-brand/20 flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 text-brand" />
            <span className="text-[12px] font-bold text-brand">New consultation type</span>
          </div>
          <TypeForm
            draft={draft}
            setDraft={setDraft}
            onSave={saveNew}
            onCancel={() => setAdding(false)}
            toggleRole={toggleRole}
            isNew
          />
        </div>
      )}

      {/* Governance note */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-info-bg border border-info-bdr text-[11px] text-info">
        <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Changes to consultation types take effect immediately.
          Ensure DPIA references are set for any type involving patient data processing under UK GDPR Art 35.
          DEC-34: Welcome Call cannot be disabled — it is required for all clinics.
        </span>
      </div>
    </div>
  );
}

// ── Shared form ───────────────────────────────────────────────────────────────

interface TypeFormProps {
  draft:     Partial<ConsultationTypeConfig>;
  setDraft:  React.Dispatch<React.SetStateAction<Partial<ConsultationTypeConfig>>>;
  onSave:    () => void;
  onCancel:  () => void;
  toggleRole: (role: Role) => void;
  isNew:     boolean;
}

function TypeForm({ draft, setDraft, onSave, onCancel, toggleRole, isNew }: TypeFormProps) {
  const filteredProviders = PROVIDER_OPTIONS.filter(
    (p) => !draft.modality || p.modality === draft.modality
  );
  const needsCalendly = draft.provider?.startsWith("calendly");
  const canSave = !!(draft.name?.trim()) &&
    (draft.eligible_roles?.length ?? 0) > 0;

  return (
    <div className="px-4 py-4 space-y-4 bg-page-bg/30">
      {/* Row 1: Name + modality */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Display name" required>
          <input
            type="text"
            value={draft.name ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Clinical Consultation"
            className="w-full text-[12px] px-3 py-2 border border-bdr rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
        </Field>

        <Field label="Modality">
          <div className="flex gap-2">
            {(["phone", "video", "chat"] as ConsultationTypeConfig["modality"][]).map((m) => {
              const Ic = MODALITY_ICONS[m];
              const active = draft.modality === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    const firstProvider = PROVIDER_OPTIONS.find((p) => p.modality === m)?.value ?? "";
                    setDraft((d) => ({ ...d, modality: m, provider: firstProvider }));
                  }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md border text-[11px] font-semibold capitalize transition-colors",
                    active ? MODALITY_STYLES[m] + " ring-2 ring-offset-1 ring-brand/40" : "border-bdr text-t2 hover:bg-page-bg"
                  )}
                >
                  <Ic className="w-3.5 h-3.5" />
                  {m}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      {/* Row 2: Provider + duration */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Provider / platform">
          <select
            value={draft.provider ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, provider: e.target.value }))}
            className="w-full text-[12px] px-3 py-2 border border-bdr rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            {filteredProviders.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Default duration">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              max={120}
              step={5}
              value={draft.default_duration_min ?? 30}
              onChange={(e) => setDraft((d) => ({ ...d, default_duration_min: parseInt(e.target.value) }))}
              className="w-full text-[12px] px-3 py-2 border border-bdr rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <span className="text-[12px] text-t3 shrink-0">min</span>
          </div>
        </Field>
      </div>

      {/* Row 3: Eligible roles */}
      <Field label="Eligible roles" required hint="Who can conduct this consultation type">
        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map((role) => {
            const selected = draft.eligible_roles?.includes(role) ?? false;
            return (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-semibold transition-colors",
                  selected
                    ? "bg-brand text-white border-brand"
                    : "border-bdr text-t2 hover:bg-page-bg"
                )}
              >
                <Users className="w-3 h-3" />
                {role}
                {selected && <Check className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Row 4: DPIA ref + Calendly */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="DPIA reference" hint="UK GDPR Art 35 — required if processing special category data">
          <input
            type="text"
            value={draft.dpia_reference ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, dpia_reference: e.target.value || null }))}
            placeholder="e.g. DPIA-2026-001"
            className="w-full text-[12px] px-3 py-2 border border-bdr rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-brand/30 font-mono"
          />
        </Field>

        <Field
          label="Calendly event type ID"
          hint={needsCalendly ? "Required for Calendly provider" : "Not used for this provider"}
        >
          <input
            type="text"
            value={draft.calendly_event_type_id ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, calendly_event_type_id: e.target.value || null }))}
            placeholder="e.g. evt_clinical"
            disabled={!needsCalendly}
            className={cn(
              "w-full text-[12px] px-3 py-2 border border-bdr rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-brand/30 font-mono",
              !needsCalendly && "opacity-40 cursor-not-allowed"
            )}
          />
          {needsCalendly && (
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-brand">
              <Calendar className="w-3 h-3" />
              Find your event type IDs in the Calendly developer dashboard.
            </div>
          )}
        </Field>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-bdr">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md text-[12px] font-semibold border border-bdr bg-surface text-t2 hover:bg-page-bg"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold bg-brand text-white disabled:opacity-40"
        >
          <Check className="w-3.5 h-3.5" />
          {isNew ? "Add consultation type" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-t3 uppercase tracking-wider block">
        {label}
        {required && <span className="text-err ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-t3">{hint}</p>}
    </div>
  );
}
