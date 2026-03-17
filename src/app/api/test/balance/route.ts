import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('Authorization');
  
  // Enforce Authorization for testing purposes
  // Supports: 
  // 1. Bearer jwt_sample_token_456 (used by Chat Interface)
  // 2. Bearer TEST_VALUE (used by Admin Live Preview)
  // 3. Basic YWRtaW46cGFzc3dvcmQxMjM= (admin:password123)
  const isValidAuth = 
    authHeader === 'Bearer jwt_sample_token_456' || 
    authHeader === 'Bearer TEST_VALUE' ||
    authHeader === 'Basic YWRtaW46cGFzc3dvcmQxMjM=';

  if (!authHeader || !isValidAuth) {
    return NextResponse.json(
      { 
        status: "error", 
        message: "Unauthorized: Invalid or missing Authorization header. " + 
                 "Use Bearer {{user_token}} or Basic Auth (admin:password123) in your config."
      },
      { status: 401 }
    );
  }

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
    },
    '12345678': {
      balance: "0.00",
      currency: "ETB",
      account_id: "12345678",
      account_type: "Student Account",
      last_updated: new Date().toISOString()
    }
  };

  const accountId = searchParams.get('account_id');

  // If no ID is provided, check if it's a preview request to help with mapping
  if (!accountId) {
    return NextResponse.json({
      status: "success",
      message: "Preview Mode: Showing data structure for mapping.",
      data: mockAccounts['88991122']
    });
  }

  if (mockAccounts[accountId]) {
    return NextResponse.json({
      status: "success",
      data: mockAccounts[accountId]
    });
  }

  return NextResponse.json(
    { 
      status: "error", 
      message: `The account ID "${accountId}" was not recognized. Please try with one of our test IDs: 88991122, 11223344, 99887766, or 12345678.` 
    },
    { status: 404 }
  );
}
