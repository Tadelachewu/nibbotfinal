import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Enforce API Key validation for testing
  const apiKey = request.headers.get('X-API-KEY');
  const authHeader = request.headers.get('Authorization');

  // Accept either X-API-KEY: secret-123 OR standard Authorization header
  if (apiKey !== 'secret-123' && authHeader !== 'Bearer TEST_VALUE' && authHeader !== 'Bearer jwt_sample_token_456') {
    return NextResponse.json(
      { 
        status: "error", 
        message: "Unauthorized: Invalid API Key. Set header 'X-API-KEY' to 'secret-123' in your admin config." 
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    status: "success",
    base: "USD",
    rates: [
      { currency: "ETB", rate: "57.50", updated: "2024-05-20" },
      { currency: "EUR", rate: "0.92", updated: "2024-05-20" },
      { currency: "GBP", rate: "0.78", updated: "2024-05-20" },
      { currency: "KES", rate: "132.00", updated: "2024-05-20" },
      { currency: "INR", rate: "83.45", updated: "2024-05-20" }
    ]
  });
}
