export type QuestionType = "multiple_choice" | "short_answer" | "multi_select";

export interface ExamMedia {
  type: "image" | "table" | "graph";
  url?: string;
  alt?: string;
  caption?: string;
  tableData?: string[][];
}

export interface ExamOption {
  id: string;
  text: string;
}

export interface ExamQuestion {
  id: string;
  type: QuestionType;
  stem: string;
  options?: ExamOption[];
  correctAnswer: string | string[];
  explanation: string;
  topic?: string;
  module?: number | string;
  assessmentId?: string;
  sourceExamId?: string;
  media?: ExamMedia[];
  difficulty?: "easy" | "medium" | "hard";
}

export interface PracticeExam {
  id: string;
  title: string;
  courseCode: string;
  assessmentId?: string;
  assessmentName?: string;
  questions: ExamQuestion[];
  createdAt: string;
  userId: string;
}

export interface ExamSessionAnswer {
  questionId: string;
  selected: string | string[];
  correct: boolean;
  timeSpentMs: number;
}

export interface ExamSession {
  id: string;
  examId: string;
  courseCode: string;
  answers: ExamSessionAnswer[];
  score: number;
  total: number;
  completedAt: string;
}

export interface PracticeExamSessionState {
  currentIndex: number;
  questionOrder: string[];
  answers: Record<string, string | string[]>;
  submitted: Record<string, boolean>;
  flagged: string[];
}

export interface StudyRecommendation {
  topic: string;
  priority: "high" | "medium" | "low";
  reason: string;
  questionCount: number;
  accuracy: number;
}

