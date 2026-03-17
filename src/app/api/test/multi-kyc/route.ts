import { NextResponse } from 'next/server';

/**
 * PRODUCTION-READY SIMULATION: Multi-KYC Secure Action API
 * This API demonstrates:
 * 1. Extraction of identity from multi-part headers.
 * 2. Verification of "signed" parameters (JWT + KYC segments).
 * 3. Retrieval from a mock data source.
 */

interface MockAccount {
  account_number: string;
  verification_code: string;
  status: 'Active' | 'Suspended' | 'Pending';
  kyc_level: 'Level 1' | 'Level 2' | 'Full';
  balance: string;
  authorized_actions: string[];
}

const MOCK_DB: Record<string, MockAccount> = {
  '12345': {
    account_number: '12345',
    verification_code: '9988',
    status: 'Active',
    kyc_level: 'Level 2',
    balance: '45,200.00 ETB',
    authorized_actions: ['balance_view', 'transfer_limited', 'profile_edit']
  },
  '67890': {
    account_number: '67890',
    verification_code: '1122',
    status: 'Suspended',
    kyc_level: 'Full',
    balance: '0.00 ETB',
    authorized_actions: ['support_only']
  },
  '11223': {
    account_number: '11223',
    verification_code: '3344',
    status: 'Pending',
    kyc_level: 'Level 1',
    balance: '1,500.00 ETB',
    authorized_actions: ['view_status']
  }
};

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const body = await request.json().catch(() => ({}));

  // 1. Validate Header Existence
  if (!authHeader) {
    return NextResponse.json({ 
      status: "error", 
      message: "Security Error: Missing Authorization header." 
    }, { status: 401 });
  }

  // 2. Verify "Signature" Format (Bearer <jwt>.<account>.<code>)
  const parts = authHeader.split('.');
  if (parts.length < 3) {
    return NextResponse.json({ 
      status: "error", 
      message: `Invalid Multi-KYC Signature. Expected format: "Bearer <token>.<account_number>.<verification_code>". Received: "${authHeader}"` 
    }, { status: 401 });
  }

  // Extract segments
  // parts[0] is "Bearer eyJ..."
  const accountNumber = parts[1];
  const verificationCode = parts[2];

  // 3. Verify JWT Segment (Simulated)
  const jwt = parts[0].replace('Bearer ', '');
  if (!jwt.startsWith('eyJ')) {
    return NextResponse.json({ 
      status: "error", 
      message: "Security Error: Invalid or expired JWT segment." 
    }, { status: 401 });
  }

  // 4. Data Source Lookup & Verification
  const account = MOCK_DB[accountNumber];

  if (!account) {
    return NextResponse.json({ 
      status: "error", 
      message: `Verification Failed: Account "${accountNumber}" not found in our secure records.` 
    }, { status: 404 });
  }

  if (account.verification_code !== verificationCode) {
    return NextResponse.json({ 
      status: "error", 
      message: "Security Error: Verification code mismatch for this account." 
    }, { status: 403 });
  }

  // 5. Success: Return specific data based on the extracted identity
  return NextResponse.json({
    status: "success",
    message: "Multi-KYC Verification Successful!",
    data: {
      account_number: account.account_number,
      account_status: account.status,
      kyc_level: account.kyc_level,
      current_balance: account.balance,
      last_verification: new Date().toISOString(),
      authorized_actions: account.authorized_actions
    }
  });
}
