import { stripHtml } from "./edge-html";
import type {
  UQAssessment,
  UQCourseProfile,
  UQLearningActivity,
  UQLearningOutcome,
} from "./types";

const PROFILE_BASE = "https://course-profiles.uq.edu.au";

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parseWeight(weightLabel: string): number | undefined {
  const match = weightLabel.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]) : undefined;
}

function classifyAssessment(
  name: string,
  category?: string,
): UQAssessment["type"] {
  const combined = `${name} ${category ?? ""}`.toLowerCase();
  if (combined.includes("exam")) return "exam";
  if (combined.includes("quiz") || combined.includes("test")) return "quiz";
  if (combined.includes("presentation")) return "presentation";
  if (combined.includes("assignment") || combined.includes("essay"))
    return "assignment";
  if (
    combined.includes("demonstration") ||
    combined.includes("practical") ||
    combined.includes("workshop")
  )
    return "demonstration";
  if (combined.includes("project")) return "project";
  return "other";
}

function textAfterDt(html: string, label: string): string {
  const re = new RegExp(
    `<dt[^>]*>\\s*${label}\\s*</dt>\\s*<dd[^>]*>([\\s\\S]*?)</dd>`,
    "i",
  );
  const match = html.match(re);
  return match ? cleanText(stripHtml(match[1])) : "";
}

function extractSection(html: string, sectionId: string): string {
  const re = new RegExp(
    `id=["']${sectionId}["'][^>]*>([\\s\\S]*?)(?=<section\\s|</body>)`,
    "i",
  );
  const match = html.match(re);
  return match?.[1] ?? "";
}

function parseTableRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(tableHtml)) !== null) {
    const cells: string[] = [];
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(cleanText(stripHtml(cellMatch[1])));
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function parseLearningOutcomes(html: string): UQLearningOutcome[] {
  const section = extractSection(html, "learning-outcomes");
  const outcomes: UQLearningOutcome[] = [];
  const seen = new Set<string>();

  function addOutcome(id: string, text: string) {
    const normalizedId = id.toUpperCase().replace(/\.$/, "");
    if (!/^LO\d+$/i.test(normalizedId) || !text || seen.has(normalizedId))
      return;
    seen.add(normalizedId);
    outcomes.push({ id: normalizedId, text: cleanText(text) });
  }

  const paragraphRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const paragraphs: string[] = [];
  let pMatch: RegExpExecArray | null;
  while ((pMatch = paragraphRe.exec(section)) !== null) {
    const text = cleanText(stripHtml(pMatch[1]));
    if (text) paragraphs.push(text);
  }

  for (let i = 0; i < paragraphs.length; i++) {
    const inline = paragraphs[i].match(/^(LO\d+)\.?\s+(.+)$/i);
    if (inline) {
      addOutcome(inline[1], inline[2]);
      continue;
    }

    const loOnly = paragraphs[i].match(/^(LO\d+)\.?$/i);
    if (loOnly && paragraphs[i + 1] && !paragraphs[i + 1].match(/^LO\d+\.?/i)) {
      addOutcome(loOnly[1], paragraphs[i + 1]);
      i++;
    }
  }

  return outcomes.sort((a, b) => a.id.localeCompare(b.id));
}

function parseAssessmentDetails(
  html: string,
  profileUrl: string,
): UQAssessment[] {
  const tableMatch = html.match(
    /assessment-summary-table[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i,
  );
  if (!tableMatch) return [];

  const summaryRows: Array<{
    category: string;
    name: string;
    weightLabel: string;
    dueDate: string;
    detailId: string;
  }> = [];

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  let rowIndex = 0;
  while ((rowMatch = rowRe.exec(tableMatch[1])) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
      cells.push(cleanText(stripHtml(cellMatch[1])));
    }
    if (rowIndex === 0 && cells[0]?.toLowerCase().includes("category")) {
      rowIndex++;
      continue;
    }
    rowIndex++;
    if (cells.length < 3) continue;

    const linkMatch = rowHtml.match(
      /<a[^>]*href=["']#(assessment-detail-\d+)["'][^>]*>([\s\S]*?)<\/a>/i,
    );
    const detailId =
      linkMatch?.[1] ?? `assessment-detail-${summaryRows.length}`;
    const linkedName = linkMatch?.[2]
      ? cleanText(stripHtml(linkMatch[2]))
      : "";

    summaryRows.push({
      category: cells[0] ?? "",
      name: linkedName || (cells[1] ?? ""),
      weightLabel: cells[2] ?? "",
      dueDate: cells[3] ?? "",
      detailId,
    });
  }

  return summaryRows.map((row, i) => {
    const detailParts: string[] = [];
    let mode: string | undefined;
    let category = row.category;
    let learningOutcomes: string[] | undefined;

    const h3Re = new RegExp(
      `<h3[^>]*id=["']${row.detailId}["'][^>]*>([\\s\\S]*?)</h3>([\\s\\S]*?)(?=<h3[^>]*id=["']assessment-detail|<section\\s|$)`,
      "i",
    );
    const h3Match = html.match(h3Re);

    if (h3Match) {
      const body = h3Match[2];
      const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      let pMatch: RegExpExecArray | null;
      while ((pMatch = pRe.exec(body)) !== null) {
        const text = cleanText(stripHtml(pMatch[1]));
        if (text) detailParts.push(text);
      }

      const dlRe = /<dt[^>]*>([^<]*)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
      let dlMatch: RegExpExecArray | null;
      while ((dlMatch = dlRe.exec(body)) !== null) {
        const key = cleanText(dlMatch[1]);
        const val = cleanText(stripHtml(dlMatch[2]));
        if (key === "Mode") mode = val;
        if (key === "Category") category = val;
        if (key === "Learning outcomes") {
          learningOutcomes = val
            .split(/,\s*/)
            .map((lo) => lo.trim())
            .filter(Boolean);
        }
        if (val && key !== "Learning outcomes") {
          detailParts.push(`${key}: ${val}`);
        }
      }
    }

    const name = row.name || `Assessment ${i + 1}`;
    return {
      id: row.detailId,
      name,
      description:
        detailParts.join("\n\n") ||
        `${name} — see course profile for details.`,
      weight: parseWeight(row.weightLabel),
      weightLabel: row.weightLabel,
      dueDate: row.dueDate || undefined,
      category,
      mode,
      learningOutcomes,
      type: classifyAssessment(name, category),
      profileUrl: `${profileUrl}#${row.detailId}`,
    };
  });
}

function parseLearningActivities(html: string): UQLearningActivity[] {
  const section =
    extractSection(html, "learning-activities--section") ||
    extractSection(html, "learning-activities");
  const tableMatch = section.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [];

  const rows = parseTableRows(tableMatch[1]);
  const activities: UQLearningActivity[] = [];

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i];
    if (i === 0 && cells[0]?.toLowerCase().includes("learning period"))
      continue;
    if (cells.length < 3) continue;
    activities.push({
      period: cells[0],
      activityType: cells[1],
      topic: cells[2],
    });
  }

  return activities;
}

export function parseCourseProfileHtml(
  html: string,
  profileId: string,
): UQCourseProfile {
  const url = `${PROFILE_BASE}/course-profiles/${profileId}`;

  const aimsSection =
    extractSection(html, "aim-and-outcomes--section") ||
    extractSection(html, "aim-and-outcomes");
  const aimsParagraphs: string[] = [];
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRe.exec(aimsSection)) !== null) {
    const text = cleanText(stripHtml(pMatch[1]));
    if (!text || text.startsWith("After successfully completing")) continue;
    if (/^LO\d+\.?\s*/i.test(text)) continue;
    aimsParagraphs.push(text);
  }

  const resourcesSection =
    extractSection(html, "learning-resources--section") ||
    extractSection(html, "learning-resources");
  const learningResources = cleanText(stripHtml(resourcesSection)).slice(
    0,
    2000,
  );

  return {
    profileId,
    url,
    studyPeriod: textAfterDt(html, "Study period"),
    location: textAfterDt(html, "Location"),
    attendanceMode: textAfterDt(html, "Attendance mode"),
    aims: aimsParagraphs.join("\n"),
    learningOutcomes: parseLearningOutcomes(html),
    assessments: parseAssessmentDetails(html, url),
    learningActivities: parseLearningActivities(html),
    learningResources,
  };
}
