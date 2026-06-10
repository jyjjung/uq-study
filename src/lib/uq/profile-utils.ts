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
