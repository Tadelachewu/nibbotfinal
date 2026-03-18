import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');

  // 1. Validate Bearer Token
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

  // 2. Simulated Database (Multiple Profiles)
  const profiles = [
    {
      id: "user_123",
      full_name: "John Doe",
      email: "john@example.com",
      kyc_status: "Verified",
      balance: 1200,
      join_date: "2023-10-15"
    },
    {
      id: "user_456",
      full_name: "Jane Smith",
      email: "jane@example.com",
      kyc_status: "Pending",
      balance: 450,
      join_date: "2024-01-10"
    },
    {
      id: "admin_99",
      full_name: "System Admin",
      email: "admin@talktree.ai",
      kyc_status: "Internal",
      balance: 9999,
      join_date: "2023-01-01"
    },
    {
      id: "user_777",
      full_name: "Abel Tesfaye",
      email: "abel@example.com",
      kyc_status: "Verified",
      balance: 3000,
      join_date: "2022-06-20"
    }
  ];

  // 3. Read Query Params
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') || profiles.length);
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  // 4. Filtering Logic
  let filtered = [...profiles];

  if (status) {
    filtered = filtered.filter(p => p.kyc_status.toLowerCase() === status.toLowerCase());
  }

  if (search) {
    filtered = filtered.filter(p =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
    );
  }

  // 5. Apply Limit
  const result = filtered.slice(0, limit);

  // 6. Response
  return NextResponse.json({
    status: "success",
    count: result.length,
    message: "Profiles fetched successfully",
    data: result
  });
}