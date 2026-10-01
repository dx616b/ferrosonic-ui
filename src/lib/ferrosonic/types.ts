/** Shared player types mirroring ferrosonic-ng daemon IPC state. */

export type PlaybackState = "Stopped" | "Playing" | "Paused";
export type RepeatMode = "Off" | "One" | "All";
export type ConnectionMode = "demo" | "daemon" | "disconnected";

export interface Track {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  track?: number;
  starred?: boolean;
  bitRate?: number;
  suffix?: string;
  samplingRate?: number;
}

export interface NowPlaying {
  song: Track | null;
  state: PlaybackState;
  position: number;
  duration: number;
  sampleRate?: number | null;
  bitDepth?: number | null;
  format?: string | null;
  channels?: string | null;
  codec?: string | null;
  bitrateKbps?: number | null;
}

export interface PlayerSnapshot {
  mode: ConnectionMode;
  socketPath?: string | null;
  volume: number;
  repeatMode: RepeatMode;
  nowPlaying: NowPlaying;
  queue: Track[];
  queuePosition: number | null;
  serverLabel?: string | null;
  message?: string | null;
}

export type PlayerCommand =
  | { type: "TogglePause" }
  | { type: "Pause" }
  | { type: "Resume" }
  | { type: "Stop" }
  | { type: "Next" }
  | { type: "Previous" }
  | { type: "Seek"; seconds: number }
  | { type: "SeekRelative"; seconds: number }
  | { type: "SetVolume"; volume: number }
  | { type: "PlayQueueIndex"; index: number }
  | { type: "RemoveFromQueue"; index: number }
  | { type: "ClearQueue" }
  | { type: "ShuffleQueue" }
  | { type: "ClearQueueHistory" }
  | { type: "SetRepeatMode"; mode: RepeatMode }
  | { type: "CycleRepeat" };
