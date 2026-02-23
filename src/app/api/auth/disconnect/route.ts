import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
