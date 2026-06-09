"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Clock, Flag } from "lucide-react";
import type {
  ExamQuestion,
  ExamSessionAnswer,
  PracticeExamSessionState,
} from "@/lib/exam/types";

interface QueueItem {
  instanceId: string;
  question: ExamQuestion;
}

function resolveQuestion(
  instanceId: string,
  questions: ExamQuestion[],
): ExamQuestion | undefined {
  const direct = questions.find((q) => q.id === instanceId);
  if (direct) return direct;
  return questions.find((q) => instanceId.startsWith(`${q.id}-`));
}

const RETRY_OFFSET = 5;
const MIN_REMAINING_FOR_RETRY_OFFSET = 4;

function insertWrongAnswerRetry(
  queue: QueueItem[],
  currentIndex: number,
  retryItem: QueueItem,
): QueueItem[] {
  const remainingAfterCurrent = queue.length - 1 - currentIndex;
  if (remainingAfterCurrent < MIN_REMAINING_FOR_RETRY_OFFSET) {
    return [...queue, retryItem];
  }

  const insertIndex = currentIndex + RETRY_OFFSET + 1;
  const next = [...queue];
  next.splice(Math.min(insertIndex, next.length), 0, retryItem);
  return next;
}

function buildQueueFromOrder(
  questions: ExamQuestion[],
  order: string[],
): QueueItem[] {
  const queue: QueueItem[] = [];
  for (const instanceId of order) {
    const question = resolveQuestion(instanceId, questions);
    if (question) queue.push({ instanceId, question });
  }
  return queue.length > 0
    ? queue
    : questions.map((q) => ({ instanceId: q.id, question: q }));
}

interface ExamPlayerProps {
  questions: ExamQuestion[];
  courseTitle: string;
  initialIndex?: number;
  initialQuestionOrder?: string[];
  initialAnswers?: Record<string, string | string[]>;
  initialSubmitted?: Record<string, boolean>;
  initialFlagged?: string[];
  onComplete: (answers: ExamSessionAnswer[]) => void;
  onAnswer?: (question: ExamQuestion, correct: boolean, timeSpentMs: number) => void;
  onSessionChange?: (state: PracticeExamSessionState) => void;
}

