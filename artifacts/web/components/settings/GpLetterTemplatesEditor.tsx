"use client";

/**
 * GpLetterTemplatesEditor — BLD-7.6 (Wave 5).
 *
 * Full CRUD UI for GP letter templates in the Settings → GP Letter Templates tab.
 * Permissions: Admin/Owner write; Prescriber read-only.
 *
 * 3-layer safety chain:
 *   Layer 1 (UI gate): Edit/Delete/Create buttons hidden if !canWrite.
 *   Layer 2 (server gate): enforced in fixture mutations.
 *   Layer 3 (audit log): [AUDIT] written by fixture mutations.
 *
 * Template fields:
 *   - name, category, description
 *   - email_body_template (sent by Postmark)
 *   - pdf_letter_template (rendered by pdfkit)
 *
 * Note: GPLetterTemplate has no created_at/updated_at in the V1.1 schema.
 */

import { useState } from "react";
import { Plus, Edit2, Trash2, FileText, X, ChevronDown, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createGPLetterTemplate,
  updateGPLetterTemplate,
  deleteGPLetterTemplate,
  CURRENT_USER,
} from "@/lib/api/mock";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { ClinicId, GPLetterTemplate, GpLetterTemplateCategory } from "@/types";

interface Props {
  clinicId:         ClinicId;
  initialTemplates: GPLetterTemplate[];
}

interface Toast { message: string; type: "ok" | "err" }

type FormState = {
  name:                string;
  category:            GpLetterTemplateCategory;
  description:         string;
  email_body_template: string;
  pdf_letter_template: string;
};

const EMPTY_FORM: FormState = {
  name:                "",
  category:            "initial_treatment",
  description:         "",
  email_body_template: "",
  pdf_letter_template: "",
};

