"use client";

/**
 * ReplyEmailEditor — Task-161.
 *
 * Edit the outbound reply-to email address used on patient comms.
 * Admin/Owner only (gate enforced inside updateClinicReplyEmail).
 *
 * 3-layer safety chain on save:
 *   Layer 1 (UI): client-side validation; disabled until dirty+valid; rollback on error
 *   Layer 2 (server): updateClinicReplyEmail re-validates + checks permission
 *   Layer 3 (audit): [AUDIT] old → new written inside updateClinicReplyEmail
 */

import { useState } from "react";
import { Mail, Save, RotateCcw } from "lucide-react";
import { updateClinicReplyEmail } from "@/lib/api/mock";
import type { ClinicConfig, ClinicId } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  config:   ClinicConfig;
  clinicId: ClinicId;
  actorId:  string;
}

export function ReplyEmailEditor({ config, clinicId, actorId }: Props) {
  const [value, setValue]       = useState(config.reply_email);
  const [baseline, setBaseline] = useState(config.reply_email);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const trimmed    = value.trim();
  const dirty      = trimmed !== baseline;
  const localValid = trimmed.length > 0 && EMAIL_RE.test(trimmed);

  async function handleSave() {
    if (!dirty || saving) return;
    if (!localValid) {
      setError(trimmed.length === 0 ? "Email address is required" : "Enter a valid email address");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateClinicReplyEmail(clinicId, trimmed, actorId);
      setValue(trimmed);
      setBaseline(trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setValue(baseline);
      setError(err instanceof Error ? err.message : "Save failed — please retry");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setValue(baseline);
    setError(null);
    setSaved(false);
  }

  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
        <Mail className="w-3.5 h-3.5 text-brand" />
        <h2 className="text-[11px] font-bold text-t2 uppercase tracking-wider">
          Outbound patient comms
        </h2>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div>
          <label htmlFor="reply-email" className="block text-[13px] font-semibold text-t1">
            Reply-to email
          </label>
          <p className="text-[11px] text-t3 mt-0.5 leading-snug">
            The address patients reply to when they receive emails from this clinic.
            Use a shared inbox, a cover address, or a distribution list. Changes take
            effect immediately for subsequent outbound emails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="reply-email"
            type="email"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); setSaved(false); }}
            disabled={saving}
            placeholder="hello@your-clinic.health"
            className="flex-1 text-[13px] text-t1 border border-bdr bg-page-bg rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:opacity-50"
          />
        </div>

        {error && (
          <p className="text-[12px] text-err">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          {dirty && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-t2 border border-bdr rounded-md hover:bg-page-bg transition-colors disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || !localValid || saving}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-brand hover:bg-brand/90 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" /> {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
