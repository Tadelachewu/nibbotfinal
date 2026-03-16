
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Simulated database of accounts
  const mockAccounts: Record<string, any> = {
    '88991122': {
      balance: "12,500.00",
      currency: "ETB",
      account_id: "88991122",
      account_type: "Savings",
      last_updated: new Date().toISOString()
    },
    '11223344': {
      balance: "5,200.50",
      currency: "ETB",
      account_id: "11223344",
      account_type: "Current",
      last_updated: new Date().toISOString()
    },
    '99887766': {
      balance: "450,000.00",
      currency: "ETB",
      account_id: "99887766",
      account_type: "Premium Savings",
      last_updated: new Date().toISOString()
    },
    '12345678': {
      balance: "0.00",
      currency: "ETB",
      account_id: "12345678",
      account_type: "Student Account",
      last_updated: new Date().toISOString()
    }
  };

  const accountId = searchParams.get('account_id');

  if (accountId && mockAccounts[accountId]) {
    return NextResponse.json({
      status: "success",
      data: mockAccounts[accountId]
    });
  }

  // Custom error response if the account ID is not in our mock database
  return NextResponse.json(
    { 
      status: "error", 
      message: `The account ID "${accountId || 'none'}" was not recognized. Please try with one of our test IDs: 88991122, 11223344, 99887766, or 12345678.` 
    },
    { status: 404 }
  );
}
