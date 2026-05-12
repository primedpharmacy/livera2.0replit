"use client";

/**
 * DeclineConfirmModal — BLD-6.3 (Wave 4).
 *
 * Replaces the inline decline dialog from OrderDecisionDialogs.
 * Requires a clinical note (min-chars gate) before allowing decline.
 * "AI Draft" button opens AINoteDraftingModal to pre-populate the textarea.
 *
 * On confirm: calls onDecline(body) → parent calls handleDecide("declined", body).
 */

import { useState } from "react";
import { XCircle, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AINoteDraftingModal, type AIDraftResult } from "@/components/clinical-notes/AINoteDraftingModal";
import type { Clinic, ClinicId } from "@/types";

interface DeclineConfirmModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  patientName: string;
  clinic: Clinic;
  clinicId: ClinicId;
  isSubmitting: boolean;
  onDecline: (clinicalNote: string, aiData?: Omit<AIDraftResult, "body">) => void;
}

export function DeclineConfirmModal({
  open,
  onClose,
  orderId,
  patientName,
  clinic,
  clinicId,
  isSubmitting,
  onDecline,
}: DeclineConfirmModalProps) {
  const [body, setBody]           = useState("");
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiMeta, setAiMeta]       = useState<Omit<AIDraftResult, "body"> | null>(null);

  const minChars = clinic.config.clinical_note_min_chars;
  const isValid  = body.length >= minChars;
  const charColour = isValid ? "text-ok" : "text-warn";

  function handleClose() {
    setBody("");
    setAiMeta(null);
    onClose();
  }

  function handleConfirm() {
    if (!isValid || isSubmitting) return;
    onDecline(body, aiMeta ?? undefined);
    setBody("");
    setAiMeta(null);
  }

  function handleAiSignOff(result: AIDraftResult) {
    setBody(result.body);
    setAiMeta({ ai_drafted: result.ai_drafted, ai_draft_original: result.ai_draft_original, prompt_version_id: result.prompt_version_id });
    setAiModalOpen(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-err" />
              <DialogTitle className="text-base">Decline Order</DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-[13px] text-t2">
              Provide a clinical rationale for declining{" "}
              <strong className="font-mono">{orderId}</strong> for{" "}
              <strong>{patientName}</strong>. This will be recorded in the patient's clinical record.
            </p>

            {aiMeta?.ai_drafted && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-brand-light border border-brand/20 text-[11px] text-brand font-medium">
                <Sparkles className="w-3 h-3 shrink-0" />
                AI-drafted note — reviewed and signed off by you.
              </div>
            )}

            <div>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Clinical rationale for declining this order…"
                rows={5}
                className="text-[13px]"
                disabled={isSubmitting}
              />
              <div className="flex items-center justify-between mt-1">
                <button
                  onClick={() => setAiModalOpen(true)}
                  className="flex items-center gap-1 text-[11px] text-brand hover:underline"
                  type="button"
                >
                  <Sparkles className="w-3 h-3" />
                  Use AI Draft
                </button>
                <span className={`text-[10px] ${charColour}`}>
                  {body.length} / {minChars} min chars{isValid ? " ✓" : ""}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-t3">
              Your prescriber ID is recorded in the audit trail. Once declined, the order cannot be reversed.
            </p>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!isValid || isSubmitting}
              variant="destructive"
            >
              {isSubmitting ? "Declining…" : "Confirm Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AINoteDraftingModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        context="decline"
        orderId={orderId}
        clinicId={clinicId}
        patientName={patientName}
        clinic={clinic}
        minChars={minChars}
        onSignOff={handleAiSignOff}
      />
    </>
  );
}
