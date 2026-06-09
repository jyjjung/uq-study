"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  ExternalLink,
  Target,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { UQCourse } from "@/lib/uq/types";
import {
  enrollCourse,
  savePracticeExam,
} from "@/lib/firestore/db";
import { UploadExamForm } from "@/components/exam/UploadExamForm";
import type { ExamQuestion } from "@/lib/exam/types";

export default function CoursePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<UQCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/uq/course/${code}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setCourse(data.course);
      })
      .catch(() => setError("Failed to load course"))
      .finally(() => setLoading(false));
  }, [code]);

  const userFallback = user
    ? { email: user.email ?? "", displayName: user.displayName ?? "" }
    : undefined;

  const handleUpload = async (title: string, questions: ExamQuestion[]) => {
    if (!user) {
      router.push("/login");
      return;
    }
    const examId = await savePracticeExam(user.uid, {
      title,
      courseCode: code.toUpperCase(),
      questions,
    });
    router.push(`/practice/${examId}?course=${code.toUpperCase()}`);
  };

  const handleEnroll = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      await enrollCourse(user.uid, code.toUpperCase(), userFallback);
      setMessage("Course added to your dashboard.");
    } catch {
      setMessage("Failed to save course. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#51247a] border-t-transparent" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="text-center text-gray-500">
        {error || "Course not found"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-[#51247a]/20 bg-[#51247a]/5 px-4 py-3 text-sm text-[#51247a]">
          {message}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#51247a]">{course.code}</p>
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
              <span>{course.level}</span>
              <span>·</span>
              <span>{course.units} units</span>
              <span>·</span>
              <span>{course.mode}</span>
              {course.profile?.studyPeriod && (
                <>
                  <span>·</span>
                  <span>{course.profile.studyPeriod}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {course.profile?.url && (
              <a
                href={course.profile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink className="h-4 w-4" />
                Course profile
              </a>
            )}
            <button
              onClick={handleEnroll}
              className="rounded-lg bg-[#51247a] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d1a5c]"
            >
              {user ? "Add to my courses" : "Sign in to save"}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {course.profile?.learningOutcomes &&
          course.profile.learningOutcomes.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <Target className="h-5 w-5 text-[#51247a]" />
                Learning outcomes
              </h2>
              <div className="space-y-2">
                {course.profile.learningOutcomes.map((lo) => (
                  <div
                    key={lo.id}
                    className="rounded-lg border border-gray-200 bg-white p-3 text-sm"
                  >
                    <span className="font-semibold text-[#51247a]">
                      {lo.id}.
                    </span>{" "}
                    {lo.text}
                  </div>
                ))}
              </div>
            </section>
          )}

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <ClipboardList className="h-5 w-5 text-[#51247a]" />
            Assessments
          </h2>
          {course.assessments.map((a) => (
            <div
              key={a.id}
              className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-gray-900">{a.name}</p>
                  {a.category && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {a.category}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                  {a.weightLabel && <span>{a.weightLabel}</span>}
                  {!a.weightLabel && a.weight && <span>{a.weight}%</span>}
                  {a.dueDate && <span>Due: {a.dueDate}</span>}
                  {a.mode && <span>{a.mode}</span>}
                </div>
              </div>
              {a.profileUrl && (
                <a
                  href={a.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-[#51247a] hover:underline"
                >
                  Profile
                </a>
              )}
            </div>
          ))}
        </section>

        {course.profile?.learningActivities &&
          course.profile.learningActivities.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <BookOpen className="h-5 w-5 text-[#51247a]" />
                Schedule
              </h2>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        When
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        Topic
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {course.profile.learningActivities.map((act, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-4 py-3 text-gray-600">
                          {act.period}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {act.activityType}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {act.topic}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

        <section>
          <UploadExamForm courseCode={course.code} onUpload={handleUpload} />
        </section>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/grade-calculator"
            className="text-[#51247a] hover:underline"
          >
            Grade calculator
          </Link>
          <Link href="/quizzes" className="text-[#51247a] hover:underline">
            Quizzes
          </Link>
        </div>
      </div>
    </div>
  );
}
