"use client";

import { useEffect, useState } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import type { UQProgramCourse } from "@/lib/uq/types";
import { enrollCourses } from "@/lib/firestore/db";

interface ProgramCoursePickerProps {
  programId: string;
  programTitle: string;
  enrolledCourses: string[];
  onCoursesAdded: (codes: string[]) => void;
  userFallback?: { email?: string; displayName?: string };
  uid: string;
}

export function ProgramCoursePicker({
  programId,
  programTitle,
  enrolledCourses,
  onCoursesAdded,
  userFallback,
  uid,
}: ProgramCoursePickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [courses, setCourses] = useState<UQProgramCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!expanded || courses.length > 0) return;
    setLoading(true);
    fetch(`/api/uq/program/${programId}`)
      .then((res) => res.json())
      .then((data) => setCourses(data.program?.courses ?? []))
      .catch(() => setError("Failed to load program courses"))
      .finally(() => setLoading(false));
  }, [expanded, programId, courses.length]);

  const unenrolled = courses.filter(
    (c) => !enrolledCourses.includes(c.code.toUpperCase()),
  );

  const addCourse = async (code: string) => {
    setSaving(true);
    setError("");
    try {
      await enrollCourses(uid, [code], userFallback);
      onCoursesAdded([code.toUpperCase()]);
    } catch {
      setError("Failed to add course");
    } finally {
      setSaving(false);
    }
  };

  const addAll = async () => {
    if (unenrolled.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const codes = unenrolled.map((c) => c.code);
      await enrollCourses(uid, codes, userFallback);
      onCoursesAdded(codes.map((c) => c.toUpperCase()));
    } catch {
      setError("Failed to add courses");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="font-medium text-gray-900">{programTitle}</p>
          <p className="text-xs text-gray-500">Program {programId}</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4">
          {loading && (
            <p className="py-3 text-sm text-gray-500">Loading courses...</p>
          )}
          {error && <p className="py-2 text-sm text-red-600">{error}</p>}

          {!loading && courses.length > 0 && (
            <>
              <div className="mb-3 flex items-center justify-between pt-2">
                <p className="text-sm text-gray-600">
                  {unenrolled.length} courses available to add
                </p>
                {unenrolled.length > 0 && (
                  <button
                    onClick={addAll}
                    disabled={saving}
                    className="text-sm font-medium text-[#51247a] hover:underline disabled:opacity-50"
                  >
                    Add all
                  </button>
                )}
              </div>
              <div className="max-h-60 space-y-1 overflow-y-auto">
                {courses.map((c) => {
                  const enrolled = enrolledCourses.includes(c.code);
                  return (
                    <div
                      key={c.code}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium text-[#51247a]">
                          {c.code}
                        </span>
                        <span className="ml-2 text-gray-600">{c.title}</span>
                      </div>
                      {enrolled ? (
                        <span className="text-xs text-green-600">Added</span>
                      ) : (
                        <button
                          onClick={() => addCourse(c.code)}
                          disabled={saving}
                          className="flex items-center gap-1 text-[#51247a] hover:underline disabled:opacity-50"
                        >
                          <Plus className="h-3 w-3" />
                          Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
