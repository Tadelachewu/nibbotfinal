import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('Authorization');
  
  // STRICT VALIDATION: This endpoint tests Bearer or Basic Auth
  if (!authHeader) {
    return NextResponse.json(
      { 
        status: "error", 
        message: "Unauthorized: This endpoint (/api/test/balance) is SECURE and requires an Authorization header. Your request was sent without any credentials (Auth Type: None)."
      },
      { status: 401 }
    );
  }

  // Support specifically configured test values
  const isValidBearer = authHeader === 'Bearer jwt_sample_token_456' || authHeader === 'Bearer TEST_VALUE';
  const isValidBasic = authHeader === 'Basic YWRtaW46cGFzc3dvcmQxMjM=';

  if (!isValidBearer && !isValidBasic) {
    return NextResponse.json(
      { 
        status: "error", 
        message: `Unauthorized: Invalid credentials. Header received: "${authHeader}". ` +
                 "To fix this, use Bearer {{user_token}} or Basic Auth (admin:password123)."
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

  // Preview Mode helper
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
      message: `The account ID "${accountId}" was not recognized.` 
    },
    { status: 404 }
  );
}
