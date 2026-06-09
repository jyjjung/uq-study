import type { ExamQuestion, PracticeExam } from "./types";
import type { UQCourse } from "../uq/types";
import { isDue } from "../spaced-repetition/sm2";

export interface ModuleProgress {
  attempted: number;
  total: number;
  accuracy: number;
  dueCount: number;
}

export interface StudyModule {
  number: number;
  slug: string;
  name: string;
  courseCode: string;
  courseTitle: string;
  questionCount: number;
  progress: ModuleProgress;
}

export interface QuestionProgressLike {
  questionId: string;
  courseCode: string;
  topic?: string;
  module?: string;
  sourceExamId?: string;
  correct: number;
  total: number;
  sm2: { nextReview: string };
}

export function parseModuleNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  const labeled =
    trimmed.match(/(?:^|\b)module\s*(\d+)/i) ??
    trimmed.match(/online\s+module:\s*(\d+)/i);
  if (labeled) return parseInt(labeled[1], 10);

  return null;
}

export function moduleSlug(number: number): string {
  return String(number);
}

export function decodeModuleSlug(slug: string): string {
  const n = parseInt(slug, 10);
  return Number.isFinite(n) ? `Module ${n}` : slug;
}

export function questionModuleNumber(question: ExamQuestion): number | null {
  return parseModuleNumber(question.module);
}

export function questionMatchesModuleNumber(
  question: ExamQuestion,
  moduleNumber: number,
): boolean {
  return questionModuleNumber(question) === moduleNumber;
}

export function collectModuleNumbers(
  course: UQCourse | null,
  exams: PracticeExam[],
  courseCode: string,
): number[] {
  const code = courseCode.toUpperCase();
  const numbers = new Set<number>();

  for (const activity of course?.profile?.learningActivities ?? []) {
    const n = parseModuleNumber(activity.topic);
    if (n) numbers.add(n);
  }

  for (const exam of exams) {
    if (exam.courseCode.toUpperCase() !== code) continue;
    for (const q of exam.questions) {
      const n = questionModuleNumber(q);
      if (n) numbers.add(n);
    }
  }

  return [...numbers].sort((a, b) => a - b);
}

export function getOriginalQuestionId(questionId: string): string {
  const idx = questionId.indexOf(":");
  return idx >= 0 ? questionId.slice(idx + 1) : questionId;
}

export function progressDocId(question: ExamQuestion): string {
  const originalId = getOriginalQuestionId(question.id);
  const examId = question.sourceExamId;
  if (examId && examId !== "uploaded") {
    return `${examId}:${originalId}`;
  }
  return originalId;
}

export function enrichQuestionForProgress(
  question: ExamQuestion,
  examId: string,
): ExamQuestion {
  const originalId = getOriginalQuestionId(question.id);
  return {
    ...question,
    id: `${examId}:${originalId}`,
    sourceExamId: examId,
  };
}

export function progressMatchesBankQuestion(
  entry: QuestionProgressLike,
  bankQuestion: ExamQuestion,
): boolean {
  const compositeId = bankQuestion.id;
  const originalId = getOriginalQuestionId(compositeId);
  const sourceExamId = bankQuestion.sourceExamId;
  const moduleNum = questionModuleNumber(bankQuestion);

  if (entry.questionId === compositeId) return true;

  if (sourceExamId && entry.questionId === `${sourceExamId}:${originalId}`) {
    return true;
  }

  if (
    sourceExamId &&
    entry.sourceExamId === sourceExamId &&
    entry.questionId === originalId
  ) {
    return true;
  }

  // Legacy quiz progress saved under the bare question id
  if (entry.questionId === originalId && moduleNum != null) {
    const entryModule =
      parseModuleNumber(entry.module) ?? parseModuleNumber(entry.topic);
    if (entryModule !== moduleNum) return false;
    if (
      !entry.sourceExamId ||
      entry.sourceExamId === sourceExamId ||
      entry.sourceExamId === "uploaded"
    ) {
      return true;
    }
  }

  return false;
}

export function findProgressForBankQuestion(
  bankQuestion: ExamQuestion,
  progressList: QuestionProgressLike[],
): QuestionProgressLike | undefined {
  for (const entry of progressList) {
    if (progressMatchesBankQuestion(entry, bankQuestion)) return entry;
  }
  return undefined;
}

export function computeModuleProgress(
  exams: PracticeExam[],
  courseCode: string,
  moduleNumber: number,
  progress: QuestionProgressLike[],
): ModuleProgress {
  const code = courseCode.toUpperCase();
  const bank = getModuleQuestions(exams, courseCode, moduleSlug(moduleNumber));
  const courseProgress = progress.filter((p) => p.courseCode === code);

  let attempted = 0;
  let correct = 0;
  let totalAttempts = 0;
  let dueCount = 0;

  for (const question of bank) {
    const entry = findProgressForBankQuestion(question, courseProgress);
    if (!entry || entry.total <= 0) continue;

    attempted++;
    correct += entry.correct;
    totalAttempts += entry.total;
    if (isDue(entry.sm2.nextReview)) dueCount++;
  }

  return {
    attempted,
    total: bank.length,
    accuracy:
      totalAttempts > 0 ? Math.round((correct / totalAttempts) * 100) : 0,
    dueCount,
  };
}

export function buildStudyModules(
  courseCode: string,
  courseTitle: string,
  course: UQCourse | null,
  exams: PracticeExam[],
  progress: QuestionProgressLike[] = [],
): StudyModule[] {
  const numbers = collectModuleNumbers(course, exams, courseCode);

  return numbers.map((number) => {
    const slug = moduleSlug(number);
    const questionCount = getModuleQuestions(exams, courseCode, slug).length;
    return {
      number,
      slug,
      name: `Module ${number}`,
      courseCode: courseCode.toUpperCase(),
      courseTitle,
      questionCount,
      progress: computeModuleProgress(exams, courseCode, number, progress),
    };
  });
}

export function getModuleQuestions(
  exams: PracticeExam[],
  courseCode: string,
  moduleSlugValue: string,
): ExamQuestion[] {
  const code = courseCode.toUpperCase();
  const moduleNumber = parseInt(moduleSlugValue, 10);
  if (!Number.isFinite(moduleNumber)) return [];

  const questions: ExamQuestion[] = [];

  for (const exam of exams) {
    if (exam.courseCode.toUpperCase() !== code) continue;
    for (const q of exam.questions) {
      if (!questionMatchesModuleNumber(q, moduleNumber)) continue;
      questions.push({
        ...q,
        id: `${exam.id}:${q.id}`,
        sourceExamId: exam.id,
        module: String(moduleNumber),
      });
    }
  }

  return questions;
}

export function moduleSessionId(
  courseCode: string,
  moduleSlugValue: string,
): string {
  return `module-${courseCode.toUpperCase()}-${moduleSlugValue}`;
}
