"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPracticeExams,
  getUserProfile,
  savePracticeExam,
  deletePracticeExamWithData,
  updatePracticeExam,
} from "@/lib/firestore/db";
import { parseExamJsonText } from "@/lib/exam/generator";
import { UploadExamForm } from "@/components/exam/UploadExamForm";
import { QuizEditor } from "@/components/quiz/QuizEditor";
import type { ExamQuestion, PracticeExam } from "@/lib/exam/types";

export default function QuizzesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [exams, setExams] = useState<PracticeExam[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [enrolledCourses, setEnrolledCourses] = useState<string[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [adding, setAdding] = useState(false);

  const loadExams = useCallback(async () => {
    if (!user) return;
    const list = await getPracticeExams(user.uid);
    setExams(list);
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;

    async function load() {
      const profile = await getUserProfile(user!.uid);
      const courses = profile?.enrolledCourses ?? [];
      setEnrolledCourses(courses);
      setSelectedCourse((prev) => prev || courses[0] || "");
      await loadExams();
      setDataLoading(false);
    }

    void load();
  }, [user, loading, router, loadExams]);

  const handleDelete = async (exam: PracticeExam) => {
    if (
      !user ||
      !confirm(
        `Delete "${exam.title}"? This removes the quiz and related study progress for its questions.`,
      )
    ) {
      return;
    }
    setDeletingId(exam.id);
    try {
      await deletePracticeExamWithData(user.uid, exam.id);
      setExams((prev) => prev.filter((e) => e.id !== exam.id));
      if (editingId === exam.id) setEditingId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveEdit = async (
    exam: PracticeExam,
    title: string,
    json: string,
  ) => {
    if (!user) return;
    const parsed = parseExamJsonText(json, exam.courseCode);
    if (!parsed) throw new Error("Invalid quiz");
    await updatePracticeExam(user.uid, exam.id, {
      title: title || parsed.title,
      courseCode: exam.courseCode,
      questions: parsed.questions,
    });
    setExams((prev) =>
      prev.map((e) =>
        e.id === exam.id
          ? { ...e, title: title || parsed.title, questions: parsed.questions }
          : e,
      ),
    );
    setEditingId(null);
  };

  const handleAddQuiz = async (title: string, questions: ExamQuestion[]) => {
    if (!user || !selectedCourse) return;
    setAdding(true);
    try {
      await savePracticeExam(user.uid, {
        title,
        courseCode: selectedCourse.toUpperCase(),
        questions,
      });
      await loadExams();
      setShowAddForm(false);
      setEditingId(null);
    } finally {
      setAdding(false);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#51247a] border-t-transparent" />
      </div>
    );
  }

  const editingExam = exams.find((e) => e.id === editingId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quizzes</h1>
          <p className="mt-1 text-gray-600">
            Question banks by subject. Tag each question with a module{" "}
            <code className="text-sm">number</code> to study by module.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAddForm((open) => !open);
            if (!showAddForm) setEditingId(null);
          }}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-[#51247a] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d1a5c]"
        >
          <Plus className="h-4 w-4" />
          Add quiz
        </button>
      </div>

      {showAddForm && (
        <div className="rounded-xl border border-[#51247a]/30 bg-white p-5">
          <h2 className="mb-4 font-semibold text-gray-900">Add quiz</h2>
          {enrolledCourses.length === 0 ? (
            <p className="text-sm text-gray-500">
              Add a course on your{" "}
              <Link href="/dashboard" className="text-[#51247a] hover:underline">
                dashboard
              </Link>{" "}
              first, then upload a quiz here.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="quiz-course"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Subject
                </label>
                <select
                  id="quiz-course"
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#51247a] focus:outline-none focus:ring-1 focus:ring-[#51247a]"
                >
                  {enrolledCourses.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div className={adding ? "pointer-events-none opacity-50" : ""}>
                <UploadExamForm
                  courseCode={selectedCourse}
                  onUpload={handleAddQuiz}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {editingExam && (
        <div className="rounded-xl border border-[#51247a]/30 bg-white p-5">
          <h2 className="mb-4 font-semibold text-gray-900">Edit quiz</h2>
          <QuizEditor
            exam={editingExam}
            onSave={(title, json) => handleSaveEdit(editingExam, title, json)}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}

      {exams.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No quizzes yet. Click <strong>Add quiz</strong> above to upload one.
        </p>
      ) : (
        <div className="space-y-2">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{exam.title}</p>
                <p className="text-sm text-gray-500">
                  {exam.courseCode} · {exam.questions?.length ?? 0} questions
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={`/practice/${exam.id}?course=${exam.courseCode}`}
                  className="rounded-lg p-2 text-[#51247a] hover:bg-[#51247a]/10"
                  title="Play full quiz"
                >
                  <Play className="h-5 w-5" />
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    setEditingId(editingId === exam.id ? null : exam.id)
                  }
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                  title="Edit quiz"
                >
                  <Pencil className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(exam)}
                  disabled={deletingId === exam.id}
                  className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  title="Delete quiz"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
