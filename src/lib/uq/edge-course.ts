import { fetchUqHtmlEdge } from "./edge-fetch";
import { textById } from "./edge-html";
import type { UQAssessment, UQCourse, UQCourseOffering } from "./types";

const BASE_URL = "https://programs-courses.uq.edu.au";

function classifyAssessment(name: string): UQAssessment["type"] {
  const lower = name.toLowerCase();
  if (lower.includes("exam")) return "exam";
  if (lower.includes("quiz") || lower.includes("test")) return "quiz";
  if (lower.includes("presentation")) return "presentation";
  if (lower.includes("assignment") || lower.includes("essay")) return "assignment";
  if (lower.includes("demonstration") || lower.includes("demo")) return "demonstration";
  if (lower.includes("project")) return "project";
  return "other";
}

function parseAssessments(methods: string): UQAssessment[] {
  const parts = methods.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  const weight = parts.length > 0 ? Math.round(100 / parts.length) : 100;
  return parts.map((name, i) => ({
    id: `assessment-${i}`,
    name,
    description: `Assessment component: ${name}. Check your course profile for detailed requirements, weighting, and due dates.`,
    weight,
    type: classifyAssessment(name),
  }));
}

function parseOfferings(html: string): UQCourseOffering[] {
  const offerings: UQCourseOffering[] = [];
  const rowRe = /id="course-offering-(\d+)"/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = rowRe.exec(html)) !== null) {
    const idx = match[1];
    if (seen.has(idx)) continue;
    seen.add(idx);

    offerings.push({
      semester: textById(html, `course-offering-${idx}-semester`),
      mode: textById(html, `course-offering-${idx}-mode`),
      campus: textById(html, `course-offering-${idx}-campus`) || undefined,
      profileUrl: undefined,
    });
  }

  return offerings;
}

export async function fetchCourseEdge(courseCode: string): Promise<UQCourse> {
  const code = courseCode.toUpperCase();
  const html = await fetchUqHtmlEdge(
    `${BASE_URL}/course.html?course_code=${code}`,
  );

  const titleRaw = textById(html, "course-title");
  const titleMatch = titleRaw.match(/^(.+?)\s*\(([A-Z0-9]+)\)$/);
  const title = titleMatch ? titleMatch[1].trim() : titleRaw;
  const assessmentMethods = textById(html, "course-assessment-methods");

  return {
    code,
    title,
    level: textById(html, "course-level"),
    units: parseInt(textById(html, "course-units"), 10) || 2,
    duration: textById(html, "course-duration"),
    mode: textById(html, "course-mode"),
    contact: textById(html, "course-contact"),
    prerequisites: textById(html, "course-prerequisite"),
    assessmentMethods,
    summary:
      textById(html, "course-summary") ||
      textById(html, "summary-content"),
    assessments: parseAssessments(assessmentMethods),
    offerings: parseOfferings(html),
    url: `${BASE_URL}/course.html?course_code=${code}`,
  };
}
