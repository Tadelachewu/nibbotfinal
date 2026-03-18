import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('Authorization');
  const statusParam = searchParams.get('status');

  // 1. Validate Query Parameter
  if (!statusParam) {
    return NextResponse.json(
      { 
        status: "error", 
        message: "Bad Request: Missing required query parameter 'status'. Please configure your 'Request Mapping' in Admin to send 'status=active'." 
      },
      { status: 400 }
    );
  }

  // 2. Validate Basic Auth
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

    if (username === 'admin' && password === 'password123') {
      return NextResponse.json({
        status: "success",
        message: `Authenticated successfully! Filters applied: status=${statusParam}`,
        data: {
          auth_mode: "Basic (Fixed)",
          param_received: statusParam,
          timestamp: new Date().toISOString()
        }
      });
    }

    return NextResponse.json(
      { 
        status: "error", 
        message: `Unauthorized: Invalid credentials provided. Expected "admin:password123".` 
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
