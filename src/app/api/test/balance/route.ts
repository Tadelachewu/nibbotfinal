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

  // PUBLIC PREVIEW MODE
  if (!accountId && !authHeader) {
    return NextResponse.json({
      status: "success",
      mode: "public_preview",
      message: "Public Preview: Showing sample structure. Auth is REQUIRED for specific account lookups.",
      data: mockAccounts['88991122']
    });
  }

  // SECURE MODE: Validate authentication
  if (!authHeader) {
    return NextResponse.json(
      { 
        status: "error", 
        message: `Unauthorized: This endpoint is SECURE. Your request was sent without an 'Authorization' header (Auth Type: None).` 
      },
      { status: 401 }
    );
  }

  // 1. Validate Basic Auth
  if (authHeader.startsWith('Basic ')) {
    try {
      const credentials = atob(authHeader.split(' ')[1]);
      const isValidFixed = credentials === 'admin:password123';
      const isValidDynamic = credentials === 'TEST_USER:TEST_PASS';
      
      if (!isValidFixed && !isValidDynamic) {
        return NextResponse.json(
          { 
            status: "error", 
            message: `Unauthorized: Invalid Basic Auth credentials. (Decoded: "${credentials}"). Expected "admin:password123" (Fixed) or "TEST_USER:TEST_PASS" (Dynamic).` 
          },
          { status: 401 }
        );
      }
    } catch (e) {
      return NextResponse.json({ status: "error", message: "Invalid Base64 encoding for Basic Auth." }, { status: 401 });
    }
  }

  // 2. Validate Bearer Token
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    // Standard JWT starts with "eyJ" (Base64 for {"alg"...)
    // Mock token starts with "jwt_sample"
    const isStandardJWT = token.startsWith('eyJ');
    const isMockJWT = token.startsWith('jwt_sample');
    
    // Verification logic: Does the token contain our base session identifier?
    const hasValidSession = isStandardJWT || isMockJWT;
    
    // Check if the token also includes the account ID if it was part of a template
    const containsAccountId = accountId ? token.includes(accountId) : true;

    if (!hasValidSession || !containsAccountId) {
      return NextResponse.json(
        { 
          status: "error", 
          message: `Unauthorized: Bearer token validation failed. The provided token "${token.substring(0, 15)}..." does not match the session or account parameters. Token must start with valid session (JWT) and include account_id if provided.` 
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
