"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Calculator,
  GraduationCap,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserProfile,
  getGradeEntries,
  type UserProfile,
  type GradeEntry,
} from "@/lib/firestore/db";
import { ProgramCoursePicker } from "@/components/dashboard/ProgramCoursePicker";
import { GradeEntryCard } from "@/components/dashboard/GradeEntryCard";
import {
  calculateProgramGPA,
  calculateWeightedPercent,
  calculateCourseGPA,
} from "@/lib/uq/gpa";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loadError, setLoadError] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  const userFallback = user
    ? { email: user.email ?? "", displayName: user.displayName ?? "" }
    : undefined;

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setLoadError("");
    try {
      const [userProfile, gradeEntries] = await Promise.all([
        getUserProfile(user.uid),
        getGradeEntries(user.uid),
      ]);
      setProfile(userProfile);
      setGrades(gradeEntries);
    } catch (err) {
      console.error("Dashboard load failed:", err);
      setLoadError(
        "Could not load your data. Firestore rules may need deploying — try again after signing out and back in.",
      );
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (user) loadDashboard();
  }, [user, loading, router, loadDashboard]);

  const programGpa = calculateProgramGPA(
    grades
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

  const enrolledCourses = profile?.enrolledCourses ?? [];
  const enrolledPrograms = profile?.enrolledPrograms ?? [];
  const programTitles = profile?.programTitles ?? {};

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{user?.displayName ? `, ${user.displayName}` : ""}
          </h1>
          <p className="mt-1 text-gray-600">Your courses and grades</p>
        </div>
        {programGpa !== null && (
          <div className="rounded-xl border border-[#51247a]/20 bg-[#51247a]/5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <TrendingUp className="h-4 w-4 text-[#51247a]" />
              Program GPA
            </div>
            <p className="text-2xl font-bold text-[#51247a]">
              {programGpa.toFixed(2)}
            </p>
          </div>
        )}
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <GraduationCap className="h-5 w-5 text-[#51247a]" />
          Saved programs
        </h2>
        {enrolledPrograms.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            No programs saved yet.{" "}
            <Link href="/search" className="text-[#51247a] hover:underline">
              Search for your degree
            </Link>{" "}
            and click &quot;Save program&quot;.
          </p>
        ) : (
          <div className="space-y-3">
            {enrolledPrograms.map((id) => (
              <ProgramCoursePicker
                key={id}
                programId={id}
                programTitle={programTitles[id] ?? `Program ${id}`}
                enrolledCourses={enrolledCourses}
                onCoursesAdded={(codes) => {
                  setProfile((prev) =>
                    prev
                      ? {
                          ...prev,
                          enrolledCourses: [
                            ...new Set([...prev.enrolledCourses, ...codes]),
                          ],
                        }
                      : prev,
                  );
                }}
                uid={user!.uid}
                userFallback={userFallback}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <BookOpen className="h-5 w-5 text-[#51247a]" />
          My courses ({enrolledCourses.length})
        </h2>
        {enrolledCourses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            Add courses from a saved program above, or open a course and click
            &quot;Add to my courses&quot;.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enrolledCourses.map((code) => {
              const grade = grades.find((g) => g.courseCode === code);
              return (
                <Link
                  key={code}
                  href={`/course/${code}`}
                  className="rounded-xl border border-gray-200 bg-white p-4 hover:border-[#51247a]/30"
                >
                  <p className="font-semibold text-[#51247a]">{code}</p>
                  <p className="text-sm text-gray-600">
                    {grade?.courseTitle ?? "View course"}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Calculator className="h-5 w-5 text-[#51247a]" />
          Saved grades
        </h2>
        {grades.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            Track marks in the{" "}
            <Link href="/grade-calculator" className="text-[#51247a] hover:underline">
              grade calculator
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {grades.map((entry) => (
              <GradeEntryCard
                key={entry.courseCode}
                entry={entry}
                uid={user!.uid}
                onUpdate={(updated) => {
                  setGrades((prev) =>
                    prev.map((g) =>
                      g.courseCode === updated.courseCode ? updated : g,
                    ),
                  );
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
