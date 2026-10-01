"use client";

import { Button } from "@/components/ui/button";
import type { PlayerCommand, PlayerData, PlayerSnapshot, RepeatMode } from "@/lib/ferrosonic/types";
import { THEME_NAMES } from "@/lib/ferrosonic/types";

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
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="ferro-panel space-y-3 p-5">
        <h2 className="font-display text-lg text-[var(--ferro-cyan)]">Display</h2>
        <label className="flex items-center justify-between gap-3 text-sm">
          Theme
          <select
            className="h-9 rounded-md border border-white/10 bg-black/20 px-2"
            value={THEME_NAMES.includes(settings.theme as (typeof THEME_NAMES)[number]) ? settings.theme : "Default"}
            disabled={busy}
            onChange={(event) => void send({ type: "SetTheme", name: event.target.value })}
          >
            {!THEME_NAMES.includes(settings.theme as (typeof THEME_NAMES)[number]) && settings.theme ? (
              <option value={settings.theme}>{settings.theme}</option>
            ) : null}
            {THEME_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-[var(--ferro-muted)]">Theme, cava, and cover art apply to the terminal UI.</p>
      </section>

      <section className="ferro-panel space-y-3 p-5">
        <h2 className="font-display text-lg text-[var(--ferro-cyan)]">Now Playing</h2>
        <Toggle label="Cava visualizer" on={settings.cava} disabled={busy} onChange={(enabled) => void send({ type: "SetCava", enabled })} />
        <Step
          label="Cava size"
          value={`${settings.cavaSize}%`}
          disabled={busy}
          onDown={() => void send({ type: "SetCavaSize", size: Math.max(10, settings.cavaSize - 5) })}
          onUp={() => void send({ type: "SetCavaSize", size: Math.min(80, settings.cavaSize + 5) })}
        />
        <Toggle label="Cover art" on={settings.coverArt} disabled={busy} onChange={(enabled) => void send({ type: "SetCoverArt", enabled })} />
        <Step
          label="Cover art size"
          value={`${settings.coverArtSize} rows`}
          disabled={busy}
          onDown={() => void send({ type: "SetCoverArtSize", size: Math.max(8, settings.coverArtSize - 2) })}
          onUp={() => void send({ type: "SetCoverArtSize", size: Math.min(24, settings.coverArtSize + 2) })}
        />
      </section>

      <section className="ferro-panel space-y-3 p-5">
        <h2 className="font-display text-lg text-[var(--ferro-cyan)]">Playback</h2>
        <label className="flex items-center justify-between gap-3 text-sm">
          Repeat
          <select
            className="h-9 rounded-md border border-white/10 bg-black/20 px-2"
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

      <section className="ferro-panel space-y-3 p-5">
        <h2 className="font-display text-lg text-[var(--ferro-cyan)]">System</h2>
        <Toggle label="Daemon" on={settings.daemon} disabled={busy} onChange={(enabled) => void send({ type: "SetDaemonEnabled", enabled })} />
        <Toggle label="Notifications" on={settings.notifications} disabled={busy} onChange={(enabled) => void send({ type: "SetNotifications", enabled })} />
        <p className="text-xs text-[var(--ferro-muted)]">Daemon on or off takes effect the next time the terminal launches.</p>
      </section>
    </div>
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

function Step({
  label,
  value,
  disabled,
  onDown,
  onUp,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={disabled} onClick={onDown}>
          −
        </Button>
        <span className="w-16 text-center font-mono text-xs text-[var(--ferro-muted)]">{value}</span>
        <Button variant="outline" size="sm" disabled={disabled} onClick={onUp}>
          +
        </Button>
      </span>
    </div>
  );
}
