import * as cheerio from "cheerio";
import type {
  UQAssessment,
  UQCourseProfile,
  UQLearningActivity,
  UQLearningOutcome,
} from "./types";

import { fetchUqHtml } from "./http";

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

async function fetchProfileHtml(profileId: string): Promise<string> {
  const url = `${PROFILE_BASE}/course-profiles/${profileId}`;
  return fetchUqHtml(url);
}

function parseLearningOutcomes(
  $: ReturnType<typeof cheerio.load>,
): UQLearningOutcome[] {
  const outcomes: UQLearningOutcome[] = [];
  const seen = new Set<string>();

  function addOutcome(id: string, text: string) {
    const normalizedId = id.toUpperCase().replace(/\.$/, "");
    if (!/^LO\d+$/i.test(normalizedId) || !text || seen.has(normalizedId)) return;
    seen.add(normalizedId);
    outcomes.push({ id: normalizedId, text: cleanText(text) });
  }

  // UQ profiles list LOs as alternating <p> blocks: "LO1." then description
  $(".learning-outcome-wrapper, #learning-outcomes").each((_, section) => {
    const paragraphs = $(section)
      .find("p")
      .map((_, p) => cleanText($(p).text()))
      .get()
      .filter(Boolean);

    for (let i = 0; i < paragraphs.length; i++) {
      const loMatch = paragraphs[i].match(/^(LO\d+)\.?$/i);
      if (loMatch && paragraphs[i + 1] && !paragraphs[i + 1].match(/^LO\d+\.?$/i)) {
        addOutcome(loMatch[1], paragraphs[i + 1]);
        i++;
      }
    }
  });

  if (outcomes.length === 0) {
    $("#learning-outcomes strong.text--primary").each((_, el) => {
      const id = cleanText($(el).text());
      const nextP = $(el).closest("p").next("p");
      addOutcome(id, cleanText(nextP.text()));
    });
  }

  return outcomes.sort((a, b) => a.id.localeCompare(b.id));
}

function parseAssessmentDetails(
  $: ReturnType<typeof cheerio.load>,
  profileUrl: string,
): UQAssessment[] {
  const summaryRows: Array<{
    category: string;
    name: string;
    weightLabel: string;
    dueDate: string;
    detailId: string;
  }> = [];

  $(".assessment-summary-table tr").each((i, row) => {
    if (i === 0) return;
    const cells = $(row).find("td");
    if (cells.length < 3) return;

    const link = cells.eq(1).find("a[href*='assessment-detail']");
    const detailId =
      link.attr("href")?.replace("#", "") ??
      `assessment-detail-${summaryRows.length}`;

    summaryRows.push({
      category: cleanText(cells.eq(0).text()),
      name: cleanText(link.text() || cells.eq(1).text()),
      weightLabel: cleanText(cells.eq(2).text()),
      dueDate: cells.length > 3 ? cleanText(cells.eq(3).text()) : "",
      detailId,
    });
  });

  return summaryRows.map((row, i) => {
    const detailParts: string[] = [];
    let mode: string | undefined;
    let category = row.category;
    let learningOutcomes: string[] | undefined;

    const h3 = $(`h3#${row.detailId}`);
    if (h3.length) {
      let el = h3.next();
      while (el.length && !el.is("h3")) {
        if (el.is("p")) {
          const text = cleanText(el.text());
          if (text) detailParts.push(text);
        }
        if (el.is("dl")) {
          el.find("dt").each((_, dt) => {
            const key = cleanText($(dt).text());
            const val = cleanText($(dt).next("dd").text());
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
          });
        }
        el = el.next();
      }
    }

    const name = row.name || `Assessment ${i + 1}`;
    return {
      id: row.detailId,
      name,
      description: detailParts.join("\n\n") || `${name} — see course profile for details.`,
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

function parseLearningActivities(
  $: ReturnType<typeof cheerio.load>,
): UQLearningActivity[] {
  const activities: UQLearningActivity[] = [];

  $("#learning-activities--section table tr, #learning-activities table tr").each(
    (i, row) => {
      if (i === 0) return;
      const cells = $(row).find("td");
      if (cells.length < 3) return;
      activities.push({
        period: cleanText(cells.eq(0).text()),
        activityType: cleanText(cells.eq(1).text()),
        topic: cleanText(cells.eq(2).text()),
      });
    },
  );

  return activities;
}

export function parseCourseProfileHtml(
  html: string,
  profileId: string,
): UQCourseProfile {
  const $ = cheerio.load(html);
  const url = `${PROFILE_BASE}/course-profiles/${profileId}`;

  const aimsSection = $("#aim-and-outcomes--section, #aim-and-outcomes");
  const aimsParagraphs: string[] = [];
  aimsSection.find("p").each((_, p) => {
    const el = $(p);
    if (el.closest(".learning-outcome-wrapper, #learning-outcomes").length) {
      return;
    }
    const text = cleanText(el.text());
    if (!text || text.startsWith("After successfully completing")) return;
    if (/^LO\d+\.?$/i.test(text)) return;
    if (/^LO\d+\.\s+/i.test(text)) return;
    aimsParagraphs.push(text);
  });

  const resources = cleanText(
    $("#learning-resources--section, #learning-resources").text(),
  ).slice(0, 2000);

  return {
    profileId,
    url,
    studyPeriod: cleanText(
      $("#course-overview--section, #course-overview")
        .find("dt:contains('Study period'), dt")
        .first()
        .next("dd")
        .text() ||
        $("h1").parent().find("p").first().text(),
    ),
    location: cleanText(
      $('dt:contains("Location")').first().next("dd").text(),
    ),
    attendanceMode: cleanText(
      $('dt:contains("Attendance mode")').first().next("dd").text(),
    ),
    aims: aimsParagraphs.join("\n"),
    learningOutcomes: parseLearningOutcomes($),
    assessments: parseAssessmentDetails($, url),
    learningActivities: parseLearningActivities($),
    learningResources: resources,
  };
}

export async function fetchCourseProfile(
  profileId: string,
): Promise<UQCourseProfile> {
  const html = await fetchProfileHtml(profileId);
  return parseCourseProfileHtml(html, profileId);
}

export function extractProfileId(url: string): string | null {
  const match = url.match(/course-profiles\/([A-Z0-9]+-\d+-\d+)/i);
  return match ? match[1] : null;
}

export function isCurrentProfileUrl(url: string): boolean {
  return (
    url.includes("course-profiles.uq.edu.au/course-profiles/") &&
    !url.includes("archive.")
  );
}
