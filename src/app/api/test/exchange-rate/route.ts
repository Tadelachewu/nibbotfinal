
import { NextResponse } from 'next/server';

export async function GET() {
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
