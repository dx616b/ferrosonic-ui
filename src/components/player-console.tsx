"use client";

import {
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { LibraryPage } from "@/components/pages/library-page";
import { PlaylistsPage } from "@/components/pages/playlists-page";
import { QueuePage } from "@/components/pages/queue-page";
import { QuickPlayPage } from "@/components/pages/quick-play-page";
import { ServerPage } from "@/components/pages/server-page";
import { SettingsPage } from "@/components/pages/settings-page";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatQuality, formatTime } from "@/lib/ferrosonic/format";
import { lockScreenSilenceUrl } from "@/lib/ferrosonic/lock-screen";
import type { PlayerCommand, PlayerData, PlayerSnapshot, PlayerView } from "@/lib/ferrosonic/types";
import { EMPTY_LIBRARY, EMPTY_SETTINGS } from "@/lib/ferrosonic/types";
import { cn } from "@/lib/utils";

const PAGES = ["Library", "Queue", "Quick Play", "Playlists", "Server", "Settings"] as const;
type PageName = (typeof PAGES)[number];

const EMPTY: PlayerSnapshot = {
  mode: "demo",
  volume: 0,
  repeatMode: "Off",
  queue: [],
  queuePosition: null,
  settings: EMPTY_SETTINGS,
  library: EMPTY_LIBRARY,
  nowPlaying: {
    song: null,
    state: "Stopped",
    position: 0,
    duration: 0,
  },
};

