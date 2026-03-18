import { NextResponse } from 'next/server';

/**
 * PRODUCTION-READY SIMULATION: Multi-KYC Secure Action API
 * This API demonstrates:
 * 1. Extraction of identity from multi-part headers.
 * 2. Verification of static tokens and KYC segments.
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
      message: "Security Error: Missing Authorization header. The request was rejected." 
    }, { status: 401 });
  }

  // 2. Verify "Static Token" Format (Bearer <token>.<account>.<code>)
  const parts = authHeader.split('.');
  if (parts.length < 3) {
    return NextResponse.json({ 
      status: "error", 
      message: `Security Error: Malformed Secure Header. Expected: "Bearer <static_token>.<account>.<verify_code>". Received: "${authHeader}"` 
    }, { status: 400 });
  }

  // Extract segments from the header
  const accountNumber = parts[1].trim();
  const verificationCode = parts[2].trim();

  // 3. Verify Static Token Segment
  const token = parts[0].replace('Bearer ', '').trim();
  if (token !== 'talktree_static_token_778899' && token !== 'static_sample_123') {
    return NextResponse.json({ 
      status: "error", 
      message: "Security Error: Invalid or expired Static Security Token." 
    }, { status: 401 });
  }

  // 4. Database Lookup & Verification
  const account = MOCK_DB[accountNumber];

  if (!account) {
    return NextResponse.json({ 
      status: "error", 
      message: `Access Denied: Account identifier "${accountNumber}" not recognized in our secure registry.` 
    }, { status: 404 });
  }

  if (account.verification_code !== verificationCode) {
    return NextResponse.json({ 
      status: "error", 
      message: "Access Denied: Verification code mismatch. Security protocols prevent access." 
    }, { status: 403 });
  }

  // 5. Success: Return high-fidelity record based on extracted identity
  return NextResponse.json({
    status: "success",
    message: "Multi-KYC Authentication Successful!",
    data: {
      account_number: account.account_number,
      account_status: account.status,
      kyc_level: account.kyc_level,
      current_balance: account.balance,
      last_verification: new Date().toISOString(),
      authorized_actions: account.authorized_actions
    },
    meta: {
      auth_method: "Static Token Header Verification",
      timestamp: new Date().getTime()
    }
  });
}