export function ExamPlayer({
  questions,
  courseTitle,
  initialIndex = 0,
  initialQuestionOrder,
  initialAnswers = {},
  initialSubmitted = {},
  initialFlagged = [],
  onComplete,
  onAnswer,
  onSessionChange,
}: ExamPlayerProps) {
  const [questionQueue, setQuestionQueue] = useState<QueueItem[]>(() =>
    initialQuestionOrder?.length
      ? buildQueueFromOrder(questions, initialQuestionOrder)
      : questions.map((q) => ({ instanceId: q.id, question: q })),
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(
    initialAnswers,
  );
  const [submitted, setSubmitted] = useState<Record<string, boolean>>(
    initialSubmitted,
  );
  const [startTime] = useState(Date.now());
  const [questionStart, setQuestionStart] = useState(Date.now());
  const [flagged, setFlagged] = useState<Set<string>>(
    () => new Set(initialFlagged),
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = questionQueue[currentIndex];
  const question = current?.question;
  const instanceId = current?.instanceId ?? "";
  const isLast = currentIndex === questionQueue.length - 1;

  useEffect(() => {
    if (!onSessionChange) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onSessionChange({
        currentIndex,
        questionOrder: questionQueue.map((item) => item.instanceId),
        answers,
        submitted,
        flagged: [...flagged],
      });
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [currentIndex, answers, submitted, flagged, questionQueue, onSessionChange]);

  const submitAnswer = useCallback(
    (optionId: string) => {
      if (!question || submitted[instanceId]) return;

      const timeSpent = Date.now() - questionStart;
      const correct =
        typeof question.correctAnswer === "string"
          ? optionId === question.correctAnswer
          : Array.isArray(question.correctAnswer) &&
            question.correctAnswer.includes(optionId);

      setAnswers((prev) => ({ ...prev, [instanceId]: optionId }));
      setSubmitted((prev) => ({ ...prev, [instanceId]: true }));

      if (!correct) {
        const retryItem: QueueItem = {
          instanceId: `${question.id}-retry-${Date.now()}`,
          question,
        };
        setQuestionQueue((prev) =>
          insertWrongAnswerRetry(prev, currentIndex, retryItem),
        );
      }

      onAnswer?.(question, correct, timeSpent);
    },
    [currentIndex, instanceId, onAnswer, question, questionStart, submitted],
  );

  const finishExam = useCallback(() => {
    const sessionAnswers: ExamSessionAnswer[] = questionQueue.map((item) => {
      const selected = answers[item.instanceId] ?? "";
      const correct =
        typeof item.question.correctAnswer === "string"
          ? selected === item.question.correctAnswer
          : false;
      return {
        questionId: item.question.id,
        selected,
        correct,
        timeSpentMs: 0,
      };
    });
    onComplete(sessionAnswers);
  }, [answers, onComplete, questionQueue]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => {
      if (i < questionQueue.length - 1) {
        setQuestionStart(Date.now());
        return i + 1;
      }
      return i;
    });
  }, [questionQueue.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => {
      if (i > 0) {
        setQuestionStart(Date.now());
        return i - 1;
      }
      return i;
    });
  }, []);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) =>
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      if (e.key === "Enter") {
        e.preventDefault();
        if (submitted[instanceId]) {
          if (isLast) finishExam();
          else goNext();
        }
        return;
      }

      if (/^[1-9]$/.test(e.key)) {
        if (submitted[instanceId]) return;
        if (question?.type !== "multiple_choice" || !question.options) return;

        const option = question.options[parseInt(e.key, 10) - 1];
        if (!option) return;

        e.preventDefault();
        submitAnswer(option.id);
        return;
      }

      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      if (e.target instanceof HTMLInputElement) return;

      e.preventDefault();
      if (e.key === "ArrowLeft") goPrev();
      else goNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    finishExam,
    goNext,
    goPrev,
    instanceId,
    isLast,
    question,
    submitAnswer,
    submitted,
  ]);

  const toggleFlag = () => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  };

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  if (!question) {
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between rounded-t-lg border border-gray-300 bg-[#e8e8e8] px-4 py-2">
        <span className="text-sm font-medium text-gray-700">
          Question {currentIndex + 1} of {questionQueue.length}
        </span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          <button
            onClick={toggleFlag}
            className={`flex items-center gap-1 text-sm ${
              flagged.has(instanceId) ? "text-amber-600" : "text-gray-500"
            }`}
          >
            <Flag className="h-4 w-4" />
            Flag
          </button>
        </div>
      </div>

      <div className="min-h-[400px] rounded-b-lg border border-t-0 border-gray-300 bg-white p-6 shadow-sm">
        <div className="mb-6 border-b border-gray-200 pb-4">
          {question.module != null && (
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Module {question.module}
            </p>
          )}
          <div
            className="mt-2 text-base leading-relaxed text-gray-900"
            dangerouslySetInnerHTML={{ __html: question.stem }}
          />
        </div>

        {question.media?.map((m, i) => (
          <div key={i} className="mb-4">
            {m.type === "image" && m.url && (
              <div className="relative mx-auto max-w-md">
                <Image
                  src={m.url}
                  alt={m.alt ?? "Question image"}
                  width={400}
                  height={300}
                  className="rounded border"
                />
                {m.caption && (
                  <p className="mt-1 text-center text-xs text-gray-500">{m.caption}</p>
                )}
              </div>
            )}
            {m.type === "table" && m.tableData && (
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <tbody>
                  {m.tableData.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="border border-gray-300 px-3 py-2"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}

        {question.type === "multiple_choice" && question.options && (
          <div className="space-y-3">
            {question.options.map((opt, optionIndex) => {
              const selected = answers[instanceId] === opt.id;
              const isCorrect = submitted[instanceId] && opt.id === question.correctAnswer;
              const isWrong =
                submitted[instanceId] &&
                selected &&
                opt.id !== question.correctAnswer;

              return (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                    isCorrect
                      ? "border-green-500 bg-green-50"
                      : isWrong
                        ? "border-red-400 bg-red-50"
                        : selected
                          ? "border-[#51247a] bg-[#51247a]/5"
                          : "border-gray-200 hover:border-gray-300"
                  } ${submitted[instanceId] ? "cursor-default" : ""}`}
                >
                  <input
                    type="radio"
                    name={instanceId}
                    value={opt.id}
                    checked={selected}
                    onChange={() => submitAnswer(opt.id)}
                    disabled={!!submitted[instanceId]}
                    className="mt-1 h-4 w-4 accent-[#51247a]"
                  />
                  <span className="text-sm text-gray-800">
                    <span className="mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded bg-gray-100 px-1 text-xs font-semibold text-gray-600">
                      {optionIndex + 1}
                    </span>
                    <span className="mr-2 font-semibold uppercase">{opt.id}.</span>
                    {opt.text}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {submitted[instanceId] && question.explanation && (
          <div
            className={`mt-4 rounded-lg p-4 text-sm ${
              answers[instanceId] !== question.correctAnswer
                ? "border border-amber-200 bg-amber-50 text-amber-900"
                : "bg-blue-50 text-blue-900"
            }`}
          >
            <p className="mt-1">{question.explanation}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>

        <div className="flex max-w-[40%] flex-wrap justify-center gap-1">
          {questionQueue.map((item, i) => (
            <button
              key={item.instanceId}
              onClick={() => {
                setCurrentIndex(i);
                setQuestionStart(Date.now());
              }}
              className={`h-2 w-2 rounded-full ${
                i === currentIndex
                  ? "bg-[#51247a]"
                  : answers[item.instanceId]
                    ? "bg-[#51247a]/40"
                    : flagged.has(item.instanceId)
                      ? "bg-amber-400"
                      : "bg-gray-300"
              }`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {submitted[instanceId] &&
            (isLast ? (
              <button
                onClick={finishExam}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white"
              >
                Finish exam <span className="text-white/70">↵</span>
              </button>
            ) : (
              <button
                onClick={goNext}
                className="flex items-center gap-1 rounded-lg bg-[#51247a] px-4 py-2 text-sm font-medium text-white"
              >
                Next
                <ChevronRight className="h-4 w-4" />
                <span className="text-white/70">↵</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
