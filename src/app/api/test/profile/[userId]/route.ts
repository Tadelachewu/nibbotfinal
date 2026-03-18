import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const authHeader = request.headers.get('Authorization');
  const userId = params.userId;

  // 1. Validate Static Bearer Token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized: Missing Bearer Token." },
      { status: 401 }
    );
  }

  const token = authHeader.split(' ')[1];
  if (token !== 'talktree_static_token_778899' && token !== 'static_sample_123') {
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
      email: "admin@talktree.ai",
      kyc_status: "Internal",
      join_date: "2023-01-01"
    }
  };

  const profile = profiles[userId];

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
