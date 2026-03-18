import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiKey = request.headers.get('X-API-KEY');
  const baseCurrency = searchParams.get('base');
  
  // 1. Validate Query Parameter
  if (!baseCurrency) {
    return NextResponse.json(
      { 
        status: "error", 
        message: "Bad Request: Missing required query parameter 'base'. Please configure your 'Request Mapping' in Admin to send 'base=USD'." 
      },
      { status: 400 }
    );
  }

  // 2. PUBLIC PREVIEW MODE (Auth Check)
  if (!apiKey) {
    return NextResponse.json({
      status: "success",
      mode: "public_preview",
      message: `Showing ${baseCurrency} rates. Provide 'X-API-KEY: secret-123' for full list.`,
      base: baseCurrency,
      rates: [
        { currency: "ETB", rate: "57.50", updated: "2024-05-20" }
      ]
    });
  }

  // 3. SECURE MODE: Validate the key
  if (apiKey !== 'secret-123') {
    return NextResponse.json(
      { 
        status: "error", 
        message: `Unauthorized: Invalid API Key "${apiKey}". The correct key is "secret-123".` 
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    status: "success",
    base: baseCurrency,
    rates: [
      { currency: "ETB", rate: "57.50", updated: "2024-05-20" },
      { currency: "EUR", rate: "0.92", updated: "2024-05-20" },
      { currency: "GBP", rate: "0.78", updated: "2024-05-20" },
      { currency: "KES", rate: "132.00", updated: "2024-05-20" },
      { currency: "INR", rate: "83.45", updated: "2024-05-20" }
    ]
  });
}
