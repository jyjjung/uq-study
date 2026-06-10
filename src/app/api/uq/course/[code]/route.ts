import { NextRequest, NextResponse } from "next/server";
import { fetchCourse } from "@/lib/uq/scraper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  if (!code?.trim()) {
    return NextResponse.json({ error: "Course code required" }, { status: 400 });
  }

  try {
    const course = await fetchCourse(code);
    return NextResponse.json({ course });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("UQ course fetch error:", detail);
    return NextResponse.json(
      { error: "Failed to fetch course information", detail },
      { status: 500 },
    );
  }
}
