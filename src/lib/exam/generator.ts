import type { ExamQuestion, StudyRecommendation } from "./types";
import type { SM2Card } from "../spaced-repetition/sm2";
import { isDue } from "../spaced-repetition/sm2";
import { parseModuleNumber } from "./modules";

const CITATION_MARKERS = /\[cite_start\]|\[cite:\s*[^\]]*\]/gi;

export function sanitizeExamJsonText(text: string): string {
  return text.replace(/\[cite_start\]/gi, "");
}

function cleanCitationArtifacts(text: string): string {
  return text.replace(CITATION_MARKERS, "").trim();
}

export function parseExamJsonText(
  text: string,
  courseCode: string,
): { title: string; questions: ExamQuestion[] } | null {
  try {
    const json = JSON.parse(sanitizeExamJsonText(text.trim()));
    const parsed = parseUploadedExam(json, courseCode, "");
    if (!parsed || parsed.questions.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildStudyRecommendations(
  progress: Array<{
    topic: string;
    correct: number;
    total: number;
    sm2: SM2Card;
  }>,
): StudyRecommendation[] {
  const byTopic = new Map<
    string,
    { correct: number; total: number; due: boolean }
  >();

  for (const p of progress) {
    const existing = byTopic.get(p.topic) ?? {
      correct: 0,
      total: 0,
      due: false,
    };
    byTopic.set(p.topic, {
      correct: existing.correct + p.correct,
      total: existing.total + p.total,
      due: existing.due || isDue(p.sm2.nextReview),
    });
  }

  return [...byTopic.entries()]
    .map(([topic, stats]) => {
      const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
      let priority: StudyRecommendation["priority"] = "low";
      let reason = "You're performing well on this topic.";

      if (accuracy < 50 || stats.due) {
        priority = "high";
        reason = stats.due
          ? "Questions are due for spaced repetition review."
          : "Low accuracy — revise this topic in your course materials.";
      } else if (accuracy < 75) {
        priority = "medium";
        reason = "Moderate performance — more revision of this content recommended.";
      }

      return {
        topic,
        priority,
        reason,
        questionCount: stats.total,
        accuracy: Math.round(accuracy),
      };
    })
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

export function parseUploadedExam(
  json: unknown,
  courseCode: string,
  _userId: string,
): { title: string; questions: ExamQuestion[] } | null {
  if (!json || typeof json !== "object") return null;
  const data = json as Record<string, unknown>;

  if (!Array.isArray(data.questions)) return null;

  const questions: ExamQuestion[] = data.questions.map((q: unknown, i: number) => {
    const item = q as Record<string, unknown>;
    const moduleNumber =
      parseModuleNumber(item.module) ?? parseModuleNumber(item.topic);
    const question: ExamQuestion = {
      id: (item.id as string) ?? `uploaded-${i}`,
      type: (item.type as ExamQuestion["type"]) ?? "multiple_choice",
      stem: cleanCitationArtifacts(String(item.stem ?? item.question ?? "")),
      correctAnswer: (item.correctAnswer ?? item.answer ?? "") as string | string[],
      explanation: cleanCitationArtifacts(String(item.explanation ?? "")),
    };
    if (moduleNumber) {
      question.module = moduleNumber;
    }
    if (Array.isArray(item.options)) {
      question.options = item.options.map((o: unknown, j: number) => {
        const opt = o as Record<string, unknown>;
        return {
          id: (opt.id as string) ?? String.fromCharCode(97 + j),
          text: cleanCitationArtifacts(String(opt.text ?? o)),
        };
      });
    }
    if (Array.isArray(item.media)) {
      question.media = item.media as ExamQuestion["media"];
    }
    return question;
  });

  return {
    title: String(data.title ?? `Practice Exam - ${courseCode}`),
    questions,
  };
}
