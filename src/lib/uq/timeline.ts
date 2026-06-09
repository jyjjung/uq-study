import type { UQAssessment, UQCourse, UQLearningActivity } from "./types";

export type TimelineEventType =
  | "assessment"
  | "lecture"
  | "tutorial"
  | "practical"
  | "workshop"
  | "other";

export interface TimelineEvent {
  id: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  type: TimelineEventType;
  scheduleLabel: string;
  studyPeriod?: string;
  exactDate?: string;
  endDate?: string;
  rangeLabel?: string;
  sortKey: string;
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseDayMonthYear(
  day: number,
  monthStr: string,
  year: number,
): string | undefined {
  const month = MONTHS[monthStr.toLowerCase().slice(0, 3)];
  if (month === undefined) return undefined;
  return toIsoDate(year, month, day);
}

/** Parse UQ schedule strings into exact dates and/or range labels. */
export function parseScheduleLabel(label: string): {
  exactDate?: string;
  endDate?: string;
  rangeLabel?: string;
  sortKey: string;
} {
  const text = label.replace(/\s+/g, " ").trim();
  if (!text) {
    return { sortKey: "9999-99-99", rangeLabel: "TBC" };
  }

  const weekRangeMatch = text.match(/\bweeks?\s+(\d+)\s*(?:[-–—to]+\s*)(\d+)\b/i);
  if (weekRangeMatch && !/\d{1,2}\s+[A-Za-z]{3}/.test(text)) {
    const startWeek = parseInt(weekRangeMatch[1], 10);
    const endWeek = parseInt(weekRangeMatch[2], 10);
    return {
      rangeLabel: text,
      sortKey: `2020-W${pad(startWeek)}`,
      endDate: `week:${endWeek}`,
    };
  }

  const weekMatch = text.match(/\bweek\s+(\d+)\b/i);
  if (weekMatch && !/\d{1,2}\s+[A-Za-z]{3}/.test(text)) {
    const week = parseInt(weekMatch[1], 10);
    return {
      rangeLabel: `Week ${week}`,
      sortKey: `2020-W${pad(week)}`,
      endDate: `week:${week}`,
    };
  }

  const fullRangeMatch = text.match(
    /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\s*[-–]\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/,
  );
  if (fullRangeMatch) {
    const start = parseDayMonthYear(
      parseInt(fullRangeMatch[1], 10),
      fullRangeMatch[2],
      parseInt(fullRangeMatch[3], 10),
    );
    const end = parseDayMonthYear(
      parseInt(fullRangeMatch[4], 10),
      fullRangeMatch[5],
      parseInt(fullRangeMatch[6], 10),
    );
    return {
      exactDate: start,
      endDate: end ?? start,
      rangeLabel: text,
      sortKey: start ?? `range-${text}`,
    };
  }

  const shortRangeMatch = text.match(
    /(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/,
  );
  if (shortRangeMatch) {
    const start = parseDayMonthYear(
      parseInt(shortRangeMatch[1], 10),
      shortRangeMatch[3],
      parseInt(shortRangeMatch[4], 10),
    );
    const end = parseDayMonthYear(
      parseInt(shortRangeMatch[2], 10),
      shortRangeMatch[3],
      parseInt(shortRangeMatch[4], 10),
    );
    return {
      exactDate: start,
      endDate: end ?? start,
      rangeLabel: text,
      sortKey: start ?? `range-${text}`,
    };
  }

  const toRangeMatch = text.match(
    /(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?\s+to\s+(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/i,
  );
  if (toRangeMatch) {
    const year = parseInt(toRangeMatch[6], 10);
    const start = parseDayMonthYear(
      parseInt(toRangeMatch[1], 10),
      toRangeMatch[2],
      parseInt(toRangeMatch[3] ?? String(year), 10),
    );
    const end = parseDayMonthYear(
      parseInt(toRangeMatch[4], 10),
      toRangeMatch[5],
      year,
    );
    return {
      exactDate: start,
      endDate: end ?? start,
      rangeLabel: text,
      sortKey: start ?? `range-${text}`,
    };
  }

  const sharedMonthRangeMatch = text.match(
    /(\d{1,2})\s+([A-Za-z]{3,9})\s*[-–—]\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/,
  );
  if (sharedMonthRangeMatch) {
    const start = parseDayMonthYear(
      parseInt(sharedMonthRangeMatch[1], 10),
      sharedMonthRangeMatch[2],
      parseInt(sharedMonthRangeMatch[5], 10),
    );
    const end = parseDayMonthYear(
      parseInt(sharedMonthRangeMatch[3], 10),
      sharedMonthRangeMatch[4],
      parseInt(sharedMonthRangeMatch[5], 10),
    );
    return {
      exactDate: start,
      endDate: end ?? start,
      rangeLabel: text,
      sortKey: start ?? `range-${text}`,
    };
  }

  const singleDateMatch = text.match(
    /(?:[A-Za-z]{3},?\s+)?(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/,
  );
  if (singleDateMatch) {
    const iso = parseDayMonthYear(
      parseInt(singleDateMatch[1], 10),
      singleDateMatch[2],
      parseInt(singleDateMatch[3], 10),
    );
    if (iso) {
      return { exactDate: iso, endDate: iso, sortKey: iso };
    }
  }

  if (/semester|throughout|ongoing|tbc|to be confirmed/i.test(text)) {
    return { rangeLabel: text, sortKey: `9999-${text}` };
  }

  return { rangeLabel: text, sortKey: `9998-${text}` };
}

function activityType(type: string): TimelineEventType {
  const t = type.toLowerCase();
  if (t.includes("lecture")) return "lecture";
  if (t.includes("tutorial")) return "tutorial";
  if (t.includes("practical") || t.includes("lab")) return "practical";
  if (t.includes("workshop")) return "workshop";
  return "other";
}

const studyPeriodFor = (course: UQCourse) => course.profile?.studyPeriod;

function buildAssessmentEvent(
  course: UQCourse,
  assessment: UQAssessment,
): TimelineEvent | null {
  if (!assessment.dueDate) return null;
  const parsed = parseScheduleLabel(assessment.dueDate);
  return {
    id: `${course.code}:assessment:${assessment.id}`,
    courseCode: course.code,
    courseTitle: course.title,
    title: assessment.name,
    type: "assessment",
    scheduleLabel: assessment.dueDate,
    studyPeriod: studyPeriodFor(course),
    exactDate: parsed.exactDate,
    endDate: parsed.endDate,
    rangeLabel: parsed.rangeLabel,
    sortKey: parsed.sortKey,
  };
}

function buildActivityEvent(
  course: UQCourse,
  activity: UQLearningActivity,
  index: number,
): TimelineEvent {
  const topic = activity.topic.replace(/Online Module:\s*/i, "").trim();
  const title = topic || activity.activityType;
  const parsed = parseScheduleLabel(activity.period);
  return {
    id: `${course.code}:activity:${index}`,
    courseCode: course.code,
    courseTitle: course.title,
    title,
    type: activityType(activity.activityType),
    scheduleLabel: activity.period,
    studyPeriod: studyPeriodFor(course),
    exactDate: parsed.exactDate,
    endDate: parsed.endDate,
    rangeLabel: parsed.rangeLabel ?? activity.period,
    sortKey: parsed.sortKey,
  };
}

export function buildTimelineEvents(course: UQCourse): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const assessment of course.assessments) {
    const event = buildAssessmentEvent(course, assessment);
    if (event) events.push(event);
  }

  for (const [index, activity] of (course.profile?.learningActivities ?? []).entries()) {
    if (!activity.period && !activity.topic) continue;
    events.push(buildActivityEvent(course, activity, index));
  }

  return events;
}

export function mergeUserDate(
  event: TimelineEvent,
  userDate?: string,
): TimelineEvent {
  if (!userDate) return event;
  return {
    ...event,
    exactDate: userDate,
    endDate: userDate,
    sortKey: userDate,
  };
}

function todayLocalIso(): string {
  const now = new Date();
  return toIsoDate(now.getFullYear(), now.getMonth(), now.getDate());
}

function isIsoDate(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

function parseStudyYear(studyPeriod?: string): number | undefined {
  if (!studyPeriod) return undefined;
  const match = studyPeriod.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1], 10) : undefined;
}

function parseSemester(studyPeriod?: string): 1 | 2 {
  return /semester\s*2|sem\s*2|s2\b/i.test(studyPeriod ?? "") ? 2 : 1;
}

/** Approximate last day of a UQ teaching week (Mon–Sun block). */
function estimateWeekEndIso(
  year: number,
  week: number,
  semester: 1 | 2,
): string {
  const start = new Date(
    year,
    semester === 1 ? 1 : 6,
    semester === 1 ? 24 : 14,
  );
  start.setDate(start.getDate() + week * 7 - 1);
  return toIsoDate(start.getFullYear(), start.getMonth(), start.getDate());
}

function resolveWeekEndDate(
  endDate: string | undefined,
  studyPeriod?: string,
): string | undefined {
  if (!endDate?.startsWith("week:")) return undefined;
  const week = parseInt(endDate.slice(5), 10);
  const year = parseStudyYear(studyPeriod);
  if (!year || !week) return undefined;
  return estimateWeekEndIso(year, week, parseSemester(studyPeriod));
}

function extractAllIsoDates(text: string): string[] {
  const dates: string[] = [];
  const monthYearPattern =
    /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/gi;
  for (const match of text.matchAll(monthYearPattern)) {
    const iso = parseDayMonthYear(
      parseInt(match[1], 10),
      match[2],
      parseInt(match[3], 10),
    );
    if (iso) dates.push(iso);
  }

  const slashPattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  for (const match of text.matchAll(slashPattern)) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      dates.push(toIsoDate(year, month, day));
    }
  }

