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

  // Bearer Token Validation (Static)
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1] || "";
    const isValidToken = token.includes('talktree_static_token') || token.startsWith('static_sample');

    if (!isValidToken) {
      return NextResponse.json(
        { 
          status: "error", 
          message: `Unauthorized: Static Bearer token validation failed.` 
        },
        { status: 401 }
      );
    }
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
    message: "Authenticated successfully.",
    data: mockAccounts['88991122']
  });
}
