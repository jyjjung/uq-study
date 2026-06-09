import { NextRequest, NextResponse } from "next/server";
import { fetchCourseProfile } from "@/lib/uq/course-profile";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id?.trim()) {
    return NextResponse.json({ error: "Profile ID required" }, { status: 400 });
  }

  try {
    const profile = await fetchCourseProfile(id);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("UQ profile fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch course profile" },
      { status: 500 },
    );
  }
}
