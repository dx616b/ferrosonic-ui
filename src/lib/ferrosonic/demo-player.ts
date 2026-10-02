import { nextRepeatMode } from "./format";
import type {
  AlbumItem,
  ArtistItem,
  PlayerCommand,
  PlayerData,
  PlayerSettings,
  PlayerSnapshot,
  PlayerView,
  PlaylistItem,
  RepeatMode,
  Track,
} from "./types";
import { EMPTY_SETTINGS } from "./types";

const SONGS: Track[] = [
  {
    id: "demo-1",
    title: "Night Drive",
    artist: "Cyan Circuit",
    album: "Bit-Perfect Nights",
    duration: 248,
    track: 1,
    suffix: "flac",
    samplingRate: 96000,
    bitRate: 2800,
    starred: true,
  },
  {
    id: "demo-2",
    title: "Gapless Horizon",
    artist: "Cyan Circuit",
    album: "Bit-Perfect Nights",
    duration: 312,
    track: 2,
    suffix: "flac",
    samplingRate: 96000,
  },
  {
    id: "demo-3",
    title: "PipeWire Waltz",
    artist: "Ferro Ensemble",
    album: "Sample Rates",
    duration: 195,
    track: 1,
    suffix: "flac",
    samplingRate: 48000,
  },
  {
    id: "demo-4",
    title: "Terminal Glow",
    artist: "Ferro Ensemble",
    album: "Sample Rates",
    duration: 221,
    track: 2,
    suffix: "mp3",
    samplingRate: 44100,
    bitRate: 320,
  },
  {
    id: "demo-5",
    title: "Starred Frequency",
    artist: "Subsonic Lights",
    album: "Library Paths",
    duration: 274,
    track: 1,
    suffix: "flac",
    samplingRate: 192000,
    starred: true,
  },
];

const ARTISTS: ArtistItem[] = [
  { id: "art-cyan", name: "Cyan Circuit", albumCount: 1 },
  { id: "art-ferro", name: "Ferro Ensemble", albumCount: 1 },
  { id: "art-sub", name: "Subsonic Lights", albumCount: 1 },
];

const ALBUMS: AlbumItem[] = [
  { id: "alb-nights", name: "Bit-Perfect Nights", artist: "Cyan Circuit", artistId: "art-cyan", songCount: 2, year: 2024 },
  { id: "alb-rates", name: "Sample Rates", artist: "Ferro Ensemble", artistId: "art-ferro", songCount: 2, year: 2023 },
  { id: "alb-paths", name: "Library Paths", artist: "Subsonic Lights", artistId: "art-sub", songCount: 1, year: 2022 },
];

function songsForAlbum(id: string): Track[] {
  const album = ALBUMS.find((item) => item.id === id);
  if (!album) return [];
  return SONGS.filter((song) => song.album === album.name).map((song) => ({ ...song }));
}

function cloneSongs(): Track[] {
  return SONGS.map((song) => ({ ...song }));
}

class DemoPlayer {
  private volume = 72;
  private repeatMode: RepeatMode = "Off";
  private queue = cloneSongs();
  private queuePosition: number | null = 0;
  private state: "Stopped" | "Playing" | "Paused" = "Paused";
  private position = 42;
  private lastTick = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  private settings: PlayerSettings = {
    ...EMPTY_SETTINGS,
    baseUrl: "https://demo.subsonic.local",
    username: "demo",
    passwordSet: true,
  };
  private playlists: { item: PlaylistItem; songIds: string[] }[] = [
    { item: { id: "pl-nights", name: "Night Drive", songCount: 2, owner: "demo" }, songIds: ["demo-1", "demo-2"] },
    { item: { id: "pl-all", name: "Sampler", songCount: 5, owner: "demo" }, songIds: SONGS.map((song) => song.id) },
  ];
  private catalog = cloneSongs();
  private random = cloneSongs().reverse();

  constructor() {
    this.ensureTicker();
  }

