"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AssessmentGrade } from "@/lib/uq/types";
import {
  UQ_GRADE_BANDS,
  calculateWeightedPercent,
  calculateCourseGPA,
  gradePointToLabel,
} from "@/lib/uq/gpa";

interface GradeCalculatorProps {
  initialAssessments?: AssessmentGrade[];
  courseCode?: string;
  courseTitle?: string;
  units?: number;
  onSave?: (assessments: AssessmentGrade[]) => void | Promise<void>;
  showGradeScale?: boolean;
}

const DEFAULT_ASSESSMENTS: AssessmentGrade[] = [
  { id: "1", name: "Assessment 1", weight: 50, score: null, maxScore: 100 },
  { id: "2", name: "Final Exam", weight: 50, score: null, maxScore: 100 },
];

export function UqGradeScale() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 font-medium text-gray-800">UQ Grade Scale</h3>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        {UQ_GRADE_BANDS.map((band) => (
          <div
            key={band.gradePoint}
            className="rounded-lg bg-gray-50 px-3 py-2 text-center"
          >
            <p className="font-semibold text-[#51247a]">{band.label}</p>
            <p className="text-xs text-gray-500">
              {band.minPercent}–{band.maxPercent}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GradeCalculator({
  initialAssessments = [],
  courseCode,
  courseTitle,
  units = 2,
  onSave,
  showGradeScale = false,
}: GradeCalculatorProps) {
  const [assessments, setAssessments] = useState<AssessmentGrade[]>(
    initialAssessments.length > 0 ? initialAssessments : DEFAULT_ASSESSMENTS,
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const skipNextSave = useRef(true);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const initialKey = useMemo(
    () => JSON.stringify(initialAssessments),
    [initialAssessments],
  );

  useEffect(() => {
    const parsed = JSON.parse(initialKey) as AssessmentGrade[];
    setAssessments(parsed.length > 0 ? parsed : DEFAULT_ASSESSMENTS);
    skipNextSave.current = true;
  }, [courseCode, initialKey]);

  useEffect(() => {
    if (!onSaveRef.current) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        await onSaveRef.current?.(assessments);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("idle");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [assessments]);

  const weightedPercent = calculateWeightedPercent(assessments);
  const gradePoint =
    weightedPercent !== null ? calculateCourseGPA(weightedPercent) : null;
  const totalWeight = assessments.reduce((s, a) => s + a.weight, 0);

  const updateAssessment = (
    id: string,
    field: keyof AssessmentGrade,
    value: string | number | null,
  ) => {
    setAssessments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    );
  };

  const addAssessment = () => {
    setAssessments((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: "New Assessment",
        weight: 0,
        score: null,
        maxScore: 100,
      },
    ]);
  };

  const removeAssessment = (id: string) => {
    setAssessments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-6">
      {(courseCode || courseTitle) && (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-[#51247a]/5 p-4">
          <div>
            <h2 className="font-semibold text-[#51247a]">
              {courseCode} — {courseTitle}
            </h2>
            <p className="text-sm text-gray-600">{units} units</p>
          </div>
          {onSave && saveStatus !== "idle" && (
            <span className="text-xs text-gray-500">
              {saveStatus === "saving" ? "Saving…" : "Saved"}
            </span>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Assessment
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Weight (%)
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Score
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Max
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                %
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {assessments.map((a) => {
              const score = a.score ?? 0;
              const percent =
                a.maxScore > 0
                  ? ((score / a.maxScore) * 100).toFixed(1)
                  : "0.0";
              return (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={a.name}
                      onChange={(e) =>
                        updateAssessment(a.id, "name", e.target.value)
                      }
                      className="w-full rounded border border-gray-200 px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={a.weight}
                      onChange={(e) =>
                        updateAssessment(a.id, "weight", Number(e.target.value))
                      }
                      className="w-20 rounded border border-gray-200 px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      value={a.score ?? ""}
                      onChange={(e) =>
                        updateAssessment(
                          a.id,
                          "score",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                      className="w-20 rounded border border-gray-200 px-2 py-1"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={1}
                      value={a.maxScore}
                      onChange={(e) =>
                        updateAssessment(a.id, "maxScore", Number(e.target.value))
                      }
                      className="w-20 rounded border border-gray-200 px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-2 text-gray-600">{percent}</td>
                  <td className="px-2">
                    <button
                      onClick={() => removeAssessment(a.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="border-t border-gray-100 px-4 py-3">
          <button
            onClick={addAssessment}
            className="flex items-center gap-1 text-sm text-[#51247a] hover:underline"
          >
            <Plus className="h-4 w-4" />
            Add assessment
          </button>
        </div>
      </div>

      {totalWeight !== 100 && (
        <p className="text-sm text-amber-600">
          Weights total {totalWeight}% (should be 100%)
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Weighted average</p>
          <p className="text-3xl font-bold text-[#51247a]">
            {weightedPercent !== null ? `${weightedPercent.toFixed(1)}%` : "0.0%"}
          </p>
          <p className="mt-1 text-xs text-gray-400">Unfilled marks count as 0</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">UQ Grade / GPA</p>
          <p className="text-3xl font-bold text-[#51247a]">
            {gradePoint !== null ? gradePointToLabel(gradePoint) : "—"}
          </p>
        </div>
      </div>

      {showGradeScale && <UqGradeScale />}
    </div>
  );
}
