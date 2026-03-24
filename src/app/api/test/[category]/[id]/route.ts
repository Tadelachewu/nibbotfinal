import { NextRequest, NextResponse } from "next/server";

// GET API with path and query params
// Path: /api/test/[category]/[id]
export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ category: string, id: string }> }
) {
  try {
    const { category, id } = await params;

    // Query params
    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") || "none";
    const sort = url.searchParams.get("sort") || "asc";

    // Example response
    const data = {
      message: "GET request received successfully",
      category,
      id,
      filter,
      sort,
    };

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
