"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { GradeCalculator } from "@/components/grade/GradeCalculator";
import type { GradeEntry } from "@/lib/firestore/db";
import { saveGradeEntry } from "@/lib/firestore/db";
import {
  calculateWeightedPercent,
  calculateCourseGPA,
  gradePointToLabel,
} from "@/lib/uq/gpa";
import type { AssessmentGrade } from "@/lib/uq/types";

interface GradeEntryCardProps {
  entry: GradeEntry;
  uid: string;
  onUpdate: (entry: GradeEntry) => void;
}

export function GradeEntryCard({ entry, uid, onUpdate }: GradeEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const percent = calculateWeightedPercent(entry.assessments);
  const gp = percent !== null ? calculateCourseGPA(percent) : null;

  const handleSave = async (assessments: AssessmentGrade[]) => {
    const updated = { ...entry, assessments };
    await saveGradeEntry(uid, updated);
    onUpdate(updated);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="font-medium text-[#51247a]">{entry.courseCode}</p>
          <p className="text-sm text-gray-600">{entry.courseTitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-sm">
            <p className="font-semibold text-gray-900">
              {percent !== null ? `${percent.toFixed(1)}%` : "0.0%"}
            </p>
            <p className="text-gray-500">
              {gp !== null ? gradePointToLabel(gp) : "—"}
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4">
          <div className="mb-3 flex justify-end">
            <Link
              href={`/course/${entry.courseCode}`}
              className="flex items-center gap-1 text-sm text-[#51247a] hover:underline"
            >
              Open course <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <GradeCalculator
            initialAssessments={entry.assessments}
            courseCode={entry.courseCode}
            courseTitle={entry.courseTitle}
            units={entry.units}
            onSave={handleSave}
          />
        </div>
      )}
    </div>
  );
}
