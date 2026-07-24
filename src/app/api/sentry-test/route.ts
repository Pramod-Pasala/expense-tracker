import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  // This will be captured by Sentry's onRequestError handler
  throw new Error("Sentry server-side test error from staging - intentional");
}

export async function POST(_req: NextRequest) {
  // Alternative: capture manually
  return NextResponse.json({ 
    ok: true, 
    message: "If you see this, the error was caught by Next.js error boundary",
    timestamp: new Date().toISOString()
  });
}
