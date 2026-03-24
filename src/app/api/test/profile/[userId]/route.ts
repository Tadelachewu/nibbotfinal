import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const authHeader = request.headers.get('Authorization');

  // 1. Validate Static Bearer Token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized: Missing Bearer Token." },
      { status: 401 }
    );
  }

  const token = authHeader.split(' ')[1];
  if (token !== 'nib_static_token_778899' && token !== 'static_sample_123') {
    return NextResponse.json(
      { status: "error", message: "Unauthorized: Invalid Static Token." },
      { status: 401 }
    );
  }

  // 2. Simulated Database
  const profiles: Record<string, any> = {
    'user_123': {
      full_name: "John Doe",
      email: "john@example.com",
      kyc_status: "Verified",
      join_date: "2023-10-15"
    },
    'admin_99': {
      full_name: "System Admin",
      email: "admin@nib.ai",
      kyc_status: "Internal",
      join_date: "2023-01-01"
    }
  };

  // If the dynamic frontend session ID (e.g., user_1kzmdi2hv) is used, return a default mock!
  const profile = profiles[userId] || {
    full_name: "Dynamic User",
    email: `${userId}@example.com`,
    kyc_status: "Auto-Verified",
    join_date: new Date().toISOString().split('T')[0]
  };

  if (!profile) {
    return NextResponse.json(
      { status: "error", message: `Profile for ID "${userId}" not found in path lookup.` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    status: "success",
    message: `Path Parameter Resolution Successful for ID: ${userId}`,
    data: profile
  });
}
