import { accessSync, constants } from "node:fs";
import net from "node:net";
import path from "node:path";

import type {
  AlbumItem,
  ArtistItem,
  LibraryLists,
  MusicFolderItem,
  PlayerCommand,
  PlayerData,
  PlayerSettings,
  PlayerSnapshot,
  PlayerView,
  PlaylistItem,
  RepeatMode,
  Track,
} from "./types";
import { EMPTY_LIBRARY, EMPTY_SETTINGS } from "./types";

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

function rec(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function childFromTrack(track: Track): Record<string, unknown> {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    track: track.track,
    bitRate: track.bitRate,
    suffix: track.suffix,
    samplingRate: track.samplingRate,
    starred: track.starred ? "1" : undefined,
    radio_stream_url: track.streamUrl,
  };
}

function toDaemonRequest(cmd: PlayerCommand): unknown {
  switch (cmd.type) {
    case "TogglePause":
    case "Pause":
    case "Resume":
    case "Stop":
    case "Next":
    case "Previous":
    case "ClearQueue":
    case "ShuffleQueue":
    case "ShuffleLibrary":
    case "ClearQueueHistory":
    case "RefreshStarred":
    case "RefreshRandom":
    case "RefreshArtists":
    case "RefreshPlaylists":
      return cmd.type;
    case "RefreshRadio":
      return "RefreshRadioStations";
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
    case "MoveQueueItem":
      return { MoveQueueItem: { from: cmd.from, to: cmd.to } };
    case "SetRepeatMode":
      return { SetRepeatMode: cmd.mode };
    case "CycleRepeat":
      return { SetRepeatMode: "Off" };
    case "Enqueue":
      return {
        EnqueueSongs: {
          songs: cmd.songs.map(childFromTrack),
          mode:
            cmd.mode.kind === "append"
              ? "Append"
              : { Replace: { play_from: cmd.mode.playFrom } },
        },
      };
    case "LoadArtist":
      return { LoadArtist: cmd.id };
    case "LoadAlbum":
      return { LoadAlbum: cmd.id };
    case "LoadPlaylist":
      return { LoadPlaylist: cmd.id };
    case "Search":
      return {
        Search: {
          query: cmd.query,
          artist_count: 100,
          album_count: 100,
          song_count: 200,
        },
      };
    case "ToggleStar":
      return { ToggleStarSong: cmd.id };
    case "CreatePlaylist":
      return { CreatePlaylist: { name: cmd.name, song_ids: cmd.songIds } };
    case "RenamePlaylist":
      return { RenamePlaylist: { id: cmd.id, name: cmd.name } };
    case "DeletePlaylist":
      return { DeletePlaylist: { id: cmd.id } };
    case "RemovePlaylistSong":
      return { RemovePlaylistSong: { playlist_id: cmd.playlistId, index: cmd.index } };
    case "AddSongToPlaylist":
      return { AddSongToPlaylist: { playlist_id: cmd.playlistId, song_id: cmd.songId } };
    case "SetAutoContinue":
      return { SetAutoContinue: cmd.enabled };
    case "SetScrobble":
      return { SetScrobble: cmd.enabled };
    case "SetMusicFolder":
      return { SetMusicFolder: cmd.id };
    case "UpdateServer":
      return {
        UpdateServerConfig: {
          base_url: cmd.baseUrl,
          username: cmd.username,
          password: cmd.password,
        },
      };
    case "TestServer":
      return {
        TestServerConnection: {
          base_url: cmd.baseUrl,
          username: cmd.username,
          password: cmd.password,
        },
      };
    default:
      return cmd satisfies never;
  }
}

export function mapChild(raw: Record<string, unknown>): Track {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? "Untitled"),
    artist: str(raw.artist),
    album: str(raw.album),
    duration: num(raw.duration),
    track: num(raw.track),
    starred: raw.starred != null && raw.starred !== false,
    bitRate: num(raw.bitRate),
    suffix: str(raw.suffix),
    samplingRate: num(raw.samplingRate),
    streamUrl: str(raw.radio_stream_url),
  };
}

function mapArtist(raw: Record<string, unknown>): ArtistItem {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "Unknown artist"),
    albumCount: num(raw.albumCount),
  };
}

function mapAlbum(raw: Record<string, unknown>): AlbumItem {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "Untitled"),
    artist: str(raw.artist),
    artistId: str(raw.artistId),
    songCount: num(raw.songCount),
    year: num(raw.year),
    duration: num(raw.duration),
  };
}

function mapPlaylist(raw: Record<string, unknown>): PlaylistItem {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "Playlist"),
    songCount: num(raw.songCount) ?? 0,
    duration: num(raw.duration),
    owner: str(raw.owner),
  };
}

function mapFolder(raw: Record<string, unknown>): MusicFolderItem | null {
  const id = num(raw.id);
  if (id == null) return null;
  return { id, name: String(raw.name ?? "Library") };
}

function mapList<T>(value: unknown, map: (raw: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = rec(item);
    return row ? [map(row)] : [];
  });
}

