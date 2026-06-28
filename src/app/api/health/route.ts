import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    app: "expense-tracker",
    version: "1.0.0",
  });
}
