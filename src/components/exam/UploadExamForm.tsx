"use client";

import { useState } from "react";
import { Upload, FileJson } from "lucide-react";
import { parseUploadedExam } from "@/lib/exam/generator";
import type { ExamQuestion } from "@/lib/exam/types";

interface UploadExamFormProps {
  courseCode: string;
  onUpload: (title: string, questions: ExamQuestion[]) => void;
}

const SAMPLE_FORMAT = `{
  "title": "2024 Final Exam",
  "questions": [
    {
      "stem": "Which of the following is correct?",
      "options": [
        { "id": "a", "text": "Option A" },
        { "id": "b", "text": "Option B" }
      ],
      "correctAnswer": "a",
      "explanation": "Because...",
      "module": 4,
      "media": [
        {
          "type": "table",
          "tableData": [["Header 1", "Header 2"], ["A", "B"]]
        }
      ]
    }
  ]
}`;

function parseExamJson(
  text: string,
  courseCode: string,
): { title: string; questions: ExamQuestion[] } | null {
  const json = JSON.parse(text);
  const parsed = parseUploadedExam(json, courseCode, "");
  if (!parsed || parsed.questions.length === 0) return null;
  return parsed;
}

export function UploadExamForm({ courseCode, onUpload }: UploadExamFormProps) {
  const [error, setError] = useState("");
  const [showFormat, setShowFormat] = useState(false);
  const [pastedJson, setPastedJson] = useState("");

  const handleParsed = (parsed: { title: string; questions: ExamQuestion[] }) => {
    setError("");
    onUpload(parsed.title, parsed.questions);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    try {
      const text = await file.text();
      const parsed = parseExamJson(text, courseCode);
      if (!parsed) {
        setError("Invalid exam format. See the sample format below.");
        return;
      }
      handleParsed(parsed);
    } catch {
      setError("Failed to parse JSON file.");
    } finally {
      e.target.value = "";
    }
  };

  const handlePasteSubmit = () => {
    setError("");
    const trimmed = pastedJson.trim();
    if (!trimmed) {
      setError("Paste your exam JSON above.");
      return;
    }

    try {
      const parsed = parseExamJson(trimmed, courseCode);
      if (!parsed) {
        setError("Invalid exam format. See the sample format below.");
        return;
      }
      handleParsed(parsed);
    } catch {
      setError("Failed to parse JSON. Check the format and try again.");
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6">
      <div className="text-center">
        <Upload className="mx-auto h-10 w-10 text-gray-400" />
        <h3 className="mt-2 font-medium text-gray-900">Add practice exam</h3>
        <p className="mt-1 text-sm text-gray-500">
          Upload a JSON file or paste exam JSON below
        </p>

        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#51247a] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d1a5c]">
          <FileJson className="h-4 w-4" />
          Choose JSON file
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFile}
            className="hidden"
          />
        </label>

        <div className="mt-6 text-left">
          <label
            htmlFor="exam-json-paste"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Or paste JSON
          </label>
          <textarea
            id="exam-json-paste"
            value={pastedJson}
            onChange={(e) => setPastedJson(e.target.value)}
            placeholder={SAMPLE_FORMAT}
            rows={10}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs text-gray-800 focus:border-[#51247a] focus:outline-none focus:ring-1 focus:ring-[#51247a]"
          />
          <button
            type="button"
            onClick={handlePasteSubmit}
            disabled={!pastedJson.trim()}
            className="mt-3 w-full rounded-lg bg-[#51247a] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d1a5c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Import pasted JSON
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowFormat(!showFormat)}
          className="mt-3 block w-full text-sm text-[#51247a] hover:underline"
        >
          {showFormat ? "Hide" : "Show"} sample format
        </button>

        {showFormat && (
          <pre className="mt-3 max-h-60 overflow-auto rounded-lg bg-gray-50 p-3 text-left text-xs text-gray-700">
            {SAMPLE_FORMAT}
          </pre>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
