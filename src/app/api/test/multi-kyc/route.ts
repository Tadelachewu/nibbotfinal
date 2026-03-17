import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const body = await request.json().catch(() => ({}));

  if (!authHeader) {
    return NextResponse.json({ status: "error", message: "Missing Authorization header." }, { status: 401 });
  }

  // Expecting format: Bearer <jwt_part>.<account_number>.<verification_code>
  // Note: user_token is a JWT, so the first part of the split is "Bearer eyJ..."
  const parts = authHeader.split('.');
  
  if (parts.length < 3) {
    return NextResponse.json({ 
      status: "error", 
      message: `Invalid multi-part Bearer format. Expected "Bearer <token>.<account_number>.<verification_code>". Received header: "${authHeader}"` 
    }, { status: 401 });
  }

  const account = parts[1];
  const code = parts[2];

  // In this test API, we validate against specific "test" values or the body
  const isValidAccount = account === '12345' || account === body.account_number;
  const isValidCode = code === '9988' || code === body.verification_code;

  if (!isValidAccount || !isValidCode) {
    return NextResponse.json({ 
      status: "error", 
      message: `Multi-KYC Validation Failed. The extracted credentials (Account: ${account}, Code: ${code}) do not match the expected test values (12345, 9988).` 
    }, { status: 401 });
  }

  return NextResponse.json({
    status: "success",
    message: "Multi-KYC Verification Successful!",
    data: {
      account_status: "Active",
      kyc_level: "Level 2 (High Trust)",
      last_verification: new Date().toISOString(),
      authorized_actions: ["balance_view", "transfer_limited", "profile_edit"]
    }
  });
}
