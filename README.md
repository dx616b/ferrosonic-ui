# Ferrosonic Web Control

Browser UI for managing a [ferrosonic-ng](https://github.com/dx616b/ferrosonic-ng) player daemon: transport, volume, seek, queue, repeat, and connection status.

Ferrosonic itself is a Rust Subsonic TUI/daemon. This app talks to `ferrosonicd` over its Unix-socket IPC (`u32` LE length-prefixed JSON frames). When no daemon socket is available, it runs a full interactive **demo mode** so the UI stays usable.

## Run locally

```bash
npm install
npm run dev -- --port 4317 --hostname 127.0.0.1
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

### Live daemon

Point the Next.js server at your ferrosonic socket:

```bash
export FERROSONIC_SOCK="$XDG_RUNTIME_DIR/ferrosonic/ferrosonicd.sock"
# or: /tmp/ferrosonic-$(id -u)/ferrosonicd.sock
npm run dev -- --port 4317 --hostname 127.0.0.1
```

Force modes:

- `FERROSONIC_FORCE_DEMO=1` — always use the in-process demo player
- `FERROSONIC_FORCE_DAEMON=1` — always attempt the Unix socket

## What the UI controls

| Control | Daemon request |
|---|---|
| Play / Pause | `TogglePause` |
| Stop | `Stop` |
| Next / Previous | `Next` / `Previous` |
| Seek | `Seek` |
| Volume | `SetVolume` |
| Repeat cycle | `SetRepeatMode` |
| Play queue row | `PlayQueueIndex` |
| Remove from queue | `RemoveFromQueue` |
| Shuffle queue | `ShuffleQueue` |
| Clear played history | `ClearQueueHistory` |

Status polling uses `Snapshot` against the daemon when connected.

## Upstream reference

Slim IPC sources from ferrosonic-ng live under [`reference/ferrosonic-ng`](./reference/ferrosonic-ng). Full player:

```bash
git clone https://github.com/dx616b/ferrosonic-ng.git
```

## Stack

Next.js, TypeScript, Tailwind CSS, shadcn/ui. Design language follows Ferrosonic’s default cyan/yellow-on-dark terminal look.
