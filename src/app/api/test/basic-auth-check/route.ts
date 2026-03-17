import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return NextResponse.json(
      { 
        status: "error", 
        message: "Unauthorized: Missing or invalid 'Authorization' header. Expected 'Basic <credentials>'." 
      },
      { status: 401 }
    );
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');

    // 1. Check for Fixed/System-level credentials
    if (username === 'admin' && password === 'password123') {
      return NextResponse.json({
        status: "success",
        mode: "fixed_system_auth",
        message: "Successfully authenticated using System-level (Fixed) credentials.",
        user_context: "Administrator"
      });
    }

    // 2. Check for Per-user/Dynamic credentials
    if (username === 'TEST_USER' && password === 'TEST_PASS') {
      return NextResponse.json({
        status: "success",
        mode: "dynamic_user_auth",
        message: "Successfully authenticated using Per-user (Dynamic) KYC credentials.",
        user_context: "End User (Test)"
      });
    }

    return NextResponse.json(
      { 
        status: "error", 
        message: `Unauthorized: Invalid credentials provided ("${username}:${password}"). Expected "admin:password123" or "TEST_USER:TEST_PASS".` 
      },
      { status: 401 }
    );

  } catch (error) {
    return NextResponse.json(
      { status: "error", message: "Failed to decode Basic Auth credentials. Ensure they are Base64 encoded." },
      { status: 401 }
    );
  }
}
