import type { AssessmentGrade, UQAssessment, UQGradeBand, UQGradePoint } from "./types";

export const UQ_GRADE_BANDS: UQGradeBand[] = [
  { label: "7 (HD)", minPercent: 85, maxPercent: 100, gradePoint: 7 },
  { label: "6 (D)", minPercent: 75, maxPercent: 84, gradePoint: 6 },
  { label: "5 (C)", minPercent: 65, maxPercent: 74, gradePoint: 5 },
  { label: "4 (P)", minPercent: 50, maxPercent: 64, gradePoint: 4 },
  { label: "3 (F)", minPercent: 0, maxPercent: 49, gradePoint: 3 },
];

export function percentToGradePoint(percent: number): UQGradePoint {
  const band = UQ_GRADE_BANDS.find(
    (b) => percent >= b.minPercent && percent <= b.maxPercent,
  );
  return band?.gradePoint ?? 3;
}

export function gradePointToLabel(gp: UQGradePoint): string {
  const band = UQ_GRADE_BANDS.find((b) => b.gradePoint === gp);
  return band?.label ?? `${gp}`;
}

export function calculateWeightedPercent(
  assessments: AssessmentGrade[],
): number | null {
  const weighted = assessments.filter((a) => a.weight > 0);
  if (weighted.length === 0) return null;

  const totalWeight = weighted.reduce((sum, a) => sum + a.weight, 0);
  if (totalWeight === 0) return null;

  const sum = weighted.reduce((acc, a) => {
    const score = a.score ?? 0;
    const percent = a.maxScore > 0 ? (score / a.maxScore) * 100 : 0;
    return acc + percent * a.weight;
  }, 0);

  return sum / totalWeight;
}

export function calculateCourseGPA(percent: number): UQGradePoint {
  return percentToGradePoint(percent);
}

export function calculateProgramGPA(
  courses: { units: number; gradePoint: UQGradePoint }[],
): number | null {
  if (courses.length === 0) return null;
  const totalUnits = courses.reduce((sum, c) => sum + c.units, 0);
  if (totalUnits === 0) return null;
  const weighted = courses.reduce(
    (sum, c) => sum + c.gradePoint * c.units,
    0,
  );
  return weighted / totalUnits;
}

export function assessmentsToGrades(assessments: UQAssessment[]): AssessmentGrade[] {
  return assessments.map((a, i) => ({
    id: a.id || `assessment-${i}`,
    name: a.name,
    weight: a.weight ?? 0,
    score: null,
    maxScore: 100,
  }));
}

export function parseAssessmentMethods(methods: string): AssessmentGrade[] {
  const parts = methods.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  const weight = parts.length > 0 ? Math.round(100 / parts.length) : 100;

  return parts.map((name, i) => ({
    id: `assessment-${i}`,
    name,
    weight,
    score: null,
    maxScore: 100,
  }));
}
