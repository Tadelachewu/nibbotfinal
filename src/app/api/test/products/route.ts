import { NextRequest, NextResponse } from "next/server";

// 🔐 Basic Auth
function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return NextResponse.json(
      { success: false, message: "Missing Basic Auth" },
      { status: 401 }
    );
  }

  // Decode Base64
  const base64 = authHeader.split(" ")[1];
  const decoded = Buffer.from(base64, "base64").toString("utf-8");

  const [username, password] = decoded.split(":");

  if (username !== "admin" || password !== "1234") {
    return NextResponse.json(
      { success: false, message: "Invalid credentials" },
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
  const category = searchParams.get("category");

  const products = [
    { id: 1, name: "Apple", category: "fruit" },
    { id: 2, name: "Carrot", category: "vegetable" },
  ];

  const filtered = category
    ? products.filter(p => p.category === category)
    : products;

  return NextResponse.json({
    success: true,
    data: filtered,
  });
}
