import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('Authorization');
  const accountId = searchParams.get('account_id');

  // Simulated database of accounts
  const mockAccounts: Record<string, any> = {
    '88991122': {
      balance: "12,500.00",
      currency: "ETB",
      account_id: "88991122",
      account_type: "Savings",
      last_updated: new Date().toISOString()
    },
    '11223344': {
      balance: "5,200.50",
      currency: "ETB",
      account_id: "11223344",
      account_type: "Current",
      last_updated: new Date().toISOString()
    },
    '99887766': {
      balance: "450,000.00",
      currency: "ETB",
      account_id: "99887766",
      account_type: "Premium Savings",
      last_updated: new Date().toISOString()
    }
  };

  // 1. PUBLIC PREVIEW MODE
  if (!accountId && !authHeader) {
    return NextResponse.json({
      status: "success",
      mode: "public_preview",
      message: "Public Preview: Showing sample structure. Auth is REQUIRED for specific account lookups.",
      data: mockAccounts['88991122']
    });
  }

  // 2. SECURE MODE
  if (!authHeader) {
    return NextResponse.json(
      { 
        status: "error", 
        message: `Unauthorized: This endpoint (/api/test/balance) is SECURE. Your request was sent without an 'Authorization' header.` 
      },
      { status: 401 }
    );
  }

  // Static Bearer Token Validation
  // We expect "Bearer talktree_static_token_778899" or "Bearer static_sample_123"
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1] || "";
    const isValidToken = token === 'talktree_static_token_778899' || token === 'static_sample_123' || token.startsWith('static_');

    if (!isValidToken) {
      return NextResponse.json(
        { 
          status: "error", 
          message: `Unauthorized: Invalid Static Bearer Token. Received: "${token}". Expected a static token from the registry.` 
        },
        { status: 401 }
      );
    }
  } else {
    return NextResponse.json(
      { 
        status: "error", 
        message: `Unauthorized: Malformed header. Expected "Authorization: Bearer <static_token>".` 
      },
      { status: 401 }
    );
  }

  // Handle data retrieval
  if (accountId && mockAccounts[accountId]) {
    return NextResponse.json({
      status: "success",
      data: mockAccounts[accountId]
    });
  }

  return NextResponse.json({
    status: "success",
    message: "Authenticated successfully. Returning default account summary.",
    data: mockAccounts['88991122']
  });
}
