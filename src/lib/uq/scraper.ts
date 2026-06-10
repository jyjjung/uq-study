import * as cheerio from "cheerio";
import {
  extractProfileId,
  fetchCourseProfile,
  isCurrentProfileUrl,
} from "./course-profile";
import { fetchUqHtml } from "./http";
import type {
  UQAssessment,
  UQCourse,
  UQCourseOffering,
  UQProgram,
  UQProgramCourse,
  UQSearchResult,
} from "./types";

const BASE_URL = "https://programs-courses.uq.edu.au";

async function fetchHtml(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  return fetchUqHtml(url);
}

function textOf(
  $: ReturnType<typeof cheerio.load>,
  selector: string,
): string {
  return $(selector).first().text().replace(/\s+/g, " ").trim();
}

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

function extractProgramRequirementsJson(html: string): unknown | null {
  const marker = '"programRequirements"';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  const braceStart = html.indexOf("{", idx);
  if (braceStart === -1) return null;

  let depth = 0;
  for (let i = braceStart; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(braceStart, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function walkProgramRequirements(
  obj: unknown,
  courses: UQProgramCourse[],
  seen: Set<string>,
  requirementType?: string,
): void {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      walkProgramRequirements(item, courses, seen, requirementType);
    }
    return;
  }

  const record = obj as Record<string, unknown>;

  if (record.type === "Course" && typeof record.code === "string") {
    const code = record.code.toUpperCase();
    if (!/^[A-Z]{4}\d{4}$/.test(code)) return;
    if (!seen.has(code)) {
      seen.add(code);
      courses.push({
        code,
        title: typeof record.name === "string" ? record.name : code,
        units:
          typeof record.units === "number"
            ? record.units
            : typeof record.units === "string"
              ? parseInt(record.units, 10) || undefined
              : undefined,
        requirementType,
      });
    }
  }

  if (typeof record.title === "string" && record.title.length > 0) {
    requirementType = record.title;
  }

  for (const value of Object.values(record)) {
    walkProgramRequirements(value, courses, seen, requirementType);
  }
}

export async function searchUQ(
  query: string,
  type: "all" | "program" | "course" = "all",
): Promise<UQSearchResult[]> {
  const searchType =
    type === "program" ? "program" : type === "course" ? "course" : "all";
  const html = await fetchHtml(
    `/search.html?searchType=${searchType}&keywords=${encodeURIComponent(query)}`,
  );
  const $ = cheerio.load(html);
  const results: UQSearchResult[] = [];
  const seen = new Set<string>();

  $('a[href*="program.html"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(/acad_prog=(\d+)/);
    if (!match) return;
    const id = match[1];
    const key = `program-${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    const title = $(el).text().replace(/\s+/g, " ").trim();
    if (!title) return;
    results.push({
      type: "program",
      id,
      title,
      url: `${BASE_URL}/program.html?acad_prog=${id}`,
    });
  });

  $('a[href*="course.html"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(/course_code=([A-Z0-9]+)/i);
    if (!match) return;
    const code = match[1].toUpperCase();
    const key = `course-${code}`;
    if (seen.has(key)) return;
    seen.add(key);
    const title = $(el).text().replace(/\s+/g, " ").trim();
    results.push({
      type: "course",
      id: code,
      code,
      title: title || code,
      url: `${BASE_URL}/course.html?course_code=${code}`,
    });
  });

  return results;
}

export async function fetchCourse(courseCode: string): Promise<UQCourse> {
  const code = courseCode.toUpperCase();
  const html = await fetchHtml(`/course.html?course_code=${code}`);
  const $ = cheerio.load(html);

  const titleRaw = textOf($, "#course-title");
  const titleMatch = titleRaw.match(/^(.+?)\s*\(([A-Z0-9]+)\)$/);
  const title = titleMatch ? titleMatch[1].trim() : titleRaw;
  const assessmentMethods = textOf($, "#course-assessment-methods");

  const offerings: UQCourseOffering[] = [];
  let currentProfileUrl: string | undefined;

  $("tr[id^='course-offering-']").each((_, row) => {
    const id = $(row).attr("id") ?? "";
    const idx = id.replace("course-offering-", "");
    const profileLink = $(`#course-offering-${idx}-profile a, #course-offering-${idx}-profile`)
      .find("a")
      .attr("href");
    const profileUrl =
      profileLink && isCurrentProfileUrl(profileLink)
        ? profileLink
        : undefined;

    if (!currentProfileUrl && profileUrl) {
      currentProfileUrl = profileUrl;
    }

    offerings.push({
      semester: textOf($, `#course-offering-${idx}-sem`),
      mode: textOf($, `#course-offering-${idx}-mode`),
      campus: textOf($, `#course-offering-${idx}-loc`) || undefined,
      profileUrl,
    });
  });

  let assessments = parseAssessments(assessmentMethods);
  let profile;

  if (currentProfileUrl) {
    const profileId = extractProfileId(currentProfileUrl);
    if (profileId) {
      try {
        profile = await fetchCourseProfile(profileId);
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
    title: profile ? title : title,
    level: textOf($, "#course-level"),
    units: parseInt(textOf($, "#course-units"), 10) || 2,
    duration: textOf($, "#course-duration"),
    mode: profile?.attendanceMode || textOf($, "#course-mode"),
    contact: textOf($, "#course-contact"),
    prerequisites: textOf($, "#course-prerequisite"),
    assessmentMethods,
    summary:
      textOf($, "#course-summary") ||
      textOf($, "#summary-content .usercontent") ||
      textOf($, "#summary-content"),
    assessments,
    offerings,
    profile,
    url: `${BASE_URL}/course.html?course_code=${code}`,
  };
}

export async function fetchProgram(programId: string): Promise<UQProgram> {
  const html = await fetchHtml(`/program.html?acad_prog=${programId}`);
  const $ = cheerio.load(html);

  const title =
    textOf($, "h1").replace(/^Program:\s*/i, "").trim() ||
    $("title").text().split("-")[0].trim();

  const requirementsHref =
    $('a[href*="/requirements/program/"]').first().attr("href") ?? "";
  const requirementsUrl = requirementsHref.startsWith("http")
    ? requirementsHref
    : `${BASE_URL}${requirementsHref}`;

  let courses: UQProgramCourse[] = [];
  if (requirementsHref) {
    courses = await fetchProgramCourses(requirementsUrl);
  }

  return {
    id: programId,
    title,
    units: textOf($, "#program-domestic-units") || textOf($, "h3 + p"),
    attendanceMode:
      textOf($, "#program-domestic-attendance") ||
      textOf($, "#program-international-attendance"),
    description: textOf($, ".usercontent"),
    requirementsUrl,
    courses,
    url: `${BASE_URL}/program.html?acad_prog=${programId}`,
  };
}

async function fetchProgramCourses(
  requirementsUrl: string,
): Promise<UQProgramCourse[]> {
  const html = await fetchHtml(requirementsUrl);
  const courses: UQProgramCourse[] = [];
  const seen = new Set<string>();

  const requirements = extractProgramRequirementsJson(html);
  if (requirements) {
    walkProgramRequirements(requirements, courses, seen);
    if (courses.length > 0) {
      return courses.sort((a, b) => a.code.localeCompare(b.code));
    }
  }

  // Fallback: legacy course.html links
  const $ = cheerio.load(html);
  $('a[href*="course.html"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(/course_code=([A-Z0-9]+)/i);
    if (!match) return;
    const code = match[1].toUpperCase();
    if (seen.has(code)) return;
    seen.add(code);
    const title = $(el).text().replace(/\s+/g, " ").trim();
    courses.push({
      code,
      title: title || code,
    });
  });

  return courses.sort((a, b) => a.code.localeCompare(b.code));
}
