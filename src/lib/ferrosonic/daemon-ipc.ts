import { accessSync, constants } from "node:fs";
import net from "node:net";
import { homedir } from "node:os";
import path from "node:path";

import type { PlayerCommand, PlayerSnapshot, RepeatMode, Track } from "./types";

const MAX_FRAME_BYTES = 16 * 1024 * 1024;

function resolveSocketPath(): string {
  if (process.env.FERROSONIC_SOCK) return process.env.FERROSONIC_SOCK;
  if (process.env.XDG_RUNTIME_DIR) {
    return path.join(process.env.XDG_RUNTIME_DIR, "ferrosonic", "ferrosonicd.sock");
  }
  const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
  return path.join("/tmp", `ferrosonic-${uid}`, "ferrosonicd.sock");
}

export function socketExists(socketPath = resolveSocketPath()): boolean {
  try {
    accessSync(socketPath, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function getConfiguredSocketPath(): string {
  return resolveSocketPath();
}

function encodeFrame(obj: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

function readFrames(buffer: Buffer): { frames: unknown[]; rest: Buffer } {
  const frames: unknown[] = [];
  let offset = 0;
  while (offset + 4 <= buffer.length) {
    const len = buffer.readUInt32LE(offset);
    if (len > MAX_FRAME_BYTES) {
      throw new Error(`IPC frame too large: ${len}`);
    }
    if (offset + 4 + len > buffer.length) break;
    const body = buffer.subarray(offset + 4, offset + 4 + len);
    frames.push(JSON.parse(body.toString("utf8")));
    offset += 4 + len;
  }
  return { frames, rest: buffer.subarray(offset) };
}

function toDaemonRequest(cmd: PlayerCommand): unknown {
  switch (cmd.type) {
    case "TogglePause":
      return "TogglePause";
    case "Pause":
      return "Pause";
    case "Resume":
      return "Resume";
    case "Stop":
      return "Stop";
    case "Next":
      return "Next";
    case "Previous":
      return "Previous";
    case "Seek":
      return { Seek: cmd.seconds };
    case "SeekRelative":
      return { SeekRelative: cmd.seconds };
    case "SetVolume":
      return { SetVolume: Math.round(cmd.volume) };
    case "PlayQueueIndex":
      return { PlayQueueIndex: cmd.index };
    case "RemoveFromQueue":
      return { RemoveFromQueue: cmd.index };
    case "ClearQueue":
      return "ClearQueue";
    case "ShuffleQueue":
      return "ShuffleQueue";
    case "ClearQueueHistory":
      return "ClearQueueHistory";
    case "SetRepeatMode":
      return { SetRepeatMode: cmd.mode };
    case "CycleRepeat":
      // Resolved by caller after reading current mode.
      return { SetRepeatMode: "Off" };
    default:
      return "Ping";
  }
}

function mapChild(raw: Record<string, unknown>): Track {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? "Untitled"),
    artist: raw.artist != null ? String(raw.artist) : undefined,
    album: raw.album != null ? String(raw.album) : undefined,
    duration: typeof raw.duration === "number" ? raw.duration : undefined,
    track: typeof raw.track === "number" ? raw.track : undefined,
    starred: raw.starred != null,
    bitRate: typeof raw.bitRate === "number" ? raw.bitRate : undefined,
    suffix: raw.suffix != null ? String(raw.suffix) : undefined,
    samplingRate: typeof raw.samplingRate === "number" ? raw.samplingRate : undefined,
  };
}

function snapshotFromDaemonState(
  state: Record<string, unknown>,
  socketPath: string,
): PlayerSnapshot {
  const nowPlaying = (state.now_playing ?? {}) as Record<string, unknown>;
  const songRaw = nowPlaying.song as Record<string, unknown> | null | undefined;
  const queueRaw = Array.isArray(state.queue) ? state.queue : [];
  const config = (state.config ?? {}) as Record<string, unknown>;
  const volume = typeof config.Volume === "number" ? config.Volume : 100;

  const queue = queueRaw.map((item) => mapChild(item as Record<string, unknown>));
  const queuePosition =
    typeof state.queue_position === "number" ? state.queue_position : null;

  return {
    mode: "daemon",
    socketPath,
    volume,
    repeatMode: (config.RepeatMode as RepeatMode) || "Off",
    queue,
    queuePosition,
    serverLabel:
      typeof config.BaseURL === "string" && config.BaseURL
        ? config.BaseURL
        : "ferrosonicd",
    message: null,
    nowPlaying: {
      song: songRaw ? mapChild(songRaw) : null,
      state: (nowPlaying.state as PlayerSnapshot["nowPlaying"]["state"]) || "Stopped",
      position: typeof nowPlaying.position === "number" ? nowPlaying.position : 0,
      duration: typeof nowPlaying.duration === "number" ? nowPlaying.duration : 0,
      sampleRate: (nowPlaying.sample_rate as number | null) ?? null,
      bitDepth: (nowPlaying.bit_depth as number | null) ?? null,
      format: (nowPlaying.format as string | null) ?? null,
      channels: (nowPlaying.channels as string | null) ?? null,
      codec: (nowPlaying.codec as string | null) ?? null,
      bitrateKbps: (nowPlaying.bitrate_kbps as number | null) ?? null,
    },
  };
}

async function requestDaemon(
  socketPath: string,
  req: unknown,
  timeoutMs = 4000,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let buffer: Buffer = Buffer.alloc(0);
    let settled = false;
    const id = 1;

    const finish = (err: Error | null, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (err) reject(err);
      else resolve(value);
    };

    const timer = setTimeout(() => finish(new Error("IPC timeout")), timeoutMs);

    socket.on("connect", () => {
      socket.write(encodeFrame({ Request: { id, req } }));
    });

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk as Buffer]);
      try {
        const { frames, rest } = readFrames(buffer);
        buffer = rest;
        for (const frame of frames) {
          const f = frame as Record<string, unknown>;
          if (f.Response) {
            const response = f.Response as {
              id: number;
              payload: { Ok?: unknown; Err?: string };
            };
            if (response.payload?.Err) {
              finish(new Error(response.payload.Err));
              return;
            }
            finish(null, response.payload?.Ok);
            return;
          }
        }
      } catch (err) {
        finish(err as Error);
      }
    });

    socket.on("error", (err) => finish(err));
    socket.on("end", () => {
      if (!settled) finish(new Error("Daemon closed connection"));
    });
  });
}

