import type { ExamQuestion } from "./types";

export function shuffleQuestions(questions: ExamQuestion[]): ExamQuestion[] {
  const copy = [...questions];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function orderQuestions(
  questions: ExamQuestion[],
  order: string[],
): ExamQuestion[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const ordered = order
    .map((id) => byId.get(id))
    .filter((q): q is ExamQuestion => !!q);
  for (const q of questions) {
    if (!order.includes(q.id)) ordered.push(q);
  }
  return ordered;
}
