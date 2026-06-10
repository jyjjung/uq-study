import { fetchUqHtmlEdge } from "./edge-fetch";
import { parseCourseProfileHtml } from "./profile-parse";
import type { UQCourseProfile } from "./types";

const PROFILE_BASE = "https://course-profiles.uq.edu.au";

export async function fetchCourseProfileEdge(
  profileId: string,
): Promise<UQCourseProfile> {
  const html = await fetchUqHtmlEdge(
    `${PROFILE_BASE}/course-profiles/${profileId}`,
  );
  return parseCourseProfileHtml(html, profileId);
}
