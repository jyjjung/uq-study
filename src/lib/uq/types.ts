export interface UQSearchResult {
  type: "program" | "course";
  id: string;
  code?: string;
  title: string;
  url: string;
}

export interface UQAssessment {
  id: string;
  name: string;
  description: string;
  weight?: number;
  weightLabel?: string;
  dueDate?: string;
  category?: string;
  mode?: string;
  learningOutcomes?: string[];
  type: "exam" | "assignment" | "quiz" | "demonstration" | "project" | "presentation" | "other";
  profileUrl?: string;
}

export interface UQLearningOutcome {
  id: string;
  text: string;
}

export interface UQLearningActivity {
  period: string;
  activityType: string;
  topic: string;
}

export interface UQCourseProfile {
  profileId: string;
  url: string;
  studyPeriod: string;
  location: string;
  attendanceMode: string;
  aims: string;
  learningOutcomes: UQLearningOutcome[];
  assessments: UQAssessment[];
  learningActivities: UQLearningActivity[];
  learningResources: string;
}

export interface UQCourse {
  code: string;
  title: string;
  level: string;
  units: number;
  duration: string;
  mode: string;
  contact: string;
  prerequisites: string;
  assessmentMethods: string;
  summary: string;
  assessments: UQAssessment[];
  offerings: UQCourseOffering[];
  profile?: UQCourseProfile;
  url: string;
}

export interface UQCourseOffering {
  semester: string;
  mode: string;
  campus?: string;
  profileUrl?: string;
}

export interface UQProgram {
  id: string;
  title: string;
  units: string;
  attendanceMode: string;
  description: string;
  requirementsUrl: string;
  courses: UQProgramCourse[];
  url: string;
}

export interface UQProgramCourse {
  code: string;
  title: string;
  units?: number;
  requirementType?: string;
}

export type UQGradePoint = 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0;

export interface UQGradeBand {
  label: string;
  minPercent: number;
  maxPercent: number;
  gradePoint: UQGradePoint;
}

export interface AssessmentGrade {
  id: string;
  name: string;
  weight: number;
  score: number | null;
  maxScore: number;
}
