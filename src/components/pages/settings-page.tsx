"use client";

import { Button } from "@/components/ui/button";
import type { PlayerCommand, PlayerData, PlayerSnapshot, RepeatMode } from "@/lib/ferrosonic/types";

export function SettingsPage({
  snapshot,
  busy,
  send,
}: {
  snapshot: PlayerSnapshot;
  busy: boolean;
  send: (cmd: PlayerCommand) => Promise<PlayerData | undefined>;
}) {
  const settings = snapshot.settings;
  const repeat: RepeatMode[] = ["Off", "One", "All"];

  return (
    <section className="ferro-panel max-w-xl space-y-3 p-5">
      <h2 className="font-display text-lg text-[var(--ferro-cyan)]">Playback</h2>
      <label className="flex items-center justify-between gap-3 text-sm">
        Repeat
        <select
            className="h-11 rounded-md border border-white/10 bg-black/20 px-2 text-base"
          value={snapshot.repeatMode}
          disabled={busy}
          onChange={(event) => void send({ type: "SetRepeatMode", mode: event.target.value as RepeatMode })}
        >
          {repeat.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </label>
      <Toggle label="Auto-continue" on={settings.autoContinue} disabled={busy} onChange={(enabled) => void send({ type: "SetAutoContinue", enabled })} />
      <Toggle label="Scrobble" on={settings.scrobble} disabled={busy} onChange={(enabled) => void send({ type: "SetScrobble", enabled })} />
    </section>
  );
}

function Toggle({
  label,
  on,
  disabled,
  onChange,
}: {
  label: string;
  on: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <Button variant={on ? "default" : "outline"} size="sm" disabled={disabled} onClick={() => onChange(!on)}>
        {on ? "On" : "Off"}
      </Button>
    </div>
  );
}
