import { NextRequest, NextResponse } from "next/server";
import { fetchCourseProfileEdge } from "@/lib/uq/edge-course-profile";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id?.trim()) {
    return NextResponse.json({ error: "Profile ID required" }, { status: 400 });
  }

  try {
    const profile = await fetchCourseProfileEdge(id);
    return NextResponse.json({ profile });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("UQ profile fetch error:", detail);
    return NextResponse.json(
      { error: "Failed to fetch course profile", detail },
      { status: 500 },
    );
  }
}