  return dates;
}

/** Latest calendar day this event occurs on, from profile text and fields. */
export function getEventEndDate(event: TimelineEvent): string | undefined {
  const parsed = parseScheduleLabel(event.scheduleLabel);
  const candidates: string[] = [];

  for (const value of [
    event.endDate,
    parsed.endDate,
    event.exactDate,
    parsed.exactDate,
    isIsoDate(event.sortKey) ? event.sortKey : undefined,
  ]) {
    if (value && isIsoDate(value)) candidates.push(value);
    else if (value) {
      const weekIso = resolveWeekEndDate(value, event.studyPeriod);
      if (weekIso) candidates.push(weekIso);
    }
  }

  candidates.push(...extractAllIsoDates(event.scheduleLabel));

  const weekFromLabel = resolveWeekEndDate(parsed.endDate, event.studyPeriod);
  if (weekFromLabel) candidates.push(weekFromLabel);

  if (candidates.length === 0) return undefined;
  return candidates.sort().at(-1);
}

export function isPastEvent(event: TimelineEvent, today = todayLocalIso()): boolean {
  const lastDay = getEventEndDate(event);
  if (!lastDay) return false;
  return lastDay < today;
}

export function sortTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    const aDated = isIsoDate(a.sortKey);
    const bDated = isIsoDate(b.sortKey);
    if (aDated && bDated) return a.sortKey.localeCompare(b.sortKey);
    if (aDated) return -1;
    if (bDated) return 1;
    return a.sortKey.localeCompare(b.sortKey);
  });
}

export function filterUpcomingEvents(events: TimelineEvent[]): TimelineEvent[] {
  const today = todayLocalIso();
  return events.filter((e) => !isPastEvent(e, today));
}

export function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
