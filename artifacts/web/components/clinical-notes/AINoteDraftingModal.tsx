"use client";

/**
 * AINoteDraftingModal — BLD-6.2 (Wave 4).
 *
 * Feature-flagged by clinic.config.features.ai_clinical_note_drafting_enabled
 * AND LIVERA_AI_NOTE_DRAFTING_LIVE (env).
 *
 * When env flag=false: shows deterministic stub draft (no API call).
 * When env flag=true: calls Anthropic via lib/integrations/anthropic.ts.
 *
 * GOVERNANCE: Prompt sign-off (BLD-6.5) MUST precede live wiring.
 *
 * Used by:
 *   - DeclineConfirmModal (BLD-6.3)
 *   - InterventionConfirmModal (BLD-6.3)
 *   - (future) ApproveModal when AI drafting replaces manual note entry
 */

import { useState, useEffect } from "react";
import { Sparkles, AlertTriangle, RotateCcw, ClipboardCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AIDraftContext } from "@/lib/integrations/anthropic";
import type { Clinic } from "@/types";

export interface AIDraftResult {
  body: string;
  ai_drafted: boolean;
  ai_draft_original: string | null;
  prompt_version_id: string | null;
}

interface AINoteDraftingModalProps {
  open: boolean;
  onClose: () => void;
  context: AIDraftContext;
  orderId: string;
  clinicId: string;
  patientName: string;
  clinic: Clinic;
  minChars: number;
  onSignOff: (result: AIDraftResult) => void;
}

const CONTEXT_LABELS: Record<AIDraftContext, string> = {
  approve:       "Approval Note",
  decline:       "Decline Rationale",
  intervention:  "Query / Intervention Note",
};

const CONTEXT_DESCRIPTIONS: Record<AIDraftContext, string> = {
  approve:       "AI has drafted an approval note based on the patient's questionnaire and clinical data. Review, edit, and sign off.",
  decline:       "AI has drafted a decline rationale. Review carefully — this will be recorded in the patient's clinical record.",
  intervention:  "AI has drafted a query note for this intervention. Specify the information needed from the patient.",
};

export function AINoteDraftingModal({
  open,
  onClose,
  context,
  orderId,
  clinicId,
  patientName,
  clinic,
  minChars,
  onSignOff,
}: AINoteDraftingModalProps) {
  const [body, setBody]               = useState("");
  const [isLoading, setIsLoading]     = useState(false);
  const [draftOriginal, setDraftOriginal] = useState<string | null>(null);
  const [promptVersion, setPromptVersion] = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [isStub, setIsStub]           = useState(false);

  const aiEnabled = clinic.config.features.ai_clinical_note_drafting_enabled;

  useEffect(() => {
    if (open && aiEnabled) {
      void loadDraft();
    } else if (open && !aiEnabled) {
      setBody("");
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadDraft() {
    setIsLoading(true);
    setError(null);
    setBody("");
    setDraftOriginal(null);
    try {
      const { generateClinicalNoteDraft } = await import("@/lib/integrations/anthropic");
      const result = await generateClinicalNoteDraft({
        context,
        order_id: orderId,
        // TODO (DEFERRED BLD-6.2): replace hardcoded stubs with real patient context
        // pulled from the order detail payload (age_years, sex_at_birth, bmi,
        // weight_kg, baseline_weight_kg, product, questionnaire_summary, g6_flags).
        // Requires OrderDetailClient to pass a PatientContext prop into this modal.
        patient_summary: {
          full_name: patientName,
          age_years: 0,
          sex_at_birth: "—",
          bmi: 0,
          weight_kg: 0,
          baseline_weight_kg: 0,
        },
        product: { medication: "—", dose: "—", type: "reorder" },
        questionnaire_summary: "See questionnaire tab for full responses.",
        g6_flags: [],
      });
      setBody(result.draft);
      setDraftOriginal(result.draft);
      setPromptVersion(result.prompt_version_id);
      setIsStub(result.is_stub);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI draft failed. You can write a note manually.");
    } finally {
      setIsLoading(false);
    }
  }

  const isValid    = body.length >= minChars;
  const charColour = isValid ? "text-ok" : "text-warn";

  function handleSignOff() {
    if (!isValid) return;
    onSignOff({
      body,
      ai_drafted: aiEnabled && draftOriginal !== null,
      ai_draft_original: draftOriginal,
      prompt_version_id: promptVersion,
    });
    setBody("");
    setDraftOriginal(null);
  }

  function handleClose() {
    setBody("");
    setDraftOriginal(null);
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand" />
            <DialogTitle className="text-base">AI Note Drafting — {CONTEXT_LABELS[context]}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {/* Context description */}
          <p className="text-[12px] text-t2">
            {CONTEXT_DESCRIPTIONS[context]}{" "}
            <span className="font-mono text-t3">#{orderId}</span>
          </p>

          {/* Stub badge */}
          {isStub && !isLoading && !error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-warn-bg border border-warn-bdr">
              <AlertTriangle className="w-3.5 h-3.5 text-warn shrink-0" />
              <p className="text-[11px] text-warn">
                Development stub — prompt sign-off pending (BLD-6.5). Replace with real AI output after Qadir approval.
              </p>
            </div>
          )}

          {/* AI disabled notice */}
          {!aiEnabled && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-page-bg border border-bdr">
              <Sparkles className="w-3.5 h-3.5 text-t3 shrink-0" />
              <p className="text-[11px] text-t3">
                AI note drafting is not enabled for this clinic. Write your note manually below.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-err-bg border border-err-bdr">
              <AlertTriangle className="w-3.5 h-3.5 text-err shrink-0" />
              <p className="text-[11px] text-err">{error}</p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-brand-light border border-bdr">
              <Sparkles className="w-3.5 h-3.5 text-brand animate-pulse shrink-0" />
              <p className="text-[11px] text-brand">Generating AI draft…</p>
            </div>
          )}

          {/* Note textarea */}
          <div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={isLoading ? "Generating draft…" : "Clinical note body…"}
              rows={8}
              className="text-[13px] font-mono"
              disabled={isLoading}
            />
            <div className={`mt-1 text-[10px] text-right ${charColour}`}>
              {body.length} / {minChars} min chars{isValid ? " ✓" : ""}
            </div>
          </div>

          {/* Governance notice */}
          <p className="text-[10px] text-t3">
            Your name and prescriber ID will be recorded against this note.
            The original AI draft and all edits are stored in the audit trail (DEC-07).
          </p>
        </div>

        <DialogFooter className="gap-2 mt-2 flex-wrap">
          {aiEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={loadDraft}
              disabled={isLoading}
              className="gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Regenerate
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSignOff}
            disabled={!isValid || isLoading}
            className="gap-1.5"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Sign off
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
