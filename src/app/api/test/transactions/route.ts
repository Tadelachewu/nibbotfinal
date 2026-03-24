import { NextResponse } from 'next/server';

// Hardcoded token (replace with env variable in production)
const STATIC_BEARER_TOKEN = 'my-secret-token-123';

// Simulated account-based transactions
const accountTransactions: Record<string, any[]> = {
  'ACC-1001': [
    { id: "TX-9001", date: "2024-05-18", type: "Credit", amount: "2,500.00 ETB", status: "Completed" },
    { id: "TX-9002", date: "2024-05-19", type: "Debit", amount: "150.00 ETB", status: "Completed" }
  ],
  'ACC-1002': [
    { id: "TX-9003", date: "2024-05-20", type: "Credit", amount: "12,000.00 ETB", status: "Pending" },
    { id: "TX-9004", date: "2024-05-21", type: "Debit", amount: "45.00 ETB", status: "Completed" }
  ],
  'ACC-1003': [
    { id: "TX-9005", date: "2024-05-22", type: "Credit", amount: "300.00 ETB", status: "Failed" },
    { id: "TX-9006", date: "2024-05-23", type: "Debit", amount: "1,200.00 ETB", status: "Completed" }
  ]
};

// Utility function for JSON error responses
function jsonError(message: string, status: number) {
  return NextResponse.json({ status: "error", message }, { status });
}

// Main API handler
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('Authorization');

  // 1. Strict Bearer Token Check
  if (!authHeader || authHeader !== `Bearer ${STATIC_BEARER_TOKEN}`) {
    return jsonError("Unauthorized: Invalid or missing token.", 401);
  }

  // 2. Validate query params
  const accountId = searchParams.get('account_id');
  if (!accountId) {
    return jsonError("Missing required query parameter: 'account_id'.", 400);
  }

  let limit = parseInt(searchParams.get('limit') || '5');
  if (isNaN(limit) || limit < 1) limit = 5;

  // 3. Fetch transactions for the specific account
  const transactions = accountTransactions[accountId];
  if (!transactions) {
    return jsonError(`No transactions found for account '${accountId}'.`, 404);
  }

  // Slice to requested limit
  const results = transactions.slice(0, limit);

  return NextResponse.json({
    status: "success",
    meta: {
      account_id: accountId,
      requested_limit: limit,
      records_returned: results.length
    },
    transactions: results
  });
}