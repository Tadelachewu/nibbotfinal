import { NextRequest, NextResponse } from "next/server";

// 🔐 Strict Bearer Auth
function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { success: false, message: "Missing Bearer Token" },
      { status: 401 }
    );
  }

  const token = authHeader.split(" ")[1];
  if (!token || token !== "mysecrettoken123") {
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
  { params }: { params: Promise<{ userId: string }> }
) {
  const authError = authenticate(req);
  if (authError) return authError;

  const { userId } = await params;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  // Simulated account-based transactions
  const accountTransactions: Record<string, any[]> = {
    'user_123': [
      { id: 1, amount: 100, status: "success" },
      { id: 2, amount: 50, status: "pending" },
    ],
    'user_456': [
      { id: 3, amount: 200, status: "success" }
    ]
  };

  const userTx = accountTransactions[userId] || [];

  const filtered = status ? userTx.filter(t => t.status === status) : userTx;

  return NextResponse.json({
    success: true,
    data: {
      userId,
      transactions: filtered,
    },
  });
}