const CATEGORY_LABELS: Record<GpLetterTemplateCategory, string> = {
  initial_treatment: "Initial Treatment",
  dose_change:       "Dose Change",
  safeguarding:      "Safeguarding",
  progress_update:   "Progress Update",
  adverse_event:     "Adverse Event",
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as GpLetterTemplateCategory[];

type ModalMode = "create" | "edit" | "preview";

export function GpLetterTemplatesEditor({ clinicId, initialTemplates }: Props) {
  const [templates, setTemplates] = useState<GPLetterTemplate[]>(initialTemplates);
  const [toast, setToast]         = useState<Toast | null>(null);
  const [modal, setModal]         = useState<{ mode: ModalMode; template?: GPLetterTemplate } | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"email" | "pdf">("email");

  const canWrite = can(CURRENT_USER, "write", "gp_letter_templates");

  function showToast(message: string, type: Toast["type"]) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setActiveTab("email");
    setModal({ mode: "create" });
  }

  function openEdit(tpl: GPLetterTemplate) {
    setForm({
      name:                tpl.name,
      category:            tpl.category,
      description:         tpl.description,
      email_body_template: tpl.email_body_template,
      pdf_letter_template: tpl.pdf_letter_template,
    });
    setActiveTab("email");
    setModal({ mode: "edit", template: tpl });
  }

  function openPreview(tpl: GPLetterTemplate) {
    setModal({ mode: "preview", template: tpl });
    setActiveTab("email");
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email_body_template.trim() || !form.pdf_letter_template.trim()) {
      showToast("Name, email template, and PDF template are required.", "err");
      return;
    }
    setSaving(true);
    try {
      if (modal?.mode === "create") {
        const tpl = await createGPLetterTemplate(clinicId, {
          name:                form.name.trim(),
          category:            form.category,
          description:         form.description.trim(),
          email_body_template: form.email_body_template.trim(),
          pdf_letter_template: form.pdf_letter_template.trim(),
        });
        setTemplates((prev) => [...prev, tpl]);
        showToast("Template created", "ok");
      } else if (modal?.mode === "edit" && modal.template) {
        const updated = await updateGPLetterTemplate(modal.template.id, {
          name:                form.name.trim(),
          category:            form.category,
          description:         form.description.trim(),
          email_body_template: form.email_body_template.trim(),
          pdf_letter_template: form.pdf_letter_template.trim(),
        });
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        showToast("Template updated", "ok");
      }
      setModal(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save", "err");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tplId: string) {
    setDeleting(tplId);
    try {
      await deleteGPLetterTemplate(tplId);
      setTemplates((prev) => prev.filter((t) => t.id !== tplId));
      showToast("Template deleted", "ok");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete", "err");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="relative px-6 py-5">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-[13px] font-medium shadow-lg text-white",
          toast.type === "ok" ? "bg-ok" : "bg-err"
        )}>
          {toast.message}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[13px] font-bold text-t1">GP Letter Templates</h2>
          <p className="text-[12px] text-t3 mt-0.5">
            Templates define the email body and PDF letter content sent to GPs.
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={openCreate} className="h-8 text-[12px] gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New template
          </Button>
        )}
      </div>

      {/* Template list */}
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-t3 border border-dashed border-bdr rounded-xl">
          <FileText className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-[13px]">No templates yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-bdr border border-bdr rounded-xl overflow-hidden bg-surface">
          {templates.map((tpl) => (
            <div key={tpl.id} className="flex items-start gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-t1">{tpl.name}</span>
                  <span className="text-[10px] font-bold px-2 py-px rounded-full bg-info-bg text-info border border-info-bdr">
                    {CATEGORY_LABELS[tpl.category] ?? tpl.category}
                  </span>
                  <span className="font-mono text-[10px] text-t3">{tpl.id}</span>
                </div>
                {tpl.description && (
                  <p className="text-[12px] text-t2 mt-0.5">{tpl.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => openPreview(tpl)}
                  className="p-1.5 rounded text-t3 hover:text-brand hover:bg-brand-light transition-colors"
                  title="Preview"
                >
                  <Eye className="w-4 h-4" />
                </button>
                {canWrite && (
                  <>
                    <button
                      onClick={() => openEdit(tpl)}
                      className="p-1.5 rounded text-t3 hover:text-brand hover:bg-brand-light transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(tpl.id)}
                      disabled={deleting === tpl.id}
                      className="p-1.5 rounded text-t3 hover:text-err hover:bg-err-bg transition-colors disabled:opacity-40"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal — Create / Edit / Preview */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-6">
          <div className="bg-surface border border-bdr rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-bdr shrink-0">
              <span className="text-[14px] font-bold text-t1">
                {modal.mode === "create"  ? "New template"
                : modal.mode === "edit"   ? "Edit template"
                : "Preview template"}
              </span>
              <button onClick={() => setModal(null)} className="text-t3 hover:text-t1 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {modal.mode === "preview" && modal.template ? (
                <>
                  <div>
                    <p className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-1">Name</p>
                    <p className="text-[13px] text-t1 font-medium">{modal.template.name}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-1">Category</p>
                    <p className="text-[13px] text-t1">{CATEGORY_LABELS[modal.template.category] ?? modal.template.category}</p>
                  </div>
                  {modal.template.description && (
                    <div>
                      <p className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-1">Description</p>
                      <p className="text-[13px] text-t2">{modal.template.description}</p>
                    </div>
                  )}
                  <div>
                    <div className="flex gap-0 border-b border-bdr mb-3">
                      {(["email", "pdf"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setActiveTab(t)}
                          className={cn(
                            "px-4 py-2 text-[12px] font-semibold border-b-2 -mb-px transition-colors",
                            activeTab === t ? "border-brand text-brand" : "border-transparent text-t2 hover:text-t1"
                          )}
                        >
                          {t === "email" ? "Email body" : "PDF letter"}
                        </button>
                      ))}
                    </div>
                    <pre className="text-[12px] text-t1 whitespace-pre-wrap font-sans leading-relaxed bg-page-bg border border-bdr rounded-lg px-4 py-3">
                      {activeTab === "email"
                        ? modal.template.email_body_template
                        : modal.template.pdf_letter_template}
                    </pre>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">Name</label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2 text-[13px] border border-bdr rounded-lg bg-page-bg text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        placeholder="e.g. Treatment commencement"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">Category</label>
                      <div className="relative">
                        <select
                          value={form.category}
                          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as GpLetterTemplateCategory }))}
                          className="w-full appearance-none pl-3 pr-8 py-2 text-[13px] border border-bdr rounded-lg bg-page-bg text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t3 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">Description</label>
                    <input
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full px-3 py-2 text-[13px] border border-bdr rounded-lg bg-page-bg text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                      placeholder="Brief description of when to use this template"
                    />
                  </div>

                  <div>
                    <div className="flex gap-0 border-b border-bdr mb-3">
                      {(["email", "pdf"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setActiveTab(t)}
                          className={cn(
                            "px-4 py-2 text-[12px] font-semibold border-b-2 -mb-px transition-colors",
                            activeTab === t ? "border-brand text-brand" : "border-transparent text-t2 hover:text-t1"
                          )}
                        >
                          {t === "email" ? "Email body template" : "PDF letter template"}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-t3 mb-1.5">
                      Variables: <span className="font-mono">{"{{patient_name}} {{gp_name}} {{clinic_name}} {{medication}} {{dose}} {{today_date}} {{prescriber_name}}"}</span>
                    </p>
                    <textarea
                      value={activeTab === "email" ? form.email_body_template : form.pdf_letter_template}
                      onChange={(e) =>
                        setForm((f) =>
                          activeTab === "email"
                            ? { ...f, email_body_template: e.target.value }
                            : { ...f, pdf_letter_template: e.target.value }
                        )
                      }
                      rows={10}
                      className="w-full px-3 py-2 text-[12px] font-mono border border-bdr rounded-lg bg-page-bg text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand resize-none leading-relaxed"
                      placeholder={activeTab === "email"
                        ? "Dear {{gp_name}},\n\nI am writing to notify you…"
                        : "Dear {{gp_name}},\n\nFormal letter content…"}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-bdr bg-page-bg rounded-b-xl shrink-0">
              <Button variant="outline" size="sm" onClick={() => setModal(null)} className="h-8 text-[12px]">
                {modal.mode === "preview" ? "Close" : "Cancel"}
              </Button>
              {modal.mode !== "preview" && (
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !form.name.trim() || !form.email_body_template.trim() || !form.pdf_letter_template.trim()}
                  className="h-8 text-[12px]"
                >
                  {saving ? "Saving…" : modal.mode === "create" ? "Create template" : "Save changes"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
