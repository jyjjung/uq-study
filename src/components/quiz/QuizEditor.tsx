"use client";

import { useState } from "react";
import { parseExamJsonText } from "@/lib/exam/generator";
import type { PracticeExam } from "@/lib/exam/types";

interface QuizEditorProps {
  exam: PracticeExam;
  onSave: (title: string, questionsJson: string) => Promise<void>;
  onCancel: () => void;
}

export function QuizEditor({ exam, onSave, onCancel }: QuizEditorProps) {
  const [title, setTitle] = useState(exam.title);
  const [json, setJson] = useState(
    JSON.stringify(
      {
        title: exam.title,
        questions: exam.questions,
      },
      null,
      2,
    ),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const result = parseExamJsonText(json, exam.courseCode);
      if (!result) {
        setError("Invalid quiz JSON. Need a questions array with at least one item.");
        return;
      }
      await onSave(title.trim() || result.title, json);
    } catch {
      setError("Invalid JSON. Check the format and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#51247a] focus:outline-none focus:ring-1 focus:ring-[#51247a]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Questions JSON
        </label>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={16}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs focus:border-[#51247a] focus:outline-none focus:ring-1 focus:ring-[#51247a]"
        />
        <p className="mt-1 text-xs text-gray-500">
          Each question needs a <code>module</code> number or{" "}
          <code>&quot;topic&quot;: &quot;Module 4&quot;</code> for study by module.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#51247a] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d1a5c] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save quiz"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
