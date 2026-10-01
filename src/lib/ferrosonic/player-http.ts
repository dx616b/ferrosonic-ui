import { getPlayerSnapshot, runPlayerCommand } from "./player-service";
import type { PlayerCommand, PlayerView } from "./types";

export async function handlePlayerHttp(
  method: string,
  rawBody?: string,
): Promise<{ status: number; body: PlayerView | { error: string } }> {
  if (method === "GET") {
    return { status: 200, body: await getPlayerSnapshot() };
  }
  if (method !== "POST") {
    return { status: 405, body: { error: "Method not allowed" } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody ?? "");
  } catch {
    return { status: 400, body: { error: "Invalid JSON body" } };
  }

  const cmd = parsed as PlayerCommand;
  if (!cmd || typeof cmd !== "object" || typeof (cmd as { type?: unknown }).type !== "string") {
    return { status: 400, body: { error: "Missing command type" } };
  }

  return { status: 200, body: await runPlayerCommand(cmd) };
}
