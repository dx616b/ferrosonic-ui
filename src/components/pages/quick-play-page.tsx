"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SongList } from "@/components/song-list";
import type { PlayerCommand, PlayerData, PlayerSnapshot, Track } from "@/lib/ferrosonic/types";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { id: "starred", label: "Starred" },
  { id: "random", label: "Random" },
  { id: "radio", label: "Radio" },
] as const;

type OptionId = (typeof OPTIONS)[number]["id"];

export function QuickPlayPage({
  snapshot,
  busy,
  send,
}: {
  snapshot: PlayerSnapshot;
  busy: boolean;
  send: (cmd: PlayerCommand) => Promise<PlayerData | undefined>;
}) {
  const [option, setOption] = useState<OptionId>("starred");
  const songs: Track[] =
    option === "starred" ? snapshot.library.starred : option === "random" ? snapshot.library.random : snapshot.library.radio;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(9rem,14rem)_minmax(0,1fr)]">
      <section className="ferro-panel flex gap-1 p-2 md:flex-col md:p-3">
        <h2 className="mb-2 hidden px-2 font-display text-lg md:block">Song Options</h2>
        <ul className="flex w-full gap-1 md:flex-col">
          {OPTIONS.map((item) => (
            <li key={item.id} className="flex-1">
              <button
                type="button"
                onClick={() => setOption(item.id)}
                className={cn(
                  "w-full rounded-md px-3 py-3 text-center text-sm hover:bg-white/5 md:py-2 md:text-left",
                  option === item.id && "bg-[var(--ferro-cyan)]/15 text-[var(--ferro-cyan)]",
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="ferro-panel p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl">{OPTIONS.find((item) => item.id === option)?.label}</h2>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              void send(
                option === "starred"
                  ? { type: "RefreshStarred" }
                  : option === "random"
                    ? { type: "RefreshRandom" }
                    : { type: "RefreshRadio" },
              )
            }
          >
            Refresh
          </Button>
        </div>
        <SongList
          songs={songs}
          empty="This list is empty."
          currentId={snapshot.nowPlaying.song?.id}
          onPlay={(index) => void send({ type: "Enqueue", songs, mode: { kind: "replace", playFrom: index } })}
          onAppend={(track) => void send({ type: "Enqueue", songs: [track], mode: { kind: "append" } })}
          onStar={option === "radio" ? undefined : (track) => void send({ type: "ToggleStar", id: track.id })}
        />
      </section>
    </div>
  );
}
