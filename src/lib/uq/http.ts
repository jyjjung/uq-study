import dns from "node:dns";

// Prefer IPv4 — some hosts fail when Vercel resolves IPv6 first.
dns.setDefaultResultOrder("ipv4first");

const BROWSER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-AU,en;q=0.9",
  "Cache-Control": "no-cache",
};

function proxyHeaders(): HeadersInit {
  const secret = process.env.UQ_PROXY_SECRET;
  return secret ? { "x-uq-proxy-secret": secret } : {};
}

function headersFor(url: string): HeadersInit {
  const origin = new URL(url).origin;
  return {
    ...BROWSER_HEADERS,
    Referer: `${origin}/`,
  };
}

async function fetchDirect(url: string): Promise<Response> {
  return fetch(url, {
    method: "GET",
    headers: headersFor(url),
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
}

async function fetchViaProxy(url: string, proxyBase: string): Promise<Response> {
  const proxyUrl = `${proxyBase}?url=${encodeURIComponent(url)}`;
  return fetch(proxyUrl, {
    method: "GET",
    headers: proxyHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(28_000),
  });
}

export async function fetchUqHtml(url: string): Promise<string> {
  const proxyBase = process.env.UQ_PROXY_URL?.replace(/\/$/, "");

  let res: Response;
  if (proxyBase) {
    res = await fetchViaProxy(url, proxyBase);
  } else {
    res = await fetchDirect(url);
    // UQ blocks many cloud datacenter IPs with 405 — retry via proxy if configured
    if (res.status === 405 && process.env.UQ_PROXY_URL_FALLBACK) {
      res = await fetchViaProxy(url, process.env.UQ_PROXY_URL_FALLBACK);
    }
  }

  if (!res.ok) {
    throw new Error(`UQ fetch failed: ${res.status} ${url}`);
  }

  return res.text();
}