export async function fetchDaemonSnapshot(
  socketPath = resolveSocketPath(),
): Promise<PlayerSnapshot> {
  const payload = await requestDaemon(socketPath, "Snapshot");
  if (!payload || typeof payload !== "object") {
    throw new Error("Unexpected Snapshot response");
  }
  const boxed = payload as { Snapshot?: Record<string, unknown> };
  const state = boxed.Snapshot ?? (payload as Record<string, unknown>);
  return snapshotFromDaemonState(state, socketPath);
}

export async function sendDaemonCommand(
  cmd: PlayerCommand,
  socketPath = resolveSocketPath(),
): Promise<PlayerSnapshot> {
  let request = toDaemonRequest(cmd);
  if (cmd.type === "CycleRepeat") {
    const current = await fetchDaemonSnapshot(socketPath);
    const order: RepeatMode[] = ["Off", "One", "All"];
    const idx = order.indexOf(current.repeatMode);
    const next = order[(idx + 1) % order.length]!;
    request = { SetRepeatMode: next };
  }
  await requestDaemon(socketPath, request);
  // Volume lives in the audio stack; Snapshot after short delay for consistency.
  return fetchDaemonSnapshot(socketPath);
}

export function defaultConfigDir(): string {
  return path.join(homedir(), ".config", "ferrosonic");
}
