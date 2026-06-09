"use client";

import { Suspense, useCallback, useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { ExamPlayer } from "@/components/exam/ExamPlayer";
import {
  updateQuestionProgress,
  createNewCard,
  getPracticeExamSession,
  savePracticeExamSession,
  deletePracticeExamSession,
} from "@/lib/firestore/db";
import { reviewCard, qualityFromAnswer } from "@/lib/spaced-repetition/sm2";
import { orderQuestions, shuffleQuestions } from "@/lib/exam/shuffle";
import { enrichQuestionForProgress } from "@/lib/exam/modules";
import type {
  PracticeExam,
  ExamSessionAnswer,
  ExamQuestion,
  PracticeExamSessionState,
} from "@/lib/exam/types";

function PracticeContent({ examId }: { examId: string }) {
  const searchParams = useSearchParams();
  const courseCode = searchParams.get("course") ?? "";
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [exam, setExam] = useState<PracticeExam | null>(null);
  const [orderedQuestions, setOrderedQuestions] = useState<ExamQuestion[]>([]);
  const [sessionState, setSessionState] = useState<PracticeExamSessionState | null>(
    null,
  );
  const [sessionReady, setSessionReady] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    let cancelled = false;

    async function loadExam() {
      try {
        const snap = await getDoc(
          doc(db, "users", user!.uid, "practiceExams", examId),
        );
        if (cancelled) return;
        if (!snap.exists()) {
          setError("Practice exam not found. It may not have been saved.");
          return;
        }

        const loaded = { id: snap.id, ...snap.data() } as PracticeExam;
        setExam(loaded);

        const saved = await getPracticeExamSession(user!.uid, examId);
        if (cancelled) return;

        if (saved?.questionOrder?.length) {
          setOrderedQuestions(
            orderQuestions(loaded.questions, saved.questionOrder),
          );
          setSessionState({
            currentIndex: saved.currentIndex,
            questionOrder: saved.questionOrder,
            answers: saved.answers ?? {},
            submitted: saved.submitted ?? {},
            flagged: saved.flagged ?? [],
          });
        } else {
          setOrderedQuestions(loaded.questions);
          setSessionState(null);
        }
        setSessionReady(true);
      } catch (err) {
        console.error("Failed to load exam:", err);
        if (!cancelled) {
          setError(
            "Could not load exam. Check you are signed in and try again.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadExam();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, examId, router]);

  const handleSessionChange = useCallback(
    async (state: PracticeExamSessionState) => {
      if (!user || !exam) return;
      try {
        await savePracticeExamSession(
          user.uid,
          examId,
          courseCode || exam.courseCode,
          state,
        );
      } catch (err) {
        console.error("Failed to save exam session:", err);
      }
    },
    [user, exam, examId, courseCode],
  );

  const handleRetake = async () => {
    if (!exam || !user) return;
    try {
      await deletePracticeExamSession(user.uid, examId);
    } catch (err) {
      console.error("Failed to clear session:", err);
    }
    const shuffled = shuffleQuestions(exam.questions);
    setOrderedQuestions(shuffled);
    setSessionState(null);
    setPlayerKey((k) => k + 1);
    setFinished(false);
  };

  const handleAnswer = async (
    question: PracticeExam["questions"][0],
    correct: boolean,
    timeSpentMs: number,
  ) => {
    if (!user) return;
    try {
      const quality = qualityFromAnswer(correct, timeSpentMs);
      const sm2 = reviewCard(createNewCard(), quality);
      await updateQuestionProgress(
        user.uid,
        enrichQuestionForProgress(question, examId),
        courseCode || exam?.courseCode || "",
        correct,
        sm2,
      );
    } catch (err) {
      console.error("Failed to save progress:", err);
    }
  };

  const handleComplete = async (answers: ExamSessionAnswer[]) => {
    const correct = answers.filter((a) => a.correct).length;
    setScore({ correct, total: answers.length });
    setFinished(true);
    if (user) {
      try {
        await deletePracticeExamSession(user.uid, examId);
      } catch (err) {
        console.error("Failed to clear session:", err);
      }
    }
  };

  if (authLoading || loading || !sessionReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#51247a] border-t-transparent" />
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-600">{error || "Exam not found"}</p>
        <button
          onClick={() => router.push(courseCode ? `/course/${courseCode}` : "/dashboard")}
          className="mt-4 rounded-lg bg-[#51247a] px-4 py-2 text-sm text-white"
        >
          Go back
        </button>
      </div>
    );
  }

  if (finished) {
    const percent = Math.round((score.correct / score.total) * 100);
    return (
      <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Exam complete</h2>
        <p className="mt-2 text-4xl font-bold text-[#51247a]">
          {score.correct}/{score.total}
        </p>
        <p className="text-gray-600">{percent}%</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={handleRetake}
            className="rounded-lg border border-[#51247a] px-6 py-2 text-sm font-medium text-[#51247a]"
          >
            Retake (shuffle)
          </button>
          <button
            onClick={() =>
              router.push(`/course/${courseCode || exam.courseCode}`)
            }
            className="rounded-lg bg-[#51247a] px-6 py-2 text-sm font-medium text-white"
          >
            Back to course
          </button>
        </div>
      </div>
    );
  }

  const resuming =
    sessionState &&
    (sessionState.currentIndex > 0 ||
      Object.keys(sessionState.answers).length > 0);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-lg font-semibold text-gray-900">{exam.title}</h1>
        <p className="text-sm text-gray-500">
          Exam-style practice · {orderedQuestions.length} questions
          {resuming && sessionState
            ? ` · resuming at question ${sessionState.currentIndex + 1}`
            : ""}
        </p>
        <button
          type="button"
          onClick={handleRetake}
          className="mt-2 text-sm text-[#51247a] hover:underline"
        >
          Retake (shuffle questions)
        </button>
      </div>
      <ExamPlayer
        key={playerKey}
        questions={exam.questions}
        courseTitle={exam.courseCode}
        initialIndex={sessionState?.currentIndex ?? 0}
        initialQuestionOrder={
          sessionState?.questionOrder ??
          orderedQuestions.map((q) => q.id)
        }
        initialAnswers={sessionState?.answers}
        initialSubmitted={sessionState?.submitted}
        initialFlagged={sessionState?.flagged}
        onComplete={handleComplete}
        onAnswer={handleAnswer}
        onSessionChange={handleSessionChange}
      />
    </div>
  );
}

export default function PracticePage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#51247a] border-t-transparent" />
        </div>
      }
    >
      <PracticeContent examId={examId} />
    </Suspense>
  );
}
