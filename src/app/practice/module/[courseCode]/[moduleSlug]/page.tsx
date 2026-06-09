"use client";

import { Suspense, useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { ExamPlayer } from "@/components/exam/ExamPlayer";
import {
  updateQuestionProgress,
  createNewCard,
  getPracticeExams,
  getPracticeExamSession,
  savePracticeExamSession,
  deletePracticeExamSession,
} from "@/lib/firestore/db";
import { reviewCard, qualityFromAnswer } from "@/lib/spaced-repetition/sm2";
import { orderQuestions, shuffleQuestions } from "@/lib/exam/shuffle";
import {
  decodeModuleSlug,
  getModuleQuestions,
  moduleSessionId,
} from "@/lib/exam/modules";
import type {
  ExamSessionAnswer,
  ExamQuestion,
  PracticeExamSessionState,
} from "@/lib/exam/types";

function ModulePracticeContent({
  courseCode,
  moduleSlug,
}: {
  courseCode: string;
  moduleSlug: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const sessionId = moduleSessionId(courseCode, moduleSlug);
  const moduleName = decodeModuleSlug(moduleSlug);

  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [sessionState, setSessionState] = useState<PracticeExamSessionState | null>(
    null,
  );
  const [sessionReady, setSessionReady] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    let cancelled = false;

    async function load() {
      const exams = await getPracticeExams(user!.uid, courseCode);
      const bank = getModuleQuestions(exams, courseCode, moduleSlug);
      if (cancelled) return;

      if (bank.length === 0) {
        setQuestions([]);
        setLoading(false);
        setSessionReady(true);
        return;
      }

      const saved = await getPracticeExamSession(user!.uid, sessionId);
      if (cancelled) return;

      if (saved?.questionOrder?.length) {
        const ordered = orderQuestions(bank, saved.questionOrder).filter((q) =>
          bank.some((b) => b.id === q.id),
        );
        setQuestions(ordered.length > 0 ? ordered : bank);
        setSessionState({
          currentIndex: saved.currentIndex,
          questionOrder: saved.questionOrder,
          answers: saved.answers ?? {},
          submitted: saved.submitted ?? {},
          flagged: saved.flagged ?? [],
        });
      } else {
        setQuestions(bank);
        setSessionState(null);
      }
      setSessionReady(true);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, courseCode, moduleSlug, sessionId, router]);

  const handleSessionChange = useCallback(
    async (state: PracticeExamSessionState) => {
      if (!user) return;
      try {
        await savePracticeExamSession(
          user.uid,
          sessionId,
          courseCode,
          state,
        );
      } catch (err) {
        console.error("Failed to save session:", err);
      }
    },
    [user, sessionId, courseCode],
  );

  const handleRetake = async () => {
    if (!user) return;
    try {
      await deletePracticeExamSession(user.uid, sessionId);
    } catch {
      /* ignore */
    }
    setQuestions((q) => shuffleQuestions(q));
    setSessionState(null);
    setPlayerKey((k) => k + 1);
    setFinished(false);
  };

  const handleAnswer = async (
    question: ExamQuestion,
    correct: boolean,
    timeSpentMs: number,
  ) => {
    if (!user) return;
    try {
      const quality = qualityFromAnswer(correct, timeSpentMs);
      const sm2 = reviewCard(createNewCard(), quality);
      await updateQuestionProgress(
        user.uid,
        question,
        courseCode,
        correct,
        sm2,
      );
    } catch (err) {
      console.error("Failed to save progress:", err);
    }
  };

  const handleComplete = async (answers: ExamSessionAnswer[]) => {
    setScore({
      correct: answers.filter((a) => a.correct).length,
      total: answers.length,
    });
    setFinished(true);
    if (user) {
      try {
        await deletePracticeExamSession(user.uid, sessionId);
      } catch {
        /* ignore */
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

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-600">
          No questions in the bank for this module yet.
        </p>
        <Link
          href="/quizzes"
          className="mt-4 inline-block text-sm text-[#51247a] hover:underline"
        >
          Upload a quiz
        </Link>
      </div>
    );
  }

  if (finished) {
    const percent = Math.round((score.correct / score.total) * 100);
    return (
      <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Module complete</h2>
        <p className="mt-1 text-sm text-gray-500">{moduleName}</p>
        <p className="mt-2 text-4xl font-bold text-[#51247a]">
          {score.correct}/{score.total}
        </p>
        <p className="text-gray-600">{percent}%</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleRetake}
            className="rounded-lg border border-[#51247a] px-6 py-2 text-sm font-medium text-[#51247a]"
          >
            Retake (shuffle)
          </button>
          <Link
            href="/study-plan"
            className="rounded-lg bg-[#51247a] px-6 py-2 text-sm font-medium text-white"
          >
            Back to study
          </Link>
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
        <p className="text-sm text-[#51247a]">{courseCode.toUpperCase()}</p>
        <h1 className="text-lg font-semibold text-gray-900">{moduleName}</h1>
        <p className="text-sm text-gray-500">
          {questions.length} questions from your bank
          {resuming && sessionState
            ? ` · resuming at ${sessionState.currentIndex + 1}`
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
        questions={questions}
        courseTitle={courseCode}
        initialIndex={sessionState?.currentIndex ?? 0}
        initialQuestionOrder={
          sessionState?.questionOrder ?? questions.map((q) => q.id)
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

export default function ModulePracticePage({
  params,
}: {
  params: Promise<{ courseCode: string; moduleSlug: string }>;
}) {
  const { courseCode, moduleSlug } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#51247a] border-t-transparent" />
        </div>
      }
    >
      <ModulePracticeContent
        courseCode={courseCode}
        moduleSlug={moduleSlug}
      />
    </Suspense>
  );
}
