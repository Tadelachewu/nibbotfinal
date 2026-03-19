import { NextRequest, NextResponse } from "next/server";

// 🔐 API Key Auth
function authenticate(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");

  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: "Missing API Key" },
      { status: 401 }
    );
  }

  if (apiKey !== "mysecretapikey123") {
    return NextResponse.json(
      { success: false, message: "Invalid API Key" },
      { status: 403 }
    );
  }

  return null;
}

// 📡 GET API
export async function GET(req: NextRequest) {
  const authError = authenticate(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit");

  const orders = [
    { id: 1, total: 500 },
    { id: 2, total: 1000 },
    { id: 3, total: 1500 },
  ];

  const result = limit
    ? orders.slice(0, parseInt(limit))
    : orders;

  return NextResponse.json({
    success: true,
    data: result,
  });
}
