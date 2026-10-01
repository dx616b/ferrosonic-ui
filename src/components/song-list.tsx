"use client";

import { ListPlus, Star, Trash2 } from "lucide-react";

import { formatTime } from "@/lib/ferrosonic/format";
import type { Track } from "@/lib/ferrosonic/types";
import { cn } from "@/lib/utils";

export function SongList({
  songs,
  empty,
  currentId,
  currentIndex,
  albumNumbers,
  onPlay,
  onAppend,
  onStar,
  onRemove,
}: {
  songs: Track[];
  empty: string;
  currentId?: string | null;
  currentIndex?: number | null;
  albumNumbers?: boolean;
  onPlay: (index: number) => void;
  onAppend?: (track: Track) => void;
  onStar?: (track: Track) => void;
  onRemove?: (index: number) => void;
}) {
  if (songs.length === 0) {
    return <p className="text-sm text-[var(--ferro-muted)]">{empty}</p>;
  }

  return (
    <ul className="flex max-h-[32rem] flex-col gap-1 overflow-y-auto pr-1">
      {songs.map((track, index) => {
        const current =
          currentIndex != null ? index === currentIndex : currentId != null && track.id === currentId;
        const number = albumNumbers && track.track != null ? track.track : index + 1;
        return (
          <li key={`${track.id}-${index}`}>
            <div
              className={cn(
                "group flex w-full items-start gap-2 rounded-md px-2.5 py-2",
                current ? "bg-[var(--ferro-cyan)]/15 text-[var(--ferro-yellow)]" : "hover:bg-white/5",
              )}
            >
              <button type="button" onClick={() => onPlay(index)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                <span className="w-8 shrink-0 pt-0.5 text-right font-mono text-[10px] tabular-nums text-[var(--ferro-muted)]">
                  {current ? "▶" : number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {track.starred ? "★ " : ""}
                    {track.title}
                  </span>
                  <span className="block truncate text-xs text-[var(--ferro-muted)]">
                    {track.artist ?? "Unknown artist"}
                    {track.album ? ` · ${track.album}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[10px] text-[var(--ferro-muted)]">
                  {track.duration ? formatTime(track.duration) : ""}
                </span>
              </button>
              {onAppend ? (
                <button type="button" aria-label={`Queue ${track.title}`} className="rounded p-1 opacity-0 hover:bg-white/10 group-hover:opacity-100" onClick={() => onAppend(track)}>
                  <ListPlus className="size-3.5 text-[var(--ferro-muted)]" />
                </button>
              ) : null}
              {onStar ? (
                <button type="button" aria-label={`Star ${track.title}`} className="rounded p-1 opacity-0 hover:bg-white/10 group-hover:opacity-100" onClick={() => onStar(track)}>
                  <Star className={cn("size-3.5", track.starred ? "text-[var(--ferro-yellow)]" : "text-[var(--ferro-muted)]")} />
                </button>
              ) : null}
              {onRemove ? (
                <button type="button" aria-label={`Remove ${track.title}`} className="rounded p-1 opacity-0 hover:bg-white/10 group-hover:opacity-100" onClick={() => onRemove(index)}>
                  <Trash2 className="size-3.5 text-[var(--ferro-muted)]" />
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
