import { NextRequest, NextResponse } from "next/server";
import { searchUQ } from "@/lib/uq/scraper";

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
    console.error("UQ search error:", error);
    return NextResponse.json(
      { error: "Failed to search UQ catalogue" },
      { status: 500 },
    );
  }
}
