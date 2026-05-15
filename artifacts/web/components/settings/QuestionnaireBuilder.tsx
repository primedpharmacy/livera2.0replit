"use client";

/**
 * QuestionnaireBuilder — BLD-13.4
 *
 * Drag-and-drop style editor for per-clinic questionnaire questions.
 * Used in Settings → Questionnaire for both order + reorder questionnaires.
 * Changes are local-state (mock persistence) — backend wiring is Chunk 13.
 */

import { useState, useId } from "react";
import {
  ChevronUp, ChevronDown, Trash2, Plus, GripVertical,
  ToggleLeft, Type, Hash, List, BarChart3, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuestionItem, QuestionType, ClinicId } from "@/types";

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<QuestionType, {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  cls: string;
  placeholder: string;
}> = {
  text:   { label: "Free text",  Icon: Type,       cls: "bg-brand/10 text-brand",          placeholder: "e.g. Please describe your experience…" },
  yes_no: { label: "Yes / No",   Icon: ToggleLeft,  cls: "bg-ok-bg text-ok",                placeholder: "" },
  scale:  { label: "Scale",      Icon: BarChart3,   cls: "bg-purple-50 text-purple-700",    placeholder: "e.g. How would you rate your progress? (1–10)" },
  number: { label: "Number",     Icon: Hash,        cls: "bg-warn-bg text-warn",            placeholder: "e.g. Enter your current weight in kg" },
  choice: { label: "Multi-choice", Icon: List,      cls: "bg-info-bg text-info",            placeholder: "e.g. Which condition applies to you?" },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: QuestionType }) {
  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.Icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border", cfg.cls)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function QuestionRow({
  q,
  idx,
  total,
  onMove,
  onToggleRequired,
  onDelete,
}: {
  q: QuestionItem;
  idx: number;
  total: number;
  onMove: (idx: number, dir: "up" | "down") => void;
  onToggleRequired: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 bg-surface border border-bdr rounded-lg group">
      <GripVertical className="w-4 h-4 text-t3 mt-0.5 shrink-0 cursor-grab" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-semibold text-t1">{q.label}</span>
          <TypeBadge type={q.type} />
          {q.required && (
            <span className="text-[9px] font-bold text-err bg-err-bg border border-err-bdr px-1.5 py-0.5 rounded uppercase tracking-wide">
              Required
            </span>
          )}
        </div>
        {q.placeholder && (
          <p className="text-[11px] text-t3 mt-0.5 italic">{q.placeholder}</p>
        )}
        {q.help_text && (
          <p className="text-[11px] text-t2 mt-0.5">{q.help_text}</p>
        )}
        {q.type === "choice" && q.options && (
          <div className="flex gap-1 flex-wrap mt-1">
            {q.options.map((o) => (
              <span key={o} className="text-[10px] bg-page-bg border border-bdr rounded px-1.5 py-0.5 text-t2">
                {o}
              </span>
            ))}
          </div>
        )}
        {q.type === "scale" && (
          <p className="text-[11px] text-t3 mt-0.5">
            Scale {q.scale_min ?? 1} – {q.scale_max ?? 10}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          title="Required toggle"
          onClick={() => onToggleRequired(q.id)}
          className={cn(
            "text-[10px] px-1.5 py-1 rounded border transition-colors",
            q.required
              ? "border-err-bdr bg-err-bg text-err"
              : "border-bdr bg-page-bg text-t3 hover:text-t1"
          )}
        >
          {q.required ? "Required" : "Optional"}
        </button>
        <button
          title="Move up"
          disabled={idx === 0}
          onClick={() => onMove(idx, "up")}
          className="p-1 rounded border border-bdr bg-page-bg text-t2 hover:text-t1 disabled:opacity-30"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          title="Move down"
          disabled={idx === total - 1}
          onClick={() => onMove(idx, "down")}
          className="p-1 rounded border border-bdr bg-page-bg text-t2 hover:text-t1 disabled:opacity-30"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          title="Delete"
          onClick={() => onDelete(q.id)}
          className="p-1 rounded border border-bdr bg-page-bg text-err hover:bg-err-bg"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function AddQuestionForm({ onAdd }: { onAdd: (q: Omit<QuestionItem, "id" | "order">) => void }) {
  const uid = useId();
  const [label, setLabel]       = useState("");
  const [type, setType]         = useState<QuestionType>("text");
  const [required, setRequired] = useState(false);
  const [helpText, setHelpText] = useState("");
  const [options, setOptions]   = useState("");
  const [open, setOpen]         = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    onAdd({
      label: label.trim(),
      type,
      required,
      help_text: helpText.trim() || undefined,
      placeholder: TYPE_CONFIG[type].placeholder || undefined,
      options: type === "choice" ? options.split("\n").map((s) => s.trim()).filter(Boolean) : undefined,
      scale_min: type === "scale" ? 1 : undefined,
      scale_max: type === "scale" ? 10 : undefined,
    });
    setLabel(""); setType("text"); setRequired(false); setHelpText(""); setOptions(""); setOpen(false);
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="h-8 text-[12px] gap-1.5 w-full mt-2">
        <Plus className="w-3.5 h-3.5" /> Add question
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 p-3 bg-brand/[0.03] border border-brand/20 rounded-lg space-y-3">
      <p className="text-[11px] font-bold text-brand uppercase tracking-wide">New question</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${uid}-label`} className="block text-[11px] font-semibold text-t2 mb-1">Question text</label>
          <input
            id={`${uid}-label`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. What is your current weight?"
            className="w-full text-[12px] border border-bdr rounded-md px-2.5 py-1.5 bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label htmlFor={`${uid}-type`} className="block text-[11px] font-semibold text-t2 mb-1">Answer type</label>
          <select
            id={`${uid}-type`}
            value={type}
            onChange={(e) => setType(e.target.value as QuestionType)}
            className="w-full text-[12px] border border-bdr rounded-md px-2.5 py-1.5 bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {(Object.keys(TYPE_CONFIG) as QuestionType[]).map((t) => (
              <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={`${uid}-help`} className="block text-[11px] font-semibold text-t2 mb-1">Help text (optional)</label>
        <input
          id={`${uid}-help`}
          value={helpText}
          onChange={(e) => setHelpText(e.target.value)}
          placeholder="Brief description shown below the question"
          className="w-full text-[12px] border border-bdr rounded-md px-2.5 py-1.5 bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>
      {type === "choice" && (
        <div>
          <label htmlFor={`${uid}-opts`} className="block text-[11px] font-semibold text-t2 mb-1">Options (one per line)</label>
          <textarea
            id={`${uid}-opts`}
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            rows={3}
            placeholder={"Option A\nOption B\nNone of the above"}
            className="w-full text-[12px] border border-bdr rounded-md px-2.5 py-1.5 bg-surface focus:outline-none focus:ring-1 focus:ring-brand resize-none"
          />
        </div>
      )}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="accent-brand" />
          <span className="text-[12px] text-t2">Required</span>
        </label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)} className="h-8 text-[12px]">Cancel</Button>
          <Button type="submit" size="sm" variant="default" disabled={!label.trim()} className="h-8 text-[12px]">Add question</Button>
        </div>
      </div>
    </form>
  );
}

// ── Main builder ───────────────────────────────────────────────────────────────

function QuestionList({
  title,
  subtitle,
  initial,
  onSave,
}: {
  title: string;
  subtitle: string;
  initial: QuestionItem[];
  onSave: (qs: QuestionItem[]) => void;
}) {
  const [questions, setQuestions] = useState<QuestionItem[]>(initial);
  const [saved, setSaved] = useState(false);

  function move(idx: number, dir: "up" | "down") {
    setQuestions((prev) => {
      const next = [...prev];
      const swap = dir === "up" ? idx - 1 : idx + 1;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((q, i) => ({ ...q, order: i + 1 }));
    });
  }

  function toggleRequired(id: string) {
    setQuestions((prev) => prev.map((q) => q.id === id ? { ...q, required: !q.required } : q));
  }

  function deleteQ(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id).map((q, i) => ({ ...q, order: i + 1 })));
  }

  function addQ(partial: Omit<QuestionItem, "id" | "order">) {
    setQuestions((prev) => [
      ...prev,
      { ...partial, id: `q_${Date.now()}`, order: prev.length + 1 },
    ]);
  }

  async function handleSave() {
    onSave(questions);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-page-bg border-b border-bdr flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-bold text-t1">{title}</h3>
          <p className="text-[11px] text-t3 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-t3">{questions.length} question{questions.length !== 1 ? "s" : ""}</span>
          <Button size="sm" variant="default" onClick={handleSave} className="h-8 text-[12px] gap-1.5">
            {saved ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved</> : "Save changes"}
          </Button>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {questions.length === 0 && (
          <p className="text-[12px] text-t3 text-center py-4">No questions yet — add your first below.</p>
        )}
        {questions.map((q, idx) => (
          <QuestionRow
            key={q.id}
            q={q}
            idx={idx}
            total={questions.length}
            onMove={move}
            onToggleRequired={toggleRequired}
            onDelete={deleteQ}
          />
        ))}
        <AddQuestionForm onAdd={addQ} />
      </div>
    </div>
  );
}

// ── Exported component ─────────────────────────────────────────────────────────

interface Props {
  clinicId: ClinicId;
  orderQuestionnaire: QuestionItem[];
  reorderQuestionnaire: QuestionItem[];
}

export function QuestionnaireBuilder({ clinicId, orderQuestionnaire, reorderQuestionnaire }: Props) {
  void clinicId;

  return (
    <div className="space-y-6">
      <div className="bg-info-bg border border-info-bdr rounded-lg p-4 text-[12px] text-info leading-relaxed">
        <p className="font-bold text-[#1e3a8a] mb-0.5">Per-clinic questionnaire configuration · BLD-13.4</p>
        Questions are shown to patients during registration (order questionnaire) or when re-ordering (reorder questionnaire).
        Responses feed clinical flag rules in the Clinical Check queue.
        Changes take effect on the next patient session — existing responses are unaffected.
      </div>

      <QuestionList
        title="Order questionnaire"
        subtitle="Shown to new patients completing their first order"
        initial={orderQuestionnaire}
        onSave={(qs) => console.log("Save order questionnaire", qs)}
      />

      <QuestionList
        title="Reorder questionnaire"
        subtitle="Shown to existing patients when re-ordering — focuses on progress + side effects"
        initial={reorderQuestionnaire}
        onSave={(qs) => console.log("Save reorder questionnaire", qs)}
      />
    </div>
  );
}
