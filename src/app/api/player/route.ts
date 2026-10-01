import { NextResponse } from "next/server";

import { getPlayerSnapshot, runPlayerCommand } from "@/lib/ferrosonic/player-service";
import type { PlayerCommand } from "@/lib/ferrosonic/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getPlayerSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cmd = body as PlayerCommand;
  if (!cmd || typeof cmd !== "object" || typeof (cmd as { type?: unknown }).type !== "string") {
    return NextResponse.json({ error: "Missing command type" }, { status: 400 });
  }

  const snapshot = await runPlayerCommand(cmd);
  return NextResponse.json(snapshot);
}
