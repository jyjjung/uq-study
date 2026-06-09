"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserProfile,
  getGradeEntries,
  saveGradeEntry,
  type GradeEntry,
} from "@/lib/firestore/db";
import { GradeCalculator, UqGradeScale } from "@/components/grade/GradeCalculator";
import {
  calculateProgramGPA,
  gradePointToLabel,
  calculateWeightedPercent,
  calculateCourseGPA,
  assessmentsToGrades,
} from "@/lib/uq/gpa";
import type { UQCourse } from "@/lib/uq/types";
import type { AssessmentGrade } from "@/lib/uq/types";

export default function GradeCalculatorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [enrolledCourses, setEnrolledCourses] = useState<string[]>([]);
  const [savedEntries, setSavedEntries] = useState<GradeEntry[]>([]);
  const [courseData, setCourseData] = useState<Record<string, UQCourse>>({});
  const [dataLoading, setDataLoading] = useState(true);
  const savedEntriesRef = useRef(savedEntries);
  savedEntriesRef.current = savedEntries;

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }

    if (!user) return;

    async function load() {
      try {
        const [profile, grades] = await Promise.all([
          getUserProfile(user!.uid),
          getGradeEntries(user!.uid),
        ]);
        const courses = profile?.enrolledCourses ?? [];
        setEnrolledCourses(courses);
        setSavedEntries(grades);

        const fetched: Record<string, UQCourse> = {};
        await Promise.all(
          courses.map(async (code) => {
            try {
              const res = await fetch(`/api/uq/course/${code}`);
              const data = await res.json();
              if (data.course) fetched[code] = data.course;
            } catch {
              /* skip */
            }
          }),
        );
        setCourseData(fetched);
      } finally {
        setDataLoading(false);
      }
    }

    load();
  }, [user, loading, router]);

  const handleSave = useCallback(
    async (courseCode: string, assessments: AssessmentGrade[]) => {
      if (!user) return;
      const course = courseData[courseCode];
      const existing = savedEntriesRef.current.find(
        (g) => g.courseCode === courseCode,
      );
      const entry: GradeEntry = {
        courseCode,
        courseTitle: course?.title ?? existing?.courseTitle ?? courseCode,
        units: course?.units ?? existing?.units ?? 2,
        assessments,
      };
      await saveGradeEntry(user.uid, entry);
      setSavedEntries((prev) => {
        const filtered = prev.filter((g) => g.courseCode !== courseCode);
        return [...filtered, entry];
      });
    },
    [user, courseData],
  );

  const programGpa = calculateProgramGPA(
    savedEntries
      .filter((e) => enrolledCourses.includes(e.courseCode))
      .map((e) => {
        const percent = calculateWeightedPercent(e.assessments);
        if (percent === null) return null;
        return { units: e.units, gradePoint: calculateCourseGPA(percent) };
      })
      .filter(
        (x): x is { units: number; gradePoint: 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0 } =>
          x !== null,
      ),
  );

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#51247a] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Grade Calculator</h1>
        <p className="mt-1 text-gray-600">
          Calculate grades for your enrolled courses. Unfilled marks count as 0.
        </p>
      </div>

      <UqGradeScale />

      {programGpa !== null && (
        <div className="rounded-xl border border-[#51247a]/20 bg-[#51247a]/5 p-5">
          <p className="text-sm text-gray-600">Program GPA</p>
          <p className="text-3xl font-bold text-[#51247a]">
            {programGpa.toFixed(2)}
          </p>
        </div>
      )}

      {enrolledCourses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-gray-600">No courses enrolled yet.</p>
          <p className="mt-2 text-sm text-gray-500">
            Save a program on the{" "}
            <Link href="/dashboard" className="text-[#51247a] hover:underline">
              dashboard
            </Link>{" "}
            and add courses, or add courses from individual course pages.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {enrolledCourses.map((code) => {
            const course = courseData[code];
            const saved = savedEntries.find((g) => g.courseCode === code);
            const initialAssessments =
              saved?.assessments ??
              (course?.assessments?.length
                ? assessmentsToGrades(course.assessments)
                : []);

            return (
              <div key={code}>
                <GradeCalculator
                  initialAssessments={initialAssessments}
                  courseCode={code}
                  courseTitle={course?.title ?? saved?.courseTitle ?? code}
                  units={course?.units ?? saved?.units ?? 2}
                  onSave={(assessments) => handleSave(code, assessments)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
