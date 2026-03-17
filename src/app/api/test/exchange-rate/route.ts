import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // STRICT VALIDATION: This endpoint specifically tests API Key authentication
  const apiKey = request.headers.get('X-API-KEY');
  
  if (!apiKey) {
    return NextResponse.json(
      { 
        status: "error", 
        message: "Unauthorized: Missing 'X-API-KEY' header. This endpoint requires an API Key." 
      },
      { status: 401 }
    );
  }

  if (apiKey !== 'secret-123') {
    return NextResponse.json(
      { 
        status: "error", 
        message: `Unauthorized: Invalid API Key. You sent "${apiKey}", but the server expects "secret-123".` 
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
