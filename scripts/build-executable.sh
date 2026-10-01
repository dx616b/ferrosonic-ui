#!/bin/sh
set -e

cd "$(dirname "$0")/.."

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required to compile the executable: https://bun.sh"
  exit 1
fi

HOLD=""
restore_api() {
  if [ -n "$HOLD" ] && [ -d "$HOLD/api" ]; then
    rm -rf src/app/api
    mv "$HOLD/api" src/app/api
    rmdir "$HOLD" 2>/dev/null || true
    HOLD=""
  fi
}
trap restore_api EXIT

rm -rf .next out
HOLD=$(mktemp -d)
mv src/app/api "$HOLD/api"

FERROSONIC_EXPORT=1 npx next build
restore_api
trap - EXIT

mkdir -p player dist
if [ -n "${FERROSONIC_PLAYER:-}" ]; then
  cp "$FERROSONIC_PLAYER" player/ferrosonic
else
  SRC="${FERROSONIC_SRC:-../ferrosonic-ng}"
  if [ ! -f "$SRC/Cargo.toml" ]; then
    echo "Set FERROSONIC_PLAYER, or place the ferrosonic-ng checkout at $SRC"
    exit 1
  fi
  if ! command -v cargo >/dev/null 2>&1; then
    echo "cargo is required to build the bundled player"
    exit 1
  fi
  (cd "$SRC" && cargo build --release --bin ferrosonic)
  cp "$SRC/target/release/ferrosonic" player/ferrosonic
fi
chmod +x player/ferrosonic

bun build --compile ./src/bin/ferrosonic-ui.ts --asset ./out --asset ./player --outfile dist/ferrosonic-ui
echo "Built dist/ferrosonic-ui (UI + player)"
