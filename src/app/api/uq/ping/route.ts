import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  const url =
    "https://programs-courses.uq.edu.au/search.html?searchType=course&keywords=biol";

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html",
        Referer: "https://programs-courses.uq.edu.au/",
      },
      cache: "no-store",
    });

    return NextResponse.json({
      runtime: "edge",
      status: res.status,
      ok: res.ok,
    });
  } catch (error) {
    return NextResponse.json(
      {
        runtime: "edge",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
