import { NextRequest, NextResponse } from "next/server";

// 🔐 Bearer Auth
function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { success: false, message: "Missing Bearer Token" },
      { status: 401 }
    );
  }

  const token = authHeader.split(" ")[1];

  if (token !== "mysecrettoken123") {
    return NextResponse.json(
      { success: false, message: "Invalid token" },
      { status: 403 }
    );
  }

  return null;
}

// 📡 GET API
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const authError = authenticate(req);
  if (authError) return authError;

  const { userId } = params;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const transactions = [
    { id: 1, amount: 100, status: "success" },
    { id: 2, amount: 200, status: "pending" },
  ];

  const filtered = status
    ? transactions.filter(t => t.status === status)
    : transactions;

  return NextResponse.json({
    success: true,
    data: {
      userId,
      transactions: filtered,
    },
  });
}
