"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { SongList } from "@/components/song-list";
import type { AlbumItem, ArtistItem, PlayerCommand, PlayerData, PlayerSnapshot, Track } from "@/lib/ferrosonic/types";
import { cn } from "@/lib/utils";

export function LibraryPage({
  snapshot,
  busy,
  send,
}: {
  snapshot: PlayerSnapshot;
  busy: boolean;
  send: (cmd: PlayerCommand) => Promise<PlayerData | undefined>;
}) {
  const [query, setQuery] = useState("");
  const [artistId, setArtistId] = useState<string | null>(null);
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [songs, setSongs] = useState<Track[]>([]);
  const [hits, setHits] = useState<PlayerData["search"]>();

  const artists = snapshot.library.artists;

  async function openArtist(artist: ArtistItem) {
    setHits(undefined);
    setArtistId(artist.id);
    setAlbumId(null);
    setSongs([]);
    const data = await send({ type: "LoadArtist", id: artist.id });
    setAlbums(data?.albums ?? []);
  }

  async function openAlbum(album: AlbumItem) {
    setAlbumId(album.id);
    const data = await send({ type: "LoadAlbum", id: album.id });
    setSongs(data?.songs ?? []);
  }

  async function search() {
    const data = await send({ type: "Search", query });
    setHits(data?.search ?? { artists: [], albums: [], songs: [] });
    setArtistId(null);
    setAlbumId(null);
  }

  function playSongs(list: Track[], index: number) {
    void send({ type: "Enqueue", songs: list, mode: { kind: "replace", playFrom: index } });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void search();
          }}
          placeholder="Search artists, albums, songs"
          className="h-9 min-w-0 flex-1 rounded-md border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-[var(--ferro-cyan)]"
        />
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void search()}>
          Search
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void send({ type: "ShuffleLibrary" })}>
          Shuffle library
        </Button>
        {snapshot.library.folders.length > 0 ? (
          <select
            className="h-9 rounded-md border border-white/10 bg-black/20 px-2 text-sm"
            value={snapshot.settings.musicFolderId ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              void send({ type: "SetMusicFolder", id: value === "" ? null : Number(value) });
            }}
          >
            <option value="">All libraries</option>
            {snapshot.library.folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {hits ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Column title="Artists">
            <NameList
              rows={hits.artists.map((artist) => ({ id: artist.id, label: artist.name, detail: artist.albumCount != null ? `${artist.albumCount} albums` : undefined }))}
              selected={artistId}
              onPick={(id) => {
                const artist = hits.artists.find((item) => item.id === id);
                if (artist) void openArtist(artist);
              }}
            />
          </Column>
          <Column title="Albums">
            <NameList
              rows={hits.albums.map((album) => ({ id: album.id, label: album.name, detail: album.artist }))}
              selected={albumId}
              onPick={(id) => {
                const album = hits.albums.find((item) => item.id === id);
                if (album) void openAlbum(album);
              }}
            />
          </Column>
          <Column title="Songs">
            <SongList
              songs={hits.songs}
              empty="No matching songs."
              onPlay={(index) => {
                const song = hits.songs[index];
                if (song) playSongs([song], 0);
              }}
              onAppend={(track) => void send({ type: "Enqueue", songs: [track], mode: { kind: "append" } })}
              onStar={(track) => void send({ type: "ToggleStar", id: track.id })}
            />
          </Column>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[0.8fr_0.8fr_1.2fr]">
          <Column title="Artists">
            <NameList
              rows={artists.map((artist) => ({
                id: artist.id,
                label: artist.name,
                detail: artist.albumCount != null ? `${artist.albumCount} albums` : undefined,
              }))}
              selected={artistId}
              onPick={(id) => {
                const artist = artists.find((item) => item.id === id);
                if (artist) void openArtist(artist);
              }}
            />
          </Column>
          <Column title="Albums">
            <NameList
              rows={albums.map((album) => ({
                id: album.id,
                label: album.name,
                detail: [album.year, album.songCount != null ? `${album.songCount} songs` : undefined].filter(Boolean).join(" · "),
              }))}
              selected={albumId}
              onPick={(id) => {
                const album = albums.find((item) => item.id === id);
                if (album) void openAlbum(album);
              }}
            />
          </Column>
          <Column title="Songs">
            <SongList
              songs={songs}
              empty="Open an album to see its tracks."
              albumNumbers
              currentId={snapshot.nowPlaying.song?.id}
              onPlay={(index) => playSongs(songs, index)}
              onAppend={(track) => void send({ type: "Enqueue", songs: [track], mode: { kind: "append" } })}
              onStar={(track) => void send({ type: "ToggleStar", id: track.id })}
            />
          </Column>
        </div>
      )}
    </div>
  );
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ferro-panel p-4">
      <h2 className="mb-3 font-display text-lg tracking-[-0.02em]">{title}</h2>
      {children}
    </section>
  );
}

function NameList({
  rows,
  selected,
  onPick,
}: {
  rows: { id: string; label: string; detail?: string }[];
  selected: string | null;
  onPick: (id: string) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-[var(--ferro-muted)]">Nothing here.</p>;
  return (
    <ul className="flex max-h-[32rem] flex-col gap-1 overflow-y-auto">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => onPick(row.id)}
            className={cn(
              "w-full rounded-md px-2.5 py-2 text-left hover:bg-white/5",
              selected === row.id && "bg-[var(--ferro-cyan)]/15 text-[var(--ferro-cyan)]",
            )}
          >
            <span className="block truncate text-sm">{row.label}</span>
            {row.detail ? <span className="block truncate text-xs text-[var(--ferro-muted)]">{row.detail}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
