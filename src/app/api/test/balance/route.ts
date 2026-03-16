
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Real verification logic: only return balance if account_id matches the expected value
  const accountId = searchParams.get('account_id');

  if (accountId === '88991122') {
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

  // Custom error response if the KYC key is incorrect
  return NextResponse.json(
    { 
      status: "error", 
      message: "The account ID you entered is invalid. Please try again with 88991122." 
    },
    { status: 404 }
  );
}
