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
  streamUrl?: string;
}

export interface ArtistItem {
  id: string;
  name: string;
  albumCount?: number;
}

export interface AlbumItem {
  id: string;
  name: string;
  artist?: string;
  artistId?: string;
  songCount?: number;
  year?: number;
  duration?: number;
}

export interface PlaylistItem {
  id: string;
  name: string;
  songCount: number;
  duration?: number;
  owner?: string;
}

export interface MusicFolderItem {
  id: number;
  name: string;
}

export interface PlayerSettings {
  baseUrl: string;
  username: string;
  passwordSet: boolean;
  autoContinue: boolean;
  scrobble: boolean;
  musicFolderId: number | null;
}

export interface LibraryLists {
  artists: ArtistItem[];
  playlists: PlaylistItem[];
  starred: Track[];
  random: Track[];
  radio: Track[];
  folders: MusicFolderItem[];
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
  settings: PlayerSettings;
  library: LibraryLists;
}

export interface PlayerData {
  albums?: AlbumItem[];
  songs?: Track[];
  search?: {
    artists: ArtistItem[];
    albums: AlbumItem[];
    songs: Track[];
  };
  connection?: { ok: boolean; message: string };
  notice?: string;
}

export interface PlayerView {
  snapshot: PlayerSnapshot;
  data?: PlayerData;
}

export type EnqueueMode =
  | { kind: "replace"; playFrom: number | null }
  | { kind: "append" };

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
  | { type: "ShuffleLibrary" }
  | { type: "ClearQueueHistory" }
  | { type: "MoveQueueItem"; from: number; to: number }
  | { type: "SetRepeatMode"; mode: RepeatMode }
  | { type: "CycleRepeat" }
  | { type: "Enqueue"; songs: Track[]; mode: EnqueueMode }
  | { type: "LoadArtist"; id: string }
  | { type: "LoadAlbum"; id: string }
  | { type: "LoadPlaylist"; id: string }
  | { type: "Search"; query: string }
  | { type: "RefreshStarred" }
  | { type: "RefreshRandom" }
  | { type: "RefreshRadio" }
  | { type: "RefreshArtists" }
  | { type: "RefreshPlaylists" }
  | { type: "ToggleStar"; id: string }
  | { type: "CreatePlaylist"; name: string; songIds: string[] }
  | { type: "RenamePlaylist"; id: string; name: string }
  | { type: "DeletePlaylist"; id: string }
  | { type: "RemovePlaylistSong"; playlistId: string; index: number }
  | { type: "AddSongToPlaylist"; playlistId: string; songId: string }
  | { type: "SetAutoContinue"; enabled: boolean }
  | { type: "SetScrobble"; enabled: boolean }
  | { type: "SetMusicFolder"; id: number | null }
  | { type: "UpdateServer"; baseUrl: string; username: string; password: string }
  | { type: "TestServer"; baseUrl: string; username: string; password: string };

export const EMPTY_SETTINGS: PlayerSettings = {
  baseUrl: "",
  username: "",
  passwordSet: false,
  autoContinue: false,
  scrobble: true,
  musicFolderId: null,
};

export const EMPTY_LIBRARY: LibraryLists = {
  artists: [],
  playlists: [],
  starred: [],
  random: [],
  radio: [],
  folders: [],
};