  private ensureTicker() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 250);
  }

  private currentTrack(): Track | null {
    if (this.queuePosition == null) return null;
    return this.queue[this.queuePosition] ?? null;
  }

  private duration(): number {
    return this.currentTrack()?.duration ?? 0;
  }

  private songById(id: string): Track | undefined {
    return this.catalog.find((song) => song.id === id) ?? this.queue.find((song) => song.id === id);
  }

  private touchStar(id: string, starred: boolean) {
    for (const list of [this.catalog, this.queue, this.random]) {
      for (const song of list) {
        if (song.id === id) song.starred = starred;
      }
    }
  }

  private tick() {
    const now = Date.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (this.state !== "Playing") return;
    const dur = this.duration();
    if (dur <= 0) return;
    this.position += dt;
    if (this.position >= dur) {
      if (this.repeatMode === "One") {
        this.position = 0;
        return;
      }
      const next = (this.queuePosition ?? 0) + 1;
      if (next < this.queue.length) {
        this.queuePosition = next;
        this.position = 0;
      } else if (this.repeatMode === "All" && this.queue.length > 0) {
        this.queuePosition = 0;
        this.position = 0;
      } else {
        this.position = dur;
        this.state = "Stopped";
      }
    }
  }

  private playFrom(songs: Track[], index: number) {
    this.queue = songs.map((song) => ({ ...song }));
    this.queuePosition = this.queue.length === 0 ? null : Math.min(index, this.queue.length - 1);
    this.position = 0;
    this.state = this.queuePosition == null ? "Stopped" : "Playing";
  }

  snapshot(): PlayerSnapshot {
    this.tick();
    const song = this.currentTrack();
    const folder = this.settings.musicFolderId;
    const artists = folder === 2 ? ARTISTS.slice(0, 1) : ARTISTS;
    return {
      mode: "demo",
      socketPath: null,
      volume: this.volume,
      repeatMode: this.repeatMode,
      queue: this.queue.map((track) => ({ ...track })),
      queuePosition: this.queuePosition,
      serverLabel: this.settings.baseUrl || "Demo library (no ferrosonicd)",
      message:
        "Running in demo mode. Point FERROSONIC_SOCK at a live ferrosonicd socket to control the real player.",
      settings: { ...this.settings },
      library: {
        artists,
        playlists: this.playlists.map(({ item, songIds }) => ({ ...item, songCount: songIds.length })),
        starred: this.catalog.filter((track) => track.starred).map((track) => ({ ...track })),
        random: this.random.map((track) => ({ ...track })),
        radio: [
          {
            id: "radio-1",
            title: "Subsonic FM",
            artist: "Internet Radio",
            streamUrl: "https://example.invalid/stream",
          },
        ],
        folders: [
          { id: 1, name: "Music" },
          { id: 2, name: "Focus" },
        ],
      },
      nowPlaying: {
        song,
        state: this.state,
        position: this.position,
        duration: this.duration(),
        sampleRate: song?.samplingRate ?? null,
        bitDepth: song?.suffix === "flac" ? 24 : 16,
        format: song?.suffix ?? null,
        channels: "Stereo",
        codec: song?.suffix ?? null,
        bitrateKbps: song?.bitRate ?? null,
      },
    };
  }

  command(cmd: PlayerCommand): PlayerView {
    const data = this.apply(cmd);
    return data ? { snapshot: this.snapshot(), data } : { snapshot: this.snapshot() };
  }

  private apply(cmd: PlayerCommand): PlayerData | undefined {
    switch (cmd.type) {
      case "TogglePause":
        if (this.state === "Playing") this.state = "Paused";
        else if (this.currentTrack()) this.state = "Playing";
        return;
      case "Pause":
        if (this.state === "Playing") this.state = "Paused";
        return;
      case "Resume":
        if (this.currentTrack()) this.state = "Playing";
        return;
      case "Stop":
        this.state = "Stopped";
        this.position = 0;
        return;
      case "Next": {
        const next = (this.queuePosition ?? -1) + 1;
        if (next < this.queue.length) {
          this.queuePosition = next;
          this.position = 0;
          this.state = "Playing";
        }
        return;
      }
      case "Previous": {
        if (this.position > 3) {
          this.position = 0;
        } else {
          const prev = (this.queuePosition ?? 0) - 1;
          if (prev >= 0) {
            this.queuePosition = prev;
            this.position = 0;
            this.state = "Playing";
          } else {
            this.position = 0;
          }
        }
        return;
      }
      case "Seek":
        this.position = Math.max(0, Math.min(cmd.seconds, this.duration() || cmd.seconds));
        return;
      case "SeekRelative":
        this.position = Math.max(
          0,
          Math.min(this.position + cmd.seconds, this.duration() || this.position + cmd.seconds),
        );
        return;
      case "SetVolume":
        this.volume = Math.max(0, Math.min(100, Math.round(cmd.volume)));
        return;
      case "PlayQueueIndex":
        if (cmd.index >= 0 && cmd.index < this.queue.length) {
          this.queuePosition = cmd.index;
          this.position = 0;
          this.state = "Playing";
        }
        return;
      case "RemoveFromQueue": {
        if (cmd.index < 0 || cmd.index >= this.queue.length) return;
        const removingCurrent = this.queuePosition === cmd.index;
        this.queue.splice(cmd.index, 1);
        if (this.queue.length === 0) {
          this.queuePosition = null;
          this.state = "Stopped";
          this.position = 0;
        } else if (this.queuePosition != null) {
          if (removingCurrent) {
            if (this.queuePosition >= this.queue.length) {
              this.queuePosition = this.queue.length - 1;
            }
            this.position = 0;
            this.state = "Playing";
          } else if (cmd.index < this.queuePosition) {
            this.queuePosition -= 1;
          }
        }
        return;
      }
      case "ClearQueue":
        this.queue = [];
        this.queuePosition = null;
        this.state = "Stopped";
        this.position = 0;
        return;
      case "ShuffleQueue": {
        if (this.queue.length < 2) return;
        const current = this.queuePosition == null ? undefined : this.queue[this.queuePosition];
        const rest = this.queue.filter((song) => song !== current);
        for (let i = rest.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          const left = rest[i];
          const right = rest[j];
          if (left && right) {
            rest[i] = right;
            rest[j] = left;
          }
        }
        this.queue = current ? [current, ...rest] : rest;
        this.queuePosition = this.queue.length ? 0 : null;
        return;
      }
      case "ShuffleLibrary": {
        const songs = cloneSongs();
        for (let i = songs.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          const left = songs[i];
          const right = songs[j];
          if (left && right) {
            songs[i] = right;
            songs[j] = left;
          }
        }
        this.playFrom(songs, 0);
        return;
      }
      case "ClearQueueHistory": {
        if (this.queuePosition == null || this.queuePosition === 0) return;
        this.queue = this.queue.slice(this.queuePosition);
        this.queuePosition = 0;
        return;
      }
      case "MoveQueueItem": {
        const { from, to } = cmd;
        if (from === to || from < 0 || to < 0 || from >= this.queue.length || to >= this.queue.length) return;
        const [item] = this.queue.splice(from, 1);
        if (!item) return;
        this.queue.splice(to, 0, item);
        if (this.queuePosition === from) this.queuePosition = to;
        else if (this.queuePosition != null && from < this.queuePosition && to >= this.queuePosition) {
          this.queuePosition -= 1;
        } else if (this.queuePosition != null && from > this.queuePosition && to <= this.queuePosition) {
          this.queuePosition += 1;
        }
        return;
      }
      case "SetRepeatMode":
        this.repeatMode = cmd.mode;
        return;
      case "CycleRepeat":
        this.repeatMode = nextRepeatMode(this.repeatMode);
        return;
      case "Enqueue": {
        const songs = cmd.songs.map((song) => ({ ...song }));
        if (cmd.mode.kind === "append") {
          this.queue.push(...songs);
          if (this.queuePosition == null && this.queue.length > 0) {
            this.queuePosition = 0;
            this.state = "Playing";
          }
          return;
        }
        this.playFrom(songs, cmd.mode.playFrom ?? 0);
        return;
      }
      case "LoadArtist":
        return { albums: ALBUMS.filter((album) => album.artistId === cmd.id).map((album) => ({ ...album })) };
      case "LoadAlbum":
        return { songs: songsForAlbum(cmd.id) };
      case "LoadPlaylist": {
        const playlist = this.playlists.find((item) => item.item.id === cmd.id);
        const songs = (playlist?.songIds ?? [])
          .map((id) => this.songById(id))
          .filter((song): song is Track => Boolean(song))
          .map((song) => ({ ...song }));
        return { songs };
      }
      case "Search": {
        const q = cmd.query.trim().toLowerCase();
        if (!q) return { search: { artists: [], albums: [], songs: [] } };
        return {
          search: {
            artists: ARTISTS.filter((artist) => artist.name.toLowerCase().includes(q)),
            albums: ALBUMS.filter((album) => album.name.toLowerCase().includes(q)).map((album) => ({ ...album })),
            songs: this.catalog.filter((song) =>
              `${song.title} ${song.artist ?? ""} ${song.album ?? ""}`.toLowerCase().includes(q),
            ),
          },
        };
      }
      case "RefreshStarred":
      case "RefreshArtists":
      case "RefreshPlaylists":
      case "RefreshRadio":
        return;
      case "RefreshRandom":
        this.random = cloneSongs().sort(() => Math.random() - 0.5);
        return;
      case "ToggleStar": {
        const song = this.songById(cmd.id);
        this.touchStar(cmd.id, !song?.starred);
        return;
      }
      case "CreatePlaylist": {
        const id = `pl-${Date.now()}`;
        this.playlists.push({
          item: { id, name: cmd.name, songCount: cmd.songIds.length, owner: this.settings.username || "demo" },
          songIds: [...cmd.songIds],
        });
        return { notice: `Saved playlist “${cmd.name}”.` };
      }
      case "RenamePlaylist": {
        const playlist = this.playlists.find((item) => item.item.id === cmd.id);
        if (playlist) playlist.item.name = cmd.name;
        return;
      }
      case "DeletePlaylist":
        this.playlists = this.playlists.filter((item) => item.item.id !== cmd.id);
        return;
      case "RemovePlaylistSong": {
        const playlist = this.playlists.find((item) => item.item.id === cmd.playlistId);
        playlist?.songIds.splice(cmd.index, 1);
        return;
      }
      case "AddSongToPlaylist": {
        const playlist = this.playlists.find((item) => item.item.id === cmd.playlistId);
        if (playlist && !playlist.songIds.includes(cmd.songId)) playlist.songIds.push(cmd.songId);
        return;
      }
      case "SetAutoContinue":
        this.settings.autoContinue = cmd.enabled;
        return;
      case "SetScrobble":
        this.settings.scrobble = cmd.enabled;
        return;
      case "SetMusicFolder":
        this.settings.musicFolderId = cmd.id;
        return;
      case "UpdateServer":
        this.settings.baseUrl = cmd.baseUrl;
        this.settings.username = cmd.username;
        this.settings.passwordSet = cmd.password.length > 0;
        return { notice: "Saved demo server settings. Nothing was sent to a real server." };
      case "TestServer":
        return {
          connection: {
            ok: cmd.baseUrl.startsWith("http") && cmd.username.length > 0 && cmd.password.length > 0,
            message:
              cmd.baseUrl.startsWith("http") && cmd.username && cmd.password
                ? "Demo mode cannot reach a server. Credentials look complete."
                : "URL, username, and password are required.",
          },
        };
      default:
        return cmd satisfies never;
    }
  }
}

const globalForDemo = globalThis as unknown as { __ferrosonicDemo?: DemoPlayer };

export function getDemoPlayer(): DemoPlayer {
  if (!globalForDemo.__ferrosonicDemo) {
    globalForDemo.__ferrosonicDemo = new DemoPlayer();
  }
  return globalForDemo.__ferrosonicDemo;
}
