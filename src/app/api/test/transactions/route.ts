import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('Authorization');
  
  const accountId = searchParams.get('account_id');
  const limit = parseInt(searchParams.get('limit') || '5');

  // 1. Validate Static Bearer Token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized: Static Bearer Token Required." },
      { status: 401 }
    );
  }

  // 2. Validate Multi-Parameters
  if (!accountId) {
    return NextResponse.json(
      { status: "error", message: "Missing required query parameter: 'account_id'." },
      { status: 400 }
    );
  }

  // 3. Simulated Transaction List
  const allTransactions = [
    { id: "TX-9001", date: "2024-05-18", type: "Credit", amount: "2,500.00 ETB", status: "Completed" },
    { id: "TX-9002", date: "2024-05-19", type: "Debit", amount: "150.00 ETB", status: "Completed" },
    { id: "TX-9003", date: "2024-05-20", type: "Credit", amount: "12,000.00 ETB", status: "Pending" },
    { id: "TX-9004", date: "2024-05-21", type: "Debit", amount: "45.00 ETB", status: "Completed" },
    { id: "TX-9005", date: "2024-05-22", type: "Credit", amount: "300.00 ETB", status: "Failed" },
    { id: "TX-9006", date: "2024-05-23", type: "Debit", amount: "1,200.00 ETB", status: "Completed" }
  ];

  const results = allTransactions.slice(0, limit);

  return NextResponse.json({
    status: "success",
    meta: {
      account_id: accountId,
      records_returned: results.length,
      requested_limit: limit
    },
    transactions: results
  });
}
