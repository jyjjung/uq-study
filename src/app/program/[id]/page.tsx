"use client";

import { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { UQProgram, UQProgramCourse } from "@/lib/uq/types";
import { enrollProgram } from "@/lib/firestore/db";

export default function ProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [program, setProgram] = useState<UQProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/uq/program/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setProgram(data.program);
      })
      .catch(() => setError("Failed to load program"))
      .finally(() => setLoading(false));
  }, [id]);

  const groupedCourses = useMemo(() => {
    if (!program) return new Map<string, UQProgramCourse[]>();
    const groups = new Map<string, UQProgramCourse[]>();
    for (const course of program.courses) {
      const key = course.requirementType ?? "Program courses";
      const list = groups.get(key) ?? [];
      list.push(course);
      groups.set(key, list);
    }
    return groups;
  }, [program]);

  const handleEnroll = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      await enrollProgram(
        user.uid,
        id,
        program?.title ?? `Program ${id}`,
        { email: user.email ?? "", displayName: user.displayName ?? "" },
      );
      setMessage("Program saved. Add courses from your dashboard.");
    } catch {
      setMessage("Failed to save program. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#51247a] border-t-transparent" />
      </div>
    );
  }

  if (error || !program) {
    return <div className="text-center text-gray-500">{error || "Not found"}</div>;
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-[#51247a]/20 bg-[#51247a]/5 px-4 py-3 text-sm text-[#51247a]">
          {message}
        </div>
      )}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-gray-900">{program.title}</h1>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
          {program.units && <span>{program.units} units</span>}
          {program.attendanceMode && (
            <>
              <span>·</span>
              <span>{program.attendanceMode}</span>
            </>
          )}
          <span>·</span>
          <span>{program.courses.length} courses</span>
        </div>

        {program.description && (
          <p className="mt-4 text-sm leading-relaxed text-gray-700">
            {program.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={handleEnroll}
            className="rounded-lg bg-[#51247a] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d1a5c]"
          >
            {user ? "Save program" : "Sign in to save"}
          </button>
          {program.requirementsUrl && (
            <a
              href={program.requirementsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" />
              Official requirements
            </a>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <BookOpen className="h-5 w-5 text-[#51247a]" />
          Courses in this program ({program.courses.length})
        </h2>
        {program.courses.length === 0 ? (
          <p className="text-gray-500">
            Course list could not be loaded. Check the official requirements
            page.
          </p>
        ) : (
          <div className="space-y-6">
            {Array.from(groupedCourses.entries()).map(([group, courses]) => (
              <div key={group}>
                <h3 className="mb-2 text-sm font-semibold text-[#51247a]">
                  {group}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {courses.map((c) => (
                    <Link
                      key={c.code}
                      href={`/course/${c.code}`}
                      className="rounded-xl border border-gray-200 bg-white p-4 hover:border-[#51247a]/30"
                    >
                      <p className="font-medium text-[#51247a]">{c.code}</p>
                      <p className="text-sm text-gray-700">{c.title}</p>
                      {c.units && (
                        <p className="text-xs text-gray-400">{c.units} units</p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
