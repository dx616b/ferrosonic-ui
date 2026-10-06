#!/bin/sh
set -e

REPO="dx616b/ferrosonic-ui"
INSTALL_DIR="/usr/local/bin"
SERVICE_URL="https://raw.githubusercontent.com/$REPO/main/contrib/ferrosonic-ui.service"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_NAME="ferrosonic-ui.service"

echo "Ferrosonic UI installer"
echo "======================="

ARCH=$(uname -m)
case "$ARCH" in
  x86_64)
    ASSET_REGEX='ferrosonic-ui-[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*-linux-x86_64'
    ;;
  *)
    echo "No precompiled binary for $ARCH. Build from source:"
    echo "  npm install && npm run build:exe"
    exit 1
    ;;
esac

echo "Installing runtime dependencies..."
if command -v pacman >/dev/null 2>&1; then
  echo "Detected Arch Linux"
  sudo pacman -S --needed --noconfirm mpv pipewire wireplumber dbus
elif command -v dnf >/dev/null 2>&1; then
  echo "Detected Fedora"
  sudo dnf install -y mpv pipewire wireplumber dbus
elif command -v apt >/dev/null 2>&1; then
  echo "Detected Debian/Ubuntu"
  sudo apt-get update
  sudo apt-get install -y mpv pipewire wireplumber dbus
else
  echo "Unknown package manager. Install manually: mpv, pipewire, wireplumber, dbus"
  echo "Then re-run this script."
  exit 1
fi

if ! command -v mpv >/dev/null 2>&1; then
  echo "mpv is required for audio and was not found after install."
  exit 1
fi

systemctl --user enable --now pipewire.service pipewire.socket 2>/dev/null || true
systemctl --user enable --now wireplumber.service 2>/dev/null || true

echo "Querying latest release..."
API_LATEST="https://api.github.com/repos/$REPO/releases/latest"
if ! RELEASE_JSON=$(curl -fsSL "$API_LATEST"); then
  echo "Failed to query latest release metadata from GitHub."
  exit 1
fi

TUI_URL=$(printf '%s\n' "$RELEASE_JSON" \
  | grep '"browser_download_url"' \
  | sed -n "s#.*\"\(https://[^\"]*/$ASSET_REGEX\)\".*#\1#p" \
  | head -n1)

if [ -z "$TUI_URL" ]; then
  echo "No release asset matching '$ASSET_REGEX' was found."
  exit 1
fi

LATEST=$(printf '%s\n' "$TUI_URL" \
  | sed -n 's#.*/ferrosonic-ui-\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)-linux-x86_64$#\1#p')

echo "Downloading ferrosonic-ui $LATEST..."
TMP=$(mktemp)
if ! curl -fsSL "$TUI_URL" -o "$TMP"; then
  echo "Failed to download from: $TUI_URL"
  rm -f "$TMP"
  exit 1
fi
if [ ! -s "$TMP" ]; then
  echo "Download failed: binary is empty."
  rm -f "$TMP"
  exit 1
fi
chmod +x "$TMP"
sudo mv "$TMP" "$INSTALL_DIR/ferrosonic-ui"
sudo ln -sfn ferrosonic-ui "$INSTALL_DIR/ferrosonic"

echo "Installing user service..."
mkdir -p "$UNIT_DIR"
if ! curl -fsSL "$SERVICE_URL" -o "$UNIT_DIR/$UNIT_NAME"; then
  echo "Failed to download $UNIT_NAME from: $SERVICE_URL"
  exit 1
fi
systemctl --user daemon-reload
systemctl --user enable --now "$UNIT_NAME"

echo ""
echo "ferrosonic-ui $LATEST installed to $INSTALL_DIR/"
echo "  ferrosonic              terminal UI"
echo "  ferrosonic --daemon     player and web UI"
echo "  ferrosonic-ui           web UI in the foreground"
echo "  $UNIT_NAME              enabled and started"
echo "  mpv $(mpv --version 2>/dev/null | head -n1 | sed 's/^mpv //')"
echo "Listening on http://0.0.0.0:4317/ (all interfaces)"
