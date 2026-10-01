"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Shuffle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SongList } from "@/components/song-list";
import type { PlayerCommand, PlayerData, PlayerSnapshot } from "@/lib/ferrosonic/types";

export function QueuePage({
  snapshot,
  busy,
  send,
}: {
  snapshot: PlayerSnapshot;
  busy: boolean;
  send: (cmd: PlayerCommand) => Promise<PlayerData | undefined>;
}) {
  const [name, setName] = useState("");
  const current = snapshot.queuePosition;

  return (
    <section className="ferro-panel p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl tracking-[-0.02em]">Queue ({snapshot.queue.length})</h2>
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" disabled={busy || snapshot.queue.length < 2} onClick={() => void send({ type: "ShuffleQueue" })}>
            <Shuffle className="size-3.5" /> Shuffle
          </Button>
          <Button variant="ghost" size="sm" disabled={busy || !current} onClick={() => void send({ type: "ClearQueueHistory" })}>
            <Trash2 className="size-3.5" /> Clear history
          </Button>
          <Button variant="ghost" size="sm" disabled={busy || snapshot.queue.length === 0} onClick={() => void send({ type: "ClearQueue" })}>
            Clear
          </Button>
        </div>
      </div>
      <SongList
        songs={snapshot.queue}
        empty="Queue is empty. Add songs from Library, Quick Play, or Playlists."
        currentId={current == null ? null : snapshot.queue[current]?.id}
        onPlay={(index) => void send({ type: "PlayQueueIndex", index })}
        onRemove={(index) => void send({ type: "RemoveFromQueue", index })}
      />
      {snapshot.queue.length > 1 && current != null ? (
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy || current <= 0}
            onClick={() => void send({ type: "MoveQueueItem", from: current, to: current - 1 })}
          >
            <ArrowUp className="size-3.5" /> Move current up
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || current >= snapshot.queue.length - 1}
            onClick={() => void send({ type: "MoveQueueItem", from: current, to: current + 1 })}
          >
            <ArrowDown className="size-3.5" /> Move current down
          </Button>
        </div>
      ) : null}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          void send({ type: "CreatePlaylist", name: trimmed, songIds: snapshot.queue.map((song) => song.id) });
          setName("");
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Save queue as playlist"
          className="h-9 min-w-0 flex-1 rounded-md border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-[var(--ferro-cyan)]"
        />
        <Button type="submit" variant="outline" size="sm" disabled={busy || snapshot.queue.length === 0 || name.trim().length === 0}>
          Save
        </Button>
      </form>
    </section>
  );
}
