import { nextRepeatMode } from "./format";
import type { PlayerCommand, PlayerSnapshot, RepeatMode, Track } from "./types";

const DEMO_QUEUE: Track[] = [
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
    track: 3,
    suffix: "flac",
    samplingRate: 192000,
    starred: true,
  },
];

function cloneQueue(): Track[] {
  return DEMO_QUEUE.map((t) => ({ ...t }));
}

class DemoPlayer {
  private volume = 72;
  private repeatMode: RepeatMode = "Off";
  private queue = cloneQueue();
  private queuePosition: number | null = 0;
  private state: "Stopped" | "Playing" | "Paused" = "Paused";
  private position = 42;
  private lastTick = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;

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

  snapshot(): PlayerSnapshot {
    this.tick();
    const song = this.currentTrack();
    return {
      mode: "demo",
      socketPath: null,
      volume: this.volume,
      repeatMode: this.repeatMode,
      queue: this.queue.map((t) => ({ ...t })),
      queuePosition: this.queuePosition,
      serverLabel: "Demo library (no ferrosonicd)",
      message:
        "Running in demo mode. Point FERROSONIC_SOCK at a live ferrosonicd socket to control the real player.",
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

  command(cmd: PlayerCommand): PlayerSnapshot {
    switch (cmd.type) {
      case "TogglePause":
        if (this.state === "Playing") this.state = "Paused";
        else if (this.currentTrack()) this.state = "Playing";
        break;
      case "Pause":
        if (this.state === "Playing") this.state = "Paused";
        break;
      case "Resume":
        if (this.currentTrack()) this.state = "Playing";
        break;
      case "Stop":
        this.state = "Stopped";
        this.position = 0;
        break;
      case "Next": {
        const next = (this.queuePosition ?? -1) + 1;
        if (next < this.queue.length) {
          this.queuePosition = next;
          this.position = 0;
          this.state = "Playing";
        }
        break;
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
        break;
      }
      case "Seek":
        this.position = Math.max(0, Math.min(cmd.seconds, this.duration() || cmd.seconds));
        break;
      case "SeekRelative":
        this.position = Math.max(
          0,
          Math.min(this.position + cmd.seconds, this.duration() || this.position + cmd.seconds),
        );
        break;
      case "SetVolume":
        this.volume = Math.max(0, Math.min(100, Math.round(cmd.volume)));
        break;
      case "PlayQueueIndex":
        if (cmd.index >= 0 && cmd.index < this.queue.length) {
          this.queuePosition = cmd.index;
          this.position = 0;
          this.state = "Playing";
        }
        break;
      case "RemoveFromQueue": {
        if (cmd.index < 0 || cmd.index >= this.queue.length) break;
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
        break;
      }
      case "ClearQueue":
        this.queue = [];
        this.queuePosition = null;
        this.state = "Stopped";
        this.position = 0;
        break;
      case "ShuffleQueue": {
        if (this.queuePosition == null || this.queue.length < 2) break;
        const current = this.queue[this.queuePosition];
        const rest = this.queue.filter((_, i) => i !== this.queuePosition);
        for (let i = rest.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [rest[i], rest[j]] = [rest[j], rest[i]];
        }
        this.queue = [current, ...rest];
        this.queuePosition = 0;
        break;
      }
      case "ClearQueueHistory": {
        if (this.queuePosition == null || this.queuePosition === 0) break;
        this.queue = this.queue.slice(this.queuePosition);
        this.queuePosition = 0;
        break;
      }
      case "SetRepeatMode":
        this.repeatMode = cmd.mode;
        break;
      case "CycleRepeat":
        this.repeatMode = nextRepeatMode(this.repeatMode);
        break;
      default:
        break;
    }
    return this.snapshot();
  }
}

const globalForDemo = globalThis as unknown as { __ferrosonicDemo?: DemoPlayer };

export function getDemoPlayer(): DemoPlayer {
  if (!globalForDemo.__ferrosonicDemo) {
    globalForDemo.__ferrosonicDemo = new DemoPlayer();
  }
  return globalForDemo.__ferrosonicDemo;
}
