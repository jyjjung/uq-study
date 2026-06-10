import type { UQSearchResult } from "./types";

const BASE_URL = "https://programs-courses.uq.edu.au";

const FETCH_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  Referer: `${BASE_URL}/`,
  "Accept-Language": "en-AU,en;q=0.9",
};

export async function searchUQEdge(
  query: string,
  type: "all" | "program" | "course" = "all",
): Promise<UQSearchResult[]> {
  const searchType =
    type === "program" ? "program" : type === "course" ? "course" : "all";
  const url = `${BASE_URL}/search.html?searchType=${searchType}&keywords=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: FETCH_HEADERS,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`UQ fetch failed: ${res.status} ${url}`);
  }

  const html = await res.text();
  const results: UQSearchResult[] = [];
  const seen = new Set<string>();

  const programRe =
    /href="([^"]*program\.html\?acad_prog=(\d+)[^"]*)"[^>]*>([^<]+)</gi;
  let match: RegExpExecArray | null;
  while ((match = programRe.exec(html)) !== null) {
    const id = match[2];
    const key = `program-${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const title = match[3].replace(/\s+/g, " ").trim();
    if (!title) continue;
    results.push({
      type: "program",
      id,
      title,
      url: `${BASE_URL}/program.html?acad_prog=${id}`,
    });
  }

  const courseRe =
    /href="([^"]*course\.html\?course_code=([A-Z0-9]+)[^"]*)"[^>]*>([^<]+)</gi;
  while ((match = courseRe.exec(html)) !== null) {
    const code = match[2].toUpperCase();
    const key = `course-${code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const title = match[3].replace(/\s+/g, " ").trim();
    results.push({
      type: "course",
      id: code,
      code,
      title: title || code,
      url: `${BASE_URL}/course.html?course_code=${code}`,
    });
  }

  return results;
}
