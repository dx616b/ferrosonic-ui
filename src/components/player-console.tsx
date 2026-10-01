"use client";

import {
  ListMusic,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatQuality, formatTime } from "@/lib/ferrosonic/format";
import type { PlayerCommand, PlayerSnapshot } from "@/lib/ferrosonic/types";
import { cn } from "@/lib/utils";

const EMPTY: PlayerSnapshot = {
  mode: "demo",
  volume: 0,
  repeatMode: "Off",
  queue: [],
  queuePosition: null,
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
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/player", { cache: "no-store" });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = (await res.json()) as PlayerSnapshot;
      setSnapshot(data);
      setError(null);
      setLoaded(true);
    } catch (err) {
      setError((err as Error).message);
      setLoaded(true);
    }
  }, []);

  const send = useCallback(
    (cmd: PlayerCommand) => {
      startTransition(async () => {
        try {
          const res = await fetch("/api/player", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cmd),
          });
          if (!res.ok) throw new Error(`Command failed (${res.status})`);
          const data = (await res.json()) as PlayerSnapshot;
          setSnapshot(data);
          setError(null);
        } catch (err) {
          setError((err as Error).message);
        }
      });
    },
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
    snapshot.mode === "daemon"
      ? "Connected"
      : snapshot.mode === "disconnected"
        ? "Daemon unreachable"
        : "Demo mode";

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
      <header className="relative z-10 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-[clamp(2.4rem,8vw,4.6rem)] leading-[0.9] tracking-[-0.04em] text-[var(--ferro-cyan)]">
              Ferrosonic
            </p>
            <p className="mt-3 max-w-xl text-sm text-[var(--ferro-muted)] sm:text-base">
              Bit-perfect Subsonic control from the browser — transport, volume,
              queue, and daemon status against ferrosonic-ng.
            </p>
          </div>
          <div
            className={cn(
              "mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs tracking-wide",
              snapshot.mode === "daemon"
                ? "border-[var(--ferro-cyan)]/40 text-[var(--ferro-cyan)]"
                : snapshot.mode === "disconnected"
                  ? "border-[var(--ferro-warn)]/50 text-[var(--ferro-warn)]"
                  : "border-[var(--ferro-yellow)]/40 text-[var(--ferro-yellow)]",
            )}
          >
            {snapshot.mode === "daemon" ? (
              <Wifi className="size-3.5" aria-hidden />
            ) : (
              <WifiOff className="size-3.5" aria-hidden />
            )}
            {modeLabel}
          </div>
        </div>
        {(snapshot.message || error) && (
          <p className="text-sm text-[var(--ferro-muted)]" role="status">
            {error ?? snapshot.message}
          </p>
        )}
      </header>

      <section className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="ferro-panel animate-rise space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--ferro-muted)]">
              Now playing
            </p>
            <h1 className="font-display text-3xl leading-tight tracking-[-0.03em] text-[var(--ferro-text)] sm:text-4xl">
              {np.song?.title ?? (loaded ? "Nothing queued" : "Connecting…")}
            </h1>
            <p className="text-base text-[var(--ferro-cyan)]">
              {np.song?.artist ?? "—"}
              {np.song?.album ? (
                <span className="text-[var(--ferro-muted)]"> · {np.song.album}</span>
              ) : null}
            </p>
            {quality ? (
              <p className="font-mono text-xs text-[var(--ferro-yellow)]/90">{quality}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Slider
              value={[progress]}
              max={100}
              step={0.1}
              disabled={!np.song || np.duration <= 0}
              onValueCommitted={(value) => {
                const pct = Array.isArray(value) ? Number(value[0]) : Number(value);
                const seconds = (pct / 100) * np.duration;
                send({ type: "Seek", seconds });
              }}
              aria-label="Seek"
              className="py-2"
            />
            <div className="flex justify-between font-mono text-xs text-[var(--ferro-muted)]">
              <span>{formatTime(np.position)}</span>
              <span>{formatTime(np.duration)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="Previous track"
              onClick={() => send({ type: "Previous" })}
              disabled={pending}
            >
              <SkipBack />
            </Button>
            <Button
              size="icon-lg"
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => send({ type: "TogglePause" })}
              disabled={pending || !np.song}
              className="size-12 bg-[var(--ferro-cyan)] text-[var(--ferro-ink)] hover:bg-[var(--ferro-cyan)]/85"
            >
              {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
            </Button>
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="Stop"
              onClick={() => send({ type: "Stop" })}
              disabled={pending}
            >
              <Square />
            </Button>
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="Next track"
              onClick={() => send({ type: "Next" })}
              disabled={pending}
            >
              <SkipForward />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Cycle repeat mode"
              onClick={() => send({ type: "CycleRepeat" })}
              disabled={pending}
              className="ml-1 gap-2 text-[var(--ferro-muted)]"
            >
              <Repeat className="size-4" />
              Repeat {snapshot.repeatMode}
            </Button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Volume2 className="size-4 shrink-0 text-[var(--ferro-muted)]" aria-hidden />
            <Slider
              value={[snapshot.volume]}
              max={100}
              step={1}
              onValueCommitted={(value) => {
                const volume = Array.isArray(value) ? Number(value[0]) : Number(value);
                send({ type: "SetVolume", volume });
              }}
              aria-label="Volume"
              className="flex-1"
            />
            <span className="w-10 text-right font-mono text-xs text-[var(--ferro-muted)]">
              {snapshot.volume}%
            </span>
          </div>
        </div>

        <aside className="ferro-panel animate-rise-delay flex flex-col p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[var(--ferro-text)]">
              <ListMusic className="size-4 text-[var(--ferro-cyan)]" aria-hidden />
              <h2 className="font-display text-xl tracking-[-0.02em]">Queue</h2>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Shuffle queue"
                onClick={() => send({ type: "ShuffleQueue" })}
                disabled={pending || snapshot.queue.length < 2}
              >
                <Shuffle className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Clear played history"
                onClick={() => send({ type: "ClearQueueHistory" })}
                disabled={pending || !snapshot.queuePosition}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>

          {snapshot.queue.length === 0 ? (
            <p className="text-sm text-[var(--ferro-muted)]">
              Queue is empty. Add tracks from the Ferrosonic TUI or enqueue via
              the daemon IPC.
            </p>
          ) : (
            <ul className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto pr-1">
              {snapshot.queue.map((track, index) => {
                const isCurrent = snapshot.queuePosition === index;
                const isPlayed =
                  snapshot.queuePosition != null && index < snapshot.queuePosition;
                return (
                  <li key={`${track.id}-${index}`}>
                    <button
                      type="button"
                      onClick={() => send({ type: "PlayQueueIndex", index })}
                      className={cn(
                        "group flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                        isCurrent
                          ? "bg-[var(--ferro-cyan)]/15 text-[var(--ferro-yellow)]"
                          : "hover:bg-white/5",
                        isPlayed && !isCurrent && "text-[var(--ferro-muted)]",
                      )}
                    >
                      <span className="w-5 shrink-0 pt-0.5 font-mono text-[10px] text-[var(--ferro-muted)]">
                        {isCurrent ? "▶" : index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{track.title}</span>
                        <span className="block truncate text-xs text-[var(--ferro-muted)]">
                          {track.artist ?? "Unknown artist"}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-[var(--ferro-muted)]">
                        {formatTime(track.duration ?? 0)}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Remove ${track.title}`}
                        className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          send({ type: "RemoveFromQueue", index });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            send({ type: "RemoveFromQueue", index });
                          }
                        }}
                      >
                        <Trash2 className="size-3.5 text-[var(--ferro-muted)]" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </section>

      <footer className="relative z-10 flex flex-col gap-1 border-t border-white/10 pt-6 text-xs text-[var(--ferro-muted)] sm:flex-row sm:items-center sm:justify-between">
        <span>{snapshot.serverLabel ?? "Ferrosonic"}</span>
        <span className="font-mono">
          {snapshot.socketPath
            ? `socket ${snapshot.socketPath}`
            : "IPC: demo (set FERROSONIC_SOCK for live daemon)"}
        </span>
      </footer>
    </div>
  );
}
