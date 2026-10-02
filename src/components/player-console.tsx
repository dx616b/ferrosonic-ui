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
import { useCallback, useEffect, useState, useTransition } from "react";

import { LibraryPage } from "@/components/pages/library-page";
import { PlaylistsPage } from "@/components/pages/playlists-page";
import { QueuePage } from "@/components/pages/queue-page";
import { QuickPlayPage } from "@/components/pages/quick-play-page";
import { ServerPage } from "@/components/pages/server-page";
import { SettingsPage } from "@/components/pages/settings-page";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatQuality, formatTime } from "@/lib/ferrosonic/format";
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
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/player", { cache: "no-store" });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = (await res.json()) as PlayerView;
      setSnapshot(data.snapshot);
      setError(null);
      setLoaded(true);
    } catch (err) {
      setError((err as Error).message);
      setLoaded(true);
    }
  }, []);

  const send = useCallback(
    (cmd: PlayerCommand) =>
      new Promise<PlayerData | undefined>((resolve) => {
        startTransition(async () => {
          try {
            const res = await fetch("/api/player", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cmd),
            });
            const data = (await res.json()) as PlayerView & { error?: string };
            if (!res.ok) throw new Error(data.error ?? `Command failed (${res.status})`);
            setSnapshot(data.snapshot);
            setError(null);
            setNotice(data.data?.notice ?? data.data?.connection?.message ?? null);
            resolve(data.data);
          } catch (err) {
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

  const np = snapshot.nowPlaying;
  const playing = np.state === "Playing";
  const progress =
    np.duration > 0 ? Math.min(100, Math.max(0, (np.position / np.duration) * 100)) : 0;
  const quality = formatQuality(np);
  const modeLabel =
    snapshot.mode === "daemon" ? "Connected" : snapshot.mode === "disconnected" ? "Daemon unreachable" : "Demo mode";

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:gap-5 sm:px-6 sm:pb-10 sm:pt-6">
      <header className="relative z-10 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-3xl leading-none tracking-[-0.04em] text-[var(--ferro-cyan)] sm:text-5xl">
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

      <nav className="relative z-10 -mx-3 flex gap-1 overflow-x-auto border-b border-white/10 px-3 pb-2 sm:mx-0 sm:px-0">
        {PAGES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setPage(name)}
            className={cn(
              "min-h-11 shrink-0 rounded-md px-3 py-2 text-sm sm:min-h-0 sm:py-1.5",
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

      <section className="ferro-panel sticky top-[env(safe-area-inset-top,0px)] z-30 space-y-2 bg-[#07131c]/95 p-3 sm:top-3 sm:space-y-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0 sm:flex-1">
            <p className="hidden text-[10px] uppercase tracking-[0.2em] text-[var(--ferro-muted)] sm:block">Now playing</p>
            <p className="truncate font-display text-lg tracking-[-0.03em] sm:text-2xl">
              {np.song?.title ?? (loaded ? "Nothing queued" : "Connecting…")}
            </p>
            <p className="truncate text-sm text-[var(--ferro-cyan)]">
              {np.song?.artist ?? "—"}
              {np.song?.album ? <span className="text-[var(--ferro-muted)]"> · {np.song.album}</span> : null}
            </p>
            {quality ? <p className="truncate font-mono text-xs text-[var(--ferro-yellow)]/90">{quality}</p> : null}
          </div>
          <div className="flex items-center justify-between gap-1 sm:justify-end sm:gap-2">
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
          </div>
        </div>
        <Slider
          value={[progress]}
          max={100}
          step={0.1}
          disabled={!np.song || np.duration <= 0}
          onValueCommitted={(value) => {
            const pct = Array.isArray(value) ? Number(value[0]) : Number(value);
            void send({ type: "Seek", seconds: (pct / 100) * np.duration });
          }}
          aria-label="Seek"
        />
        <div className="flex items-center gap-3">
          <span className="w-12 font-mono text-[10px] text-[var(--ferro-muted)]">{formatTime(np.position)}</span>
          <Volume2 className="size-4 shrink-0 text-[var(--ferro-muted)]" aria-hidden />
          <Slider
            value={[snapshot.volume]}
            max={100}
            step={1}
            onValueCommitted={(value) => {
              const volume = Array.isArray(value) ? Number(value[0]) : Number(value);
              void send({ type: "SetVolume", volume });
            }}
            aria-label="Volume"
            className="flex-1"
          />
          <span className="w-10 text-right font-mono text-[10px] text-[var(--ferro-muted)]">{snapshot.volume}%</span>
          <span className="font-mono text-[10px] text-[var(--ferro-muted)]">{formatTime(np.duration)}</span>
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
