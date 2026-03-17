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

  // PUBLIC PREVIEW MODE: If no account_id is requested, return sample data
  if (!accountId) {
    return NextResponse.json({
      status: "success",
      mode: "public_preview",
      message: "Public Preview: Showing data structure. (Note: Accessing specific accounts requires an Authorization header).",
      data: mockAccounts['88991122']
    });
  }

  // SECURE MODE: Specific account requests MUST have valid auth
  if (!authHeader) {
    return NextResponse.json(
      { 
        status: "error", 
        message: `Unauthorized: Missing Authorization header for account "${accountId}". (Auth Type: None detected).`
      },
      { status: 401 }
    );
  }

  // Support various valid auth formats for testing
  const isValidFixedBasic = authHeader === `Basic ${btoa('admin:password123')}`;
  const isValidDynamicBasic = authHeader === `Basic ${btoa('TEST_USER:TEST_PASS')}`;
  const isValidSimpleBearer = authHeader === 'Bearer jwt_sample_token_456' || authHeader === 'Bearer TEST_TOKEN';
  
  // SUPPORTED BEARER TEMPLATE: Bearer token-accountId
  const isValidBearerTemplate = authHeader === `Bearer jwt_sample_token_456-${accountId}`;
  
  // ALSO SUPPORT CONCATENATED VERSION for user's specific request
  const isValidBearerConcatenated = authHeader === `Bearer jwt_sample_token_456${accountId}`;

  if (!isValidFixedBasic && !isValidDynamicBasic && !isValidSimpleBearer && !isValidBearerTemplate && !isValidBearerConcatenated) {
    return NextResponse.json(
      { 
        status: "error", 
        message: `Unauthorized: Invalid credentials provided. Received: "${authHeader}". Expected formats include: Basic Auth (admin:password123), Bearer token, or Bearer token-accountId.`
      },
      { status: 401 }
    );
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
