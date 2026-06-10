const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const dns = require("node:dns");

setGlobalOptions({ region: "australia-southeast1" });
dns.setDefaultResultOrder("ipv4first");

const ALLOWED_HOSTS = new Set([
  "programs-courses.uq.edu.au",
  "course-profiles.uq.edu.au",
]);

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-AU,en;q=0.9",
  "Cache-Control": "no-cache",
};

exports.uqFetch = onRequest(
  { timeoutSeconds: 30, memory: "256MiB", cors: false },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).send("GET only");
      return;
    }

    const secret = process.env.UQ_PROXY_SECRET;
    if (secret && req.get("x-uq-proxy-secret") !== secret) {
      res.status(401).send("Unauthorized");
      return;
    }

    const target = req.query.url;
    if (!target || typeof target !== "string") {
      res.status(400).send("url query parameter required");
      return;
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      res.status(400).send("Invalid url");
      return;
    }

    if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
      res.status(403).send("Host not allowed");
      return;
    }

    try {
      const upstream = await fetch(parsed.toString(), {
        method: "GET",
        headers: {
          ...BROWSER_HEADERS,
          Referer: `${parsed.origin}/`,
        },
        signal: AbortSignal.timeout(25_000),
      });

      res.status(upstream.status);
      res.set("Content-Type", upstream.headers.get("content-type") ?? "text/html");
      res.send(await upstream.text());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("uqFetch proxy error:", message);
      res.status(502).send(message);
    }
  },
);
