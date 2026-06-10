import { NextRequest, NextResponse } from "next/server";
import { fetchProgramEdge } from "@/lib/uq/edge-program";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id?.trim()) {
    return NextResponse.json({ error: "Program ID required" }, { status: 400 });
  }

  try {
    const program = await fetchProgramEdge(id);
    return NextResponse.json({ program });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("UQ program fetch error:", detail);
    return NextResponse.json(
      { error: "Failed to fetch program information", detail },
      { status: 500 },
    );
  }
}
