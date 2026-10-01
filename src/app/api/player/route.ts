import { NextResponse } from "next/server";

import { handlePlayerHttp } from "@/lib/ferrosonic/player-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await handlePlayerHttp("GET");
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const result = await handlePlayerHttp("POST", await request.text());
  return NextResponse.json(result.body, { status: result.status });
}
