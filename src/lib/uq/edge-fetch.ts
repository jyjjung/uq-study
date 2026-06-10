const FETCH_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-AU,en;q=0.9",
  "Cache-Control": "no-cache",
};

export async function fetchUqHtmlEdge(url: string): Promise<string> {
  const origin = new URL(url).origin;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...FETCH_HEADERS,
      Referer: `${origin}/`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`UQ fetch failed: ${res.status} ${url}`);
  }

  return res.text();
}