export function PlayerConsole() {
  const [snapshot, setSnapshot] = useState<PlayerSnapshot>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState<PageName>("Library");
  const [volumeDrag, setVolumeDrag] = useState<number | null>(null);
  const [seekDrag, setSeekDrag] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const epoch = useRef(0);

  const refresh = useCallback(async () => {
    const started = epoch.current;
    try {
      const res = await fetch("/api/player", { cache: "no-store" });
      if (started !== epoch.current) return;
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = (await res.json()) as PlayerView;
      if (started !== epoch.current) return;
      setSnapshot(data.snapshot);
      setError(null);
      setLoaded(true);
    } catch (err) {
      if (started !== epoch.current) return;
      setError((err as Error).message);
      setLoaded(true);
    }
  }, []);

  const send = useCallback(
    (cmd: PlayerCommand) =>
      new Promise<PlayerData | undefined>((resolve) => {
        startTransition(async () => {
          epoch.current += 1;
          const started = epoch.current;
          try {
            const res = await fetch("/api/player", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cmd),
            });
            const data = (await res.json()) as PlayerView & { error?: string };
            if (started !== epoch.current) {
              resolve(undefined);
              return;
            }
            if (!res.ok) throw new Error(data.error ?? `Command failed (${res.status})`);
            setSnapshot(data.snapshot);
            setError(null);
            setNotice(data.data?.notice ?? data.data?.connection?.message ?? null);
            resolve(data.data);
          } catch (err) {
            if (started !== epoch.current) {
              resolve(undefined);
              return;
            }
            setError((err as Error).message);
            resolve(undefined);
          }
        });
      }),
    [],
  );

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, 1000);
    return () => clearInterval(id);
  }, [refresh]);

  const volume = volumeDrag ?? snapshot.volume;
  const np = snapshot.nowPlaying;
  const playing = np.state === "Playing";
  const progress =
    seekDrag ?? (np.duration > 0 ? Math.min(100, Math.max(0, (np.position / np.duration) * 100)) : 0);
  const shownPosition = seekDrag != null && np.duration > 0 ? (seekDrag / 100) * np.duration : np.position;
  const quality = formatQuality(np);
  const modeLabel =
    snapshot.mode === "daemon" ? "Connected" : snapshot.mode === "disconnected" ? "Daemon unreachable" : "Demo mode";
  const audioRef = useRef<HTMLAudioElement>(null);
  const [lockReady, setLockReady] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = lockScreenSilenceUrl();
    audio.loop = true;
  }, []);

  const armLockScreen = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || lockReady) return;
    audio.loop = true;
    void audio.play().then(() => setLockReady(true)).catch(() => setLockReady(false));
  }, [lockReady]);

  useEffect(() => {
    if (!lockReady || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    const song = np.song;
    session.metadata = new MediaMetadata({
      title: song?.title ?? "Ferrosonic",
      artist: song?.artist ?? "",
      album: song?.album ?? "",
    });
    session.playbackState = playing ? "playing" : "paused";
    if (np.duration > 0 && Number.isFinite(shownPosition)) {
      const position = Math.min(Math.max(0, shownPosition), np.duration);
      try {
        session.setPositionState({ duration: np.duration, playbackRate: playing ? 1 : 0, position });
      } catch {
        // The browser rejects a position the clock has not caught up with yet.
      }
    }
    const bind = (action: MediaSessionAction, run: MediaSessionActionHandler | null) => {
      try {
        session.setActionHandler(action, run);
      } catch {
        // This browser does not offer that lock-screen action.
      }
    };
    bind("play", () => {
      if (!playing) void send({ type: "TogglePause" });
    });
    bind("pause", () => {
      if (playing) void send({ type: "TogglePause" });
    });
    bind("previoustrack", () => void send({ type: "Previous" }));
    bind("nexttrack", () => void send({ type: "Next" }));
    bind("stop", () => void send({ type: "Stop" }));
    bind("seekto", (details) => {
      if (details.seekTime != null) void send({ type: "Seek", seconds: details.seekTime });
    });
    return () => {
      bind("play", null);
      bind("pause", null);
      bind("previoustrack", null);
      bind("nexttrack", null);
      bind("seekto", null);
      bind("stop", null);
    };
  }, [lockReady, np.song, np.duration, playing, shownPosition, send]);

  return (
    <div className="relative flex min-h-dvh w-full flex-col gap-4 px-[clamp(0.75rem,2.5vw,2rem)] pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="relative z-10 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[clamp(1.75rem,4.5vw,3rem)] leading-none tracking-[-0.04em] text-[var(--ferro-cyan)]">
            Ferrosonic
          </p>
          <p className="mt-2 truncate text-sm text-[var(--ferro-muted)]">{snapshot.serverLabel ?? "Player control"}</p>
        </div>
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs tracking-wide",
            snapshot.mode === "daemon"
              ? "border-[var(--ferro-cyan)]/40 text-[var(--ferro-cyan)]"
              : snapshot.mode === "disconnected"
                ? "border-[var(--ferro-warn)]/50 text-[var(--ferro-warn)]"
                : "border-[var(--ferro-yellow)]/40 text-[var(--ferro-yellow)]",
          )}
        >
          {snapshot.mode === "daemon" ? <Wifi className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
          {modeLabel}
        </div>
      </header>

      <nav className="relative z-10 -mx-[clamp(0.75rem,2.5vw,2rem)] flex gap-1 overflow-x-auto border-b border-white/10 px-[clamp(0.75rem,2.5vw,2rem)] pb-2">
        {PAGES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setPage(name)}
            className={cn(
              "min-h-11 shrink-0 rounded-md px-3 py-2 text-sm [@media(hover:hover)]:min-h-0 [@media(hover:hover)]:py-1.5",
              page === name ? "bg-[var(--ferro-cyan)]/15 text-[var(--ferro-cyan)]" : "text-[var(--ferro-muted)] hover:text-[var(--ferro-text)]",
            )}
          >
            {name}
          </button>
        ))}
      </nav>

      {(error || notice || snapshot.message) && (
        <p className="relative z-10 text-sm text-[var(--ferro-muted)]" role="status">
          {error ?? notice ?? snapshot.message}
        </p>
      )}

      <audio ref={audioRef} className="pointer-events-none absolute h-0 w-0" preload="auto" playsInline loop />
      <section
        className="ferro-panel sticky top-[env(safe-area-inset-top,0px)] z-30 space-y-2 bg-[#07131c]/95 p-3 [@media(max-height:700px)]:space-y-1 [@media(max-height:700px)]:p-2 [@media(min-width:640px)]:top-3 [@media(min-width:640px)]:space-y-3 [@media(min-width:640px)]:p-4"
        onPointerDown={() => armLockScreen()}
      >
        <div className="flex flex-col gap-3 [@media(min-width:640px)]:flex-row [@media(min-width:640px)]:flex-wrap [@media(min-width:640px)]:items-end [@media(min-width:640px)]:justify-between">
          <div className="min-w-0 [@media(min-width:640px)]:flex-1">
            <p className="hidden text-[10px] uppercase tracking-[0.2em] text-[var(--ferro-muted)] [@media(min-width:640px)]:block">Now playing</p>
            <p className="truncate font-display text-[clamp(1.05rem,2.4vw,1.75rem)] tracking-[-0.03em]">
              {np.song?.title ?? (loaded ? "Nothing queued" : "Connecting…")}
            </p>
            <p className="truncate text-sm text-[var(--ferro-cyan)]">
              {np.song?.artist ?? "—"}
              {np.song?.album ? <span className="text-[var(--ferro-muted)]"> · {np.song.album}</span> : null}
            </p>
            {quality ? <p className="truncate font-mono text-xs text-[var(--ferro-yellow)]/90 [@media(max-height:700px)]:hidden">{quality}</p> : null}
          </div>
          <div className="flex items-center justify-between gap-1 [@media(min-width:640px)]:justify-end [@media(min-width:640px)]:gap-2">
            <Button variant="outline" size="icon" aria-label="Previous track" disabled={pending} onClick={() => void send({ type: "Previous" })}>
              <SkipBack />
            </Button>
            <Button
              size="icon"
              aria-label={playing ? "Pause" : "Play"}
              disabled={pending || !np.song}
              onClick={() => void send({ type: "TogglePause" })}
              className="bg-[var(--ferro-cyan)] text-[var(--ferro-ink)] hover:bg-[var(--ferro-cyan)]/85"
            >
              {playing ? <Pause /> : <Play />}
            </Button>
            <Button variant="outline" size="icon" aria-label="Stop" disabled={pending} onClick={() => void send({ type: "Stop" })}>
              <Square />
            </Button>
            <Button variant="outline" size="icon" aria-label="Next track" disabled={pending} onClick={() => void send({ type: "Next" })}>
              <SkipForward />
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => void send({ type: "CycleRepeat" })}>
              <Repeat className="size-4" /> {snapshot.repeatMode}
            </Button>
            {lockReady ? null : (
              <Button variant="ghost" size="sm" onClick={() => armLockScreen()}>
                Lock screen
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-12 font-mono text-[10px] text-[var(--ferro-muted)]">{formatTime(shownPosition)}</span>
          <Slider
            value={[progress]}
            max={100}
            step={0.1}
            disabled={!np.song || np.duration <= 0}
            onValueChange={(value) => {
              const pct = Array.isArray(value) ? Number(value[0]) : Number(value);
              if (Number.isFinite(pct)) setSeekDrag(pct);
            }}
            onValueCommitted={(value) => {
              const pct = Array.isArray(value) ? Number(value[0]) : Number(value);
              if (!Number.isFinite(pct) || np.duration <= 0) return;
              setSeekDrag(pct);
              void send({ type: "Seek", seconds: (pct / 100) * np.duration }).finally(() => setSeekDrag(null));
            }}
            aria-label="Seek"
            className="min-w-0 flex-1"
          />
          <span className="w-12 text-right font-mono text-[10px] text-[var(--ferro-muted)]">{formatTime(np.duration)}</span>
        </div>
        <div className="flex items-center gap-3">
          <Volume2 className="size-4 shrink-0 text-[var(--ferro-muted)]" aria-hidden />
          <Slider
            value={[volume]}
            max={100}
            step={1}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? Number(value[0]) : Number(value);
              if (Number.isFinite(next)) setVolumeDrag(next);
            }}
            onValueCommitted={(value) => {
              const next = Array.isArray(value) ? Number(value[0]) : Number(value);
              if (!Number.isFinite(next)) return;
              setVolumeDrag(next);
              void send({ type: "SetVolume", volume: next }).finally(() => setVolumeDrag(null));
            }}
            aria-label="Volume"
            className="min-w-0 flex-1"
          />
          <span className="w-10 text-right font-mono text-[10px] text-[var(--ferro-muted)]">{Math.round(volume)}%</span>
        </div>
      </section>

      <div className="relative z-10">
        {page === "Library" ? <LibraryPage snapshot={snapshot} busy={pending} send={send} /> : null}
        {page === "Queue" ? <QueuePage snapshot={snapshot} busy={pending} send={send} /> : null}
        {page === "Quick Play" ? <QuickPlayPage snapshot={snapshot} busy={pending} send={send} /> : null}
        {page === "Playlists" ? <PlaylistsPage snapshot={snapshot} busy={pending} send={send} /> : null}
        {page === "Server" ? (
          <ServerPage
            key={`${snapshot.settings.baseUrl}|${snapshot.settings.username}|${loaded}`}
            snapshot={snapshot}
            busy={pending}
            send={send}
          />
        ) : null}
        {page === "Settings" ? <SettingsPage snapshot={snapshot} busy={pending} send={send} /> : null}
      </div>

    </div>
  );
}
