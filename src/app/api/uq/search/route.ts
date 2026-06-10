import { NextRequest, NextResponse } from "next/server";
import { searchUQ } from "@/lib/uq/scraper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  const type = request.nextUrl.searchParams.get("type") as
    | "all"
    | "program"
    | "course"
    | null;

  if (!q?.trim()) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  try {
    const results = await searchUQ(q.trim(), type ?? "all");
    return NextResponse.json({ results });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("UQ search error:", detail);
    return NextResponse.json(
      { error: "Failed to search UQ catalogue", detail },
      { status: 500 },
    );
  }
}
