"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SongList } from "@/components/song-list";
import type { PlayerCommand, PlayerData, PlayerSnapshot, Track } from "@/lib/ferrosonic/types";
import { cn } from "@/lib/utils";

export function PlaylistsPage({
  snapshot,
  busy,
  send,
}: {
  snapshot: PlayerSnapshot;
  busy: boolean;
  send: (cmd: PlayerCommand) => Promise<PlayerData | undefined>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [songs, setSongs] = useState<Track[]>([]);
  const [rename, setRename] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const playlists = snapshot.library.playlists;
  const current = playlists.find((playlist) => playlist.id === selected) ?? null;

  async function open(id: string) {
    setSelected(id);
    setConfirmDelete(false);
    const playlist = playlists.find((item) => item.id === id);
    setRename(playlist?.name ?? "");
    const data = await send({ type: "LoadPlaylist", id });
    setSongs(data?.songs ?? []);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <section className={cn("ferro-panel p-4", selected && "max-lg:hidden")}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg">Playlists</h2>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void send({ type: "RefreshPlaylists" })}>
            Refresh
          </Button>
        </div>
        <ul className="flex flex-col gap-1">
          {playlists.length === 0 ? <li className="text-sm text-[var(--ferro-muted)]">No playlists.</li> : null}
          {playlists.map((playlist) => (
            <li key={playlist.id}>
              <button
                type="button"
                onClick={() => void open(playlist.id)}
                className={cn(
                  "w-full rounded-md px-2.5 py-3 text-left hover:bg-white/5 sm:py-2",
                  selected === playlist.id && "bg-[var(--ferro-cyan)]/15 text-[var(--ferro-cyan)]",
                )}
              >
                <span className="block truncate text-sm">{playlist.name}</span>
                <span className="block text-xs text-[var(--ferro-muted)]">
                  {playlist.songCount} songs{playlist.owner ? ` · ${playlist.owner}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className={cn("ferro-panel p-4", !selected && "max-lg:hidden")}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="shrink-0 rounded-md px-2 py-2 text-sm text-[var(--ferro-cyan)] lg:hidden"
              onClick={() => {
                setSelected(null);
                setSongs([]);
              }}
            >
              Playlists
            </button>
            <h2 className="truncate font-display text-xl">{current?.name ?? "Songs"}</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || songs.length === 0}
            onClick={() => void send({ type: "Enqueue", songs, mode: { kind: "replace", playFrom: 0 } })}
          >
            Play
          </Button>
        </div>
        <SongList
          songs={songs}
          empty="Select a playlist."
          currentId={snapshot.nowPlaying.song?.id}
          onPlay={(index) => void send({ type: "Enqueue", songs, mode: { kind: "replace", playFrom: index } })}
          onAppend={(track) => void send({ type: "Enqueue", songs: [track], mode: { kind: "append" } })}
          onRemove={
            current
              ? (index) => {
                  void send({ type: "RemovePlaylistSong", playlistId: current.id, index }).then(() => open(current.id));
                }
              : undefined
          }
        />
        {current ? (
          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const next = rename.trim();
                if (!next) return;
                void send({ type: "RenamePlaylist", id: current.id, name: next });
              }}
            >
              <input
                value={rename}
                onChange={(event) => setRename(event.target.value)}
                className="h-11 min-w-0 flex-1 rounded-md border border-white/10 bg-black/20 px-3 text-base outline-none focus:border-[var(--ferro-cyan)]"
              />
              <Button type="submit" variant="outline" size="sm" disabled={busy}>
                Rename
              </Button>
            </form>
            {confirmDelete ? (
              <div className="flex gap-2 text-sm">
                <span className="text-[var(--ferro-warn)]">Delete {current.name}?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    void send({ type: "DeletePlaylist", id: current.id });
                    setSelected(null);
                    setSongs([]);
                    setConfirmDelete(false);
                  }}
                >
                  Delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                Delete playlist
              </Button>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
