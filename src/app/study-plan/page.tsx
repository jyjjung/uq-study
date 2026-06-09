"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronDown, ChevronRight, Play } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserProfile,
  getPracticeExams,
  getQuestionProgress,
} from "@/lib/firestore/db";
import { buildStudyModules, type StudyModule } from "@/lib/exam/modules";
import type { UQCourse } from "@/lib/uq/types";

interface SubjectModules {
  courseCode: string;
  courseTitle: string;
  modules: StudyModule[];
  expanded: boolean;
}

export default function StudyPlanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectModules[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;

    async function load() {
      const profile = await getUserProfile(user!.uid);
      const courses = profile?.enrolledCourses ?? [];
      const [exams, progress] = await Promise.all([
        getPracticeExams(user!.uid),
        getQuestionProgress(user!.uid),
      ]);

      const courseData = await Promise.all(
        courses.map(async (code) => {
          try {
            const res = await fetch(`/api/uq/course/${code}`);
            const data = await res.json();
            return { code, course: data.course as UQCourse | undefined };
          } catch {
            return { code, course: undefined };
          }
        }),
      );

      setSubjects(
        courseData.map(({ code, course }, index) => ({
          courseCode: code,
          courseTitle: course?.title ?? code,
          modules: buildStudyModules(
            code,
            course?.title ?? code,
            course ?? null,
            exams,
            progress,
          ),
          expanded: index === 0,
        })),
      );
      setDataLoading(false);
    }

    void load();
  }, [user, loading, router]);

  const toggleSubject = (code: string) => {
    setSubjects((prev) =>
      prev.map((s) =>
        s.courseCode === code ? { ...s, expanded: !s.expanded } : s,
      ),
    );
  };

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#51247a] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Study</h1>
        <p className="mt-1 text-gray-600">
          Track your progress by module and jump back into practice.
        </p>
      </div>

      {subjects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Add courses on your{" "}
          <Link href="/dashboard" className="text-[#51247a] hover:underline">
            dashboard
          </Link>
          , then upload quizzes with a module{" "}
          <code className="text-xs">number</code> on each question.
        </p>
      ) : (
        <div className="space-y-3">
          {subjects.map((subject) => (
            <SubjectCard
              key={subject.courseCode}
              subject={subject}
              onToggle={() => toggleSubject(subject.courseCode)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubjectCard({
  subject,
  onToggle,
}: {
  subject: SubjectModules;
  onToggle: () => void;
}) {
  const totalQuestions = subject.modules.reduce(
    (sum, m) => sum + m.questionCount,
    0,
  );
  const totalAttempted = subject.modules.reduce(
    (sum, m) => sum + m.progress.attempted,
    0,
  );
  const totalDue = subject.modules.reduce(
    (sum, m) => sum + m.progress.dueCount,
    0,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-[#51247a]" />
          <div>
            <p className="font-semibold text-gray-900">{subject.courseCode}</p>
            <p className="text-sm text-gray-500">{subject.courseTitle}</p>
            {totalQuestions > 0 && (
              <p className="mt-0.5 text-xs text-gray-400">
                {totalAttempted}/{totalQuestions} questions practiced
                {totalDue > 0 ? ` · ${totalDue} due for review` : ""}
              </p>
            )}
          </div>
        </div>
        {subject.expanded ? (
          <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
        )}
      </button>

      {subject.expanded && (
        <div className="border-t border-gray-100 px-2 pb-2">
          {subject.modules.length === 0 ? (
            <p className="px-3 py-4 text-sm text-gray-500">
              No modules yet. Upload a quiz for this course with a module number
              on each question.
            </p>
          ) : (
            subject.modules.map((mod) => (
              <ModuleRow key={mod.slug} module={mod} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function accuracyColor(accuracy: number, attempted: number): string {
  if (attempted === 0) return "bg-gray-200";
  if (accuracy >= 75) return "bg-green-500";
  if (accuracy >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function ModuleRow({ module }: { module: StudyModule }) {
  const href = `/practice/module/${module.courseCode}/${module.slug}`;
  const { progress } = module;
  const coverage =
    progress.total > 0
      ? Math.round((progress.attempted / progress.total) * 100)
      : 0;
  const hasStarted = progress.attempted > 0;

  return (
    <div className="rounded-lg px-3 py-3 hover:bg-[#51247a]/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-gray-900">{module.name}</p>
            {hasStarted && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${accuracyColor(progress.accuracy, progress.attempted)}`}
              >
                {progress.accuracy}%
              </span>
            )}
            {progress.dueCount > 0 && (
              <span className="rounded-full bg-[#51247a]/10 px-2 py-0.5 text-xs font-medium text-[#51247a]">
                {progress.dueCount} due
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-gray-500">
            {module.questionCount} in bank
            {hasStarted
              ? ` · ${progress.attempted}/${progress.total} practiced`
              : module.questionCount > 0
                ? " · not started"
                : ""}
          </p>

          {module.questionCount > 0 && (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all ${hasStarted ? "bg-[#51247a]" : "bg-gray-200"}`}
                  style={{ width: `${coverage}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-gray-400">
                {hasStarted
                  ? `${coverage}% of bank covered`
                  : "Start studying to track progress"}
              </p>
            </div>
          )}
        </div>

        {module.questionCount > 0 ? (
          <Link
            href={href}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-[#51247a] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#3d1a5c]"
          >
            <Play className="h-4 w-4" />
            {hasStarted ? "Continue" : "Study"}
          </Link>
        ) : (
          <span className="shrink-0 text-xs text-gray-400">No questions</span>
        )}
      </div>
    </div>
  );
}
