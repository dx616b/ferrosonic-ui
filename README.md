# Ferrosonic Web Control

Browser UI for managing a [ferrosonic-ng](https://github.com/dx616b/ferrosonic-ng) player daemon: transport, volume, seek, queue, repeat, and connection status.

Ferrosonic itself is a Rust Subsonic TUI/daemon. This app talks to `ferrosonicd` over its Unix-socket IPC (`u32` LE length-prefixed JSON frames). When no daemon socket is available, it runs a full interactive **demo mode** so the UI stays usable.

## Install

Ships as one executable, the same way Ferrosonic does. The machine that runs it does not need Node.js.

```bash
curl -sSf https://cdn.jsdelivr.net/gh/dx616b/ferrosonic-ui@main/install.sh | sh
```

That installs the binary, links `ferrosonic`, and enables a user service that keeps the player and page on port 4317. Open http://127.0.0.1:4317/ after install.

The install provides both commands from one binary:

```bash
ferrosonic                  # terminal UI
ferrosonic --daemon         # player daemon and web UI on port 4317, all interfaces
ferrosonic --daemon --no-ui # player daemon only
ferrosonic -c FILE -v       # same terminal flags as Ferrosonic
ferrosonic-ui               # web UI in the foreground
```

`--hostname` and `--port` choose where the page listens (`FERROSONIC_UI_HOST`, `FERROSONIC_UI_PORT`). Audio still needs `mpv`.

Restart or stop the background service:

```bash
systemctl --user restart ferrosonic-ui.service
systemctl --user stop ferrosonic-ui.service
```

Build the binary yourself (needs Node.js and [Bun](https://bun.sh)):

```bash
npm install
npm run build:exe
./dist/ferrosonic-ui
```

### Develop

```bash
npm install
npm run dev -- --port 4317 --hostname 127.0.0.1
```

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

Library, Queue, Quick Play, Playlists, Server, and Settings. The player bar stays pinned while the page scrolls. Library search, enqueue, stars, playlist edit, server credentials, repeat, auto-continue, and scrobble go through the daemon IPC. Theme, cava, cover art, and desktop notifications stay on the terminal.

## Upstream reference

Slim IPC sources from ferrosonic-ng live under [`reference/ferrosonic-ng`](./reference/ferrosonic-ng). Full player:

```bash
git clone https://github.com/dx616b/ferrosonic-ng.git
```

## Stack

Next.js, TypeScript, and Tailwind CSS. The look follows Ferrosonic’s cyan/yellow-on-dark terminal.
