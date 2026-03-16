
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: "success",
    data: {
      balance: "12,500.00",
      currency: "ETB",
      account_id: "88991122",
      account_type: "Savings",
      last_updated: new Date().toISOString()
    }
  });
}
