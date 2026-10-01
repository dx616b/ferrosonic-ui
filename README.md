# Ferrosonic Web Control

Browser UI for managing a [ferrosonic-ng](https://github.com/dx616b/ferrosonic-ng) player daemon: transport, volume, seek, queue, repeat, and connection status.

Ferrosonic itself is a Rust Subsonic TUI/daemon. This app talks to `ferrosonicd` over its Unix-socket IPC (`u32` LE length-prefixed JSON frames). When no daemon socket is available, it runs a full interactive **demo mode** so the UI stays usable.

## Install

Ships as one executable, the same way Ferrosonic does. The machine that runs it does not need Node.js.

```bash
curl -sSf https://raw.githubusercontent.com/dx616b/ferrosonic-ui/main/install.sh | sh
ferrosonic-ui
```

The install provides both commands from one binary:

```bash
ferrosonic                  # terminal UI
ferrosonic --daemon         # player daemon and web UI on http://127.0.0.1:4317
ferrosonic --daemon --no-ui # player daemon only
ferrosonic -c FILE -v       # same terminal flags as Ferrosonic
ferrosonic-ui               # web UI in the foreground
```

`--hostname` and `--port` choose where the page listens (`FERROSONIC_UI_HOST`, `FERROSONIC_UI_PORT`). Audio still needs `mpv`.

A user service that keeps the terminal closed and serves the page with the player:

```bash
mkdir -p ~/.config/systemd/user
cp contrib/ferrosonic-ui.service ~/.config/systemd/user/
systemctl --user enable --now ferrosonic-ui.service
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

The same pages as the terminal: Library, Queue, Quick Play, Playlists, Server, and Settings. Transport stays pinned at the bottom. Library search, enqueue, stars, playlist edit, server credentials, and the terminal settings (theme, cava, cover art, repeat, scrobble, notifications, daemon) go through the daemon IPC. Cava and cover art still render in the terminal; the web page only changes those settings.

## Upstream reference

Slim IPC sources from ferrosonic-ng live under [`reference/ferrosonic-ng`](./reference/ferrosonic-ng). Full player:

```bash
git clone https://github.com/dx616b/ferrosonic-ng.git
```

## Stack

Next.js, TypeScript, Tailwind CSS, shadcn/ui. Design language follows Ferrosonic’s default cyan/yellow-on-dark terminal look.
