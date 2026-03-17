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

  // PUBLIC PREVIEW MODE: Returns structure if no private data requested
  if (!accountId && !authHeader) {
    return NextResponse.json({
      status: "success",
      mode: "public_preview",
      message: "Public Preview: Showing structure. Auth is REQUIRED for specific account lookups.",
      data: mockAccounts['88991122']
    });
  }

  // SECURE MODE: Validate authentication
  if (!authHeader) {
    return NextResponse.json(
      { 
        status: "error", 
        message: `Unauthorized: Missing Authorization header. Accessing account "${accountId}" requires credentials.` 
      },
      { status: 401 }
    );
  }

  // 1. Validate Basic Auth (Fixed or Dynamic)
  const isBasicAuth = authHeader.startsWith('Basic ');
  if (isBasicAuth) {
    const credentials = atob(authHeader.split(' ')[1]);
    const isValidFixed = credentials === 'admin:password123';
    const isValidDynamic = credentials === 'TEST_USER:TEST_PASS';
    
    if (!isValidFixed && !isValidDynamic) {
      return NextResponse.json(
        { 
          status: "error", 
          message: `Unauthorized: Invalid Basic Auth credentials. (Decoded as: "${credentials}"). Expected "admin:password123" or "TEST_USER:TEST_PASS".` 
        },
        { status: 401 }
      );
    }
  }

  // 2. Validate Bearer Token (JWT format & Signature simulation)
  const isBearerAuth = authHeader.startsWith('Bearer ');
  if (isBearerAuth) {
    const token = authHeader.split(' ')[1];
    const tokenParts = token.split('.');
    
    // Check for standard JWT format (3 parts)
    if (tokenParts.length !== 3) {
      // Allow the simple TEST_TOKEN for basic debug, but reject malformed ones
      if (token !== 'TEST_TOKEN' && !token.includes('jwt_sample_token_456')) {
        return NextResponse.json(
          { 
            status: "error", 
            message: `Unauthorized: Invalid Token Format. Expected a 3-part JWT (Header.Payload.Signature). Received: "${token.substring(0, 10)}..."` 
          },
          { status: 401 }
        );
      }
    }
    
    // Verify complex template match (e.g., jwt_sample_token_456-88991122)
    const expectedTokenWithAcc = `jwt_sample_token_456-${accountId}`;
    const expectedTokenConcat = `jwt_sample_token_456${accountId}`;
    const isExactMatch = token === 'jwt_sample_token_456' || token.includes('TEST_VAL') || token.includes(expectedTokenWithAcc) || token.includes(expectedTokenConcat);
    
    if (!isExactMatch) {
      return NextResponse.json(
        { 
          status: "error", 
          message: `Unauthorized: Bearer token validation failed. The provided token signature does not match the expected user profile or account parameters.` 
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

  if (!accountId) {
    return NextResponse.json({
      status: "success",
      message: "Authenticated successfully. Please provide an account_id parameter.",
      data: mockAccounts['88991122']
    });
  }

  return NextResponse.json(
    { status: "error", message: `Account ID "${accountId}" not found.` },
    { status: 404 }
  );
}
