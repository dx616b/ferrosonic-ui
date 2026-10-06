"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PlayerCommand, PlayerData, PlayerSnapshot } from "@/lib/ferrosonic/types";

export function ServerPage({
  snapshot,
  busy,
  send,
}: {
  snapshot: PlayerSnapshot;
  busy: boolean;
  send: (cmd: PlayerCommand) => Promise<PlayerData | undefined>;
}) {
  const [baseUrl, setBaseUrl] = useState(snapshot.settings.baseUrl);
  const [username, setUsername] = useState(snapshot.settings.username);
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    setBaseUrl(snapshot.settings.baseUrl);
    setUsername(snapshot.settings.username);
  }, [snapshot.settings.baseUrl, snapshot.settings.username]);

  async function submit(kind: "test" | "save") {
    if (!password && !snapshot.settings.passwordSet) {
      setResult("Password is required.");
      return;
    }
    const cmd: PlayerCommand =
      kind === "test"
        ? { type: "TestServer", baseUrl, username, password }
        : { type: "UpdateServer", baseUrl, username, password };
    const data = await send(cmd);
    setResult(data?.connection?.message ?? data?.notice ?? null);
    if (kind === "save") setPassword("");
  }

  return (
    <section className="ferro-panel max-w-xl space-y-4 p-5">
      <h2 className="font-display text-xl">Server Connection</h2>
      <Field label="Server URL" value={baseUrl} onChange={setBaseUrl} placeholder="https://music.example.com" />
      <Field label="Username" value={username} onChange={setUsername} />
      <Field
        label={snapshot.settings.passwordSet ? "Password (already stored — enter to replace)" : "Password"}
        value={password}
        onChange={setPassword}
        secret
      />
      <div className="flex gap-2">
        <Button variant="outline" disabled={busy} onClick={() => void submit("test")}>
          Test
        </Button>
        <Button disabled={busy} onClick={() => void submit("save")}>
          Save
        </Button>
      </div>
      {result ? <p className="text-sm text-[var(--ferro-muted)]">{result}</p> : null}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  secret,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  secret?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-[0.16em] text-[var(--ferro-muted)]">{label}</span>
      <input
        type={secret ? "password" : "text"}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-white/10 bg-black/20 px-3 text-base outline-none focus:border-[var(--ferro-cyan)]"
      />
    </label>
  );
}
