import { getDemoPlayer } from "./demo-player";
import {
  fetchDaemonSnapshot,
  getConfiguredSocketPath,
  sendDaemonCommand,
  socketExists,
} from "./daemon-ipc";
import type { PlayerCommand, PlayerView } from "./types";

function preferDaemon(): boolean {
  if (process.env.FERROSONIC_FORCE_DEMO === "1") return false;
  if (process.env.FERROSONIC_FORCE_DAEMON === "1") return true;
  return socketExists();
}

export async function getPlayerSnapshot(): Promise<PlayerView> {
  if (!preferDaemon()) {
    return { snapshot: getDemoPlayer().snapshot() };
  }
  try {
    return { snapshot: await fetchDaemonSnapshot() };
  } catch (err) {
    const demo = getDemoPlayer().snapshot();
    return {
      snapshot: {
        ...demo,
        mode: "disconnected",
        socketPath: getConfiguredSocketPath(),
        message: `Could not reach ferrosonicd (${(err as Error).message}). Showing demo state.`,
      },
    };
  }
}

export async function runPlayerCommand(cmd: PlayerCommand): Promise<PlayerView> {
  if (!preferDaemon()) {
    return getDemoPlayer().command(cmd);
  }
  try {
    return await sendDaemonCommand(cmd);
  } catch (err) {
    // Do not apply the command to the demo player: that looks like a successful
    // save while the live daemon never got the credentials.
    try {
      const snapshot = await fetchDaemonSnapshot();
      return {
        snapshot: {
          ...snapshot,
          message: `Daemon command failed (${(err as Error).message}).`,
        },
      };
    } catch {
      const demo = getDemoPlayer().snapshot();
      return {
        snapshot: {
          ...demo,
          mode: "disconnected",
          socketPath: getConfiguredSocketPath(),
          message: `Daemon command failed (${(err as Error).message}). Showing demo state.`,
        },
      };
    }
  }
}
