export function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function textById(html: string, elementId: string): string {
  const re = new RegExp(
    `id=["']${elementId}["'][^>]*>([\\s\\S]*?)</[^>]+>`,
    "i",
  );
  const match = html.match(re);
  return match?.[1] ? stripHtml(match[1]) : "";
}
