import { fetchUqHtmlEdge } from "./edge-fetch";
import { stripHtml, textById } from "./edge-html";
import type { UQProgram, UQProgramCourse } from "./types";

const BASE_URL = "https://programs-courses.uq.edu.au";

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

function parseProgramCourses(html: string): UQProgramCourse[] {
  const courses: UQProgramCourse[] = [];
  const seen = new Set<string>();

  const requirements = extractProgramRequirementsJson(html);
  if (requirements) {
    walkProgramRequirements(requirements, courses, seen);
    if (courses.length > 0) {
      return courses.sort((a, b) => a.code.localeCompare(b.code));
    }
  }

  const courseRe =
    /href="[^"]*course\.html\?course_code=([A-Z0-9]+)[^"]*"[^>]*>([^<]+)</gi;
  let match: RegExpExecArray | null;
  while ((match = courseRe.exec(html)) !== null) {
    const code = match[1].toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    courses.push({
      code,
      title: stripHtml(match[2]) || code,
    });
  }

  return courses.sort((a, b) => a.code.localeCompare(b.code));
}

export async function fetchProgramEdge(programId: string): Promise<UQProgram> {
  const html = await fetchUqHtmlEdge(
    `${BASE_URL}/program.html?acad_prog=${programId}`,
  );

  const title =
    textById(html, "program-title") ||
    stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "") ||
    "Program";

  const requirementsMatch = html.match(/href="([^"]*\/requirements\/program\/[^"]+)"/i);
  const requirementsHref = requirementsMatch?.[1] ?? "";
  const requirementsUrl = requirementsHref.startsWith("http")
    ? requirementsHref
    : requirementsHref
      ? `${BASE_URL}${requirementsHref}`
      : "";

  let courses: UQProgramCourse[] = [];
  if (requirementsUrl) {
    const reqHtml = await fetchUqHtmlEdge(requirementsUrl);
    courses = parseProgramCourses(reqHtml);
  }

  return {
    id: programId,
    title: title.replace(/^Program:\s*/i, "").trim(),
    units: textById(html, "program-domestic-units"),
    attendanceMode:
      textById(html, "program-domestic-attendance") ||
      textById(html, "program-international-attendance"),
    description: textById(html, "program-description") || "",
    requirementsUrl,
    courses,
    url: `${BASE_URL}/program.html?acad_prog=${programId}`,
  };
}
