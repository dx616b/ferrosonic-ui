import { getDemoPlayer } from "./demo-player";
import {
  fetchDaemonSnapshot,
  getConfiguredSocketPath,
  sendDaemonCommand,
  socketExists,
} from "./daemon-ipc";
import type { PlayerCommand, PlayerSnapshot } from "./types";

function preferDaemon(): boolean {
  if (process.env.FERROSONIC_FORCE_DEMO === "1") return false;
  if (process.env.FERROSONIC_FORCE_DAEMON === "1") return true;
  return socketExists();
}

export async function getPlayerSnapshot(): Promise<PlayerSnapshot> {
  if (!preferDaemon()) {
    return getDemoPlayer().snapshot();
  }
  try {
    return await fetchDaemonSnapshot();
  } catch (err) {
    const demo = getDemoPlayer().snapshot();
    return {
      ...demo,
      mode: "disconnected",
      socketPath: getConfiguredSocketPath(),
      message: `Could not reach ferrosonicd (${(err as Error).message}). Showing demo state.`,
    };
  }
}

export async function runPlayerCommand(cmd: PlayerCommand): Promise<PlayerSnapshot> {
  if (!preferDaemon()) {
    return getDemoPlayer().command(cmd);
  }
  try {
    return await sendDaemonCommand(cmd);
  } catch (err) {
    const demo = getDemoPlayer().command(cmd);
    return {
      ...demo,
      mode: "disconnected",
      socketPath: getConfiguredSocketPath(),
      message: `Daemon command failed (${(err as Error).message}). Applied to demo fallback.`,
    };
  }
}