function mapSettings(config: Record<string, unknown> | null): PlayerSettings {
  if (!config) return { ...EMPTY_SETTINGS };
  const password = config.Password;
  const folder = config.MusicFolderId;
  return {
    baseUrl: typeof config.BaseURL === "string" ? config.BaseURL : "",
    username: typeof config.Username === "string" ? config.Username : "",
    passwordSet: typeof password === "string" && password.length > 0,
    autoContinue: bool(config.AutoContinue, false),
    scrobble: bool(config.Scrobble, true),
    musicFolderId: typeof folder === "number" ? folder : null,
  };
}

function mapLibrary(library: Record<string, unknown> | null): LibraryLists {
  if (!library) return { ...EMPTY_LIBRARY, artists: [], playlists: [], starred: [], random: [], radio: [], folders: [] };
  return {
    artists: mapList(library.artists, mapArtist),
    playlists: mapList(library.playlists, mapPlaylist),
    starred: mapList(library.starred_songs, mapChild),
    random: mapList(library.random_songs, mapChild),
    radio: mapList(library.radio_stations, mapChild),
    folders: mapList(library.music_folders, mapFolder).flatMap((folder) => (folder ? [folder] : [])),
  };
}

export function snapshotFromDaemonState(
  state: Record<string, unknown>,
  socketPath: string,
): PlayerSnapshot {
  const nowPlaying = rec(state.now_playing) ?? {};
  const songRaw = rec(nowPlaying.song);
  const config = rec(state.config);
  const settings = mapSettings(config);
  const volume = num(config?.Volume) ?? 100;

  return {
    mode: "daemon",
    socketPath,
    volume,
    repeatMode: (str(config?.RepeatMode) as RepeatMode | undefined) || "Off",
    queue: mapList(state.queue, mapChild),
    queuePosition: num(state.queue_position) ?? null,
    serverLabel: settings.baseUrl || "ferrosonicd",
    message: null,
    settings,
    library: mapLibrary(rec(state.library)),
    nowPlaying: {
      song: songRaw ? mapChild(songRaw) : null,
      state: (str(nowPlaying.state) as PlayerSnapshot["nowPlaying"]["state"]) || "Stopped",
      position: num(nowPlaying.position) ?? 0,
      duration: num(nowPlaying.duration) ?? 0,
      sampleRate: num(nowPlaying.sample_rate) ?? null,
      bitDepth: num(nowPlaying.bit_depth) ?? null,
      format: str(nowPlaying.format) ?? null,
      channels: str(nowPlaying.channels) ?? null,
      codec: str(nowPlaying.codec) ?? null,
      bitrateKbps: num(nowPlaying.bitrate_kbps) ?? null,
    },
  };
}

function dataFromPayload(payload: unknown): PlayerData | undefined {
  const boxed = rec(payload);
  if (!boxed) return undefined;
  if (Array.isArray(boxed.ArtistAlbums)) {
    return { albums: mapList(boxed.ArtistAlbums, mapAlbum) };
  }
  if (Array.isArray(boxed.AlbumSongs)) {
    return { songs: mapList(boxed.AlbumSongs, mapChild) };
  }
  if (Array.isArray(boxed.PlaylistSongs)) {
    return { songs: mapList(boxed.PlaylistSongs, mapChild) };
  }
  const search = rec(boxed.SearchResults);
  if (search) {
    return {
      search: {
        artists: mapList(search.artist, mapArtist),
        albums: mapList(search.album, mapAlbum),
        songs: mapList(search.song, mapChild),
      },
    };
  }
  const connection = rec(boxed.ConnectionTestResult);
  if (connection) {
    return {
      connection: {
        ok: connection.ok === true,
        message: typeof connection.message === "string" ? connection.message : "",
      },
    };
  }
  if (typeof boxed.ServerConfigSaved === "string") {
    return { notice: `Password stored in ${boxed.ServerConfigSaved}.` };
  }
  return undefined;
}

function requestDaemon(socketPath: string, req: unknown, timeoutMs = 8000): Promise<unknown> {
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

    socket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        const { frames, rest } = readFrames(buffer);
        buffer = rest;
        for (const frame of frames) {
          const envelope = rec(frame);
          const response = rec(envelope?.Response);
          if (!response) continue;
          const payload = rec(response.payload);
          if (!payload) {
            finish(new Error("Empty daemon response"));
            return;
          }
          if (typeof payload.Err === "string") {
            finish(new Error(payload.Err));
            return;
          }
          finish(null, payload.Ok);
          return;
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
  const boxed = rec(payload);
  const state = rec(boxed?.Snapshot) ?? boxed;
  if (!state) throw new Error("Unexpected Snapshot response");
  return snapshotFromDaemonState(state, socketPath);
}

export async function sendDaemonCommand(
  cmd: PlayerCommand,
  socketPath = resolveSocketPath(),
): Promise<PlayerView> {
  let request = toDaemonRequest(cmd);
  if (cmd.type === "CycleRepeat") {
    const current = await fetchDaemonSnapshot(socketPath);
    const order: RepeatMode[] = ["Off", "One", "All"];
    const idx = order.indexOf(current.repeatMode);
    const next = order[(idx + 1) % order.length]!;
    request = { SetRepeatMode: next };
  }
  const payload = await requestDaemon(socketPath, request);
  const data = dataFromPayload(payload);
  const snapshot = await fetchDaemonSnapshot(socketPath);
  return data ? { snapshot, data } : { snapshot };
}
