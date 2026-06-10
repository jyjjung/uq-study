import { fetchCourseProfileEdge } from "./edge-course-profile";
import { fetchUqHtmlEdge } from "./edge-fetch";
import { stripHtml, textById } from "./edge-html";
import { extractProfileId, isCurrentProfileUrl } from "./profile-utils";
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

function offeringField(html: string, idx: string, field: string): string {
  const re = new RegExp(
    `id=['"]course-offering-${idx}-${field}['"][^>]*>([\\s\\S]*?)</(?:a|td)>`,
    "i",
  );
  const match = html.match(re);
  return match?.[1] ? stripHtml(match[1]) : "";
}

function offeringProfileUrl(html: string, idx: string): string | undefined {
  const re = new RegExp(
    `id=['"]course-offering-${idx}-profile['"][^>]*>([\\s\\S]*?)</td>`,
    "i",
  );
  const match = html.match(re);
  const href = match?.[1]?.match(/href=['"]([^'"]+)['"]/i)?.[1];
  if (!href || !isCurrentProfileUrl(href)) return undefined;
  return href;
}

function parseOfferings(html: string): {
  offerings: UQCourseOffering[];
  currentProfileUrl?: string;
} {
  const offerings: UQCourseOffering[] = [];
  const rowRe = /id=['"]course-offering-(\d+)['"]/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  let currentProfileUrl: string | undefined;

  while ((match = rowRe.exec(html)) !== null) {
    const idx = match[1];
    if (seen.has(idx)) continue;
    seen.add(idx);

    const profileUrl = offeringProfileUrl(html, idx);
    if (!currentProfileUrl && profileUrl) {
      currentProfileUrl = profileUrl;
    }

    offerings.push({
      semester: offeringField(html, idx, "sem"),
      mode: offeringField(html, idx, "mode"),
      campus: offeringField(html, idx, "loc") || undefined,
      profileUrl,
    });
  }

  return { offerings, currentProfileUrl };
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

  const { offerings, currentProfileUrl } = parseOfferings(html);
  let assessments = parseAssessments(assessmentMethods);
  let profile;

  if (currentProfileUrl) {
    const profileId = extractProfileId(currentProfileUrl);
    if (profileId) {
      try {
        profile = await fetchCourseProfileEdge(profileId);
        if (profile.assessments.length > 0) {
          assessments = profile.assessments;
        }
      } catch (error) {
        console.error(`Failed to fetch course profile ${profileId}:`, error);
      }
    }
  }

  return {
    code,
    title,
    level: textById(html, "course-level"),
    units: parseInt(textById(html, "course-units"), 10) || 2,
    duration: textById(html, "course-duration"),
    mode: profile?.attendanceMode || textById(html, "course-mode"),
    contact: textById(html, "course-contact"),
    prerequisites: textById(html, "course-prerequisite"),
    assessmentMethods,
    summary:
      textById(html, "course-summary") ||
      textById(html, "summary-content"),
    assessments,
    offerings,
    profile,
    url: `${BASE_URL}/course.html?course_code=${code}`,
  };
}
