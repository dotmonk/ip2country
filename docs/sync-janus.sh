#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

JANUS_SRC="${JANUS_SRC:-}"
CACHE_DIR=".cache/janus-elements"

if [ -z "$JANUS_SRC" ]; then
  if [ ! -d "$CACHE_DIR/.git" ]; then
    mkdir -p .cache
    git clone --depth 1 --branch patriarch https://github.com/dotmonk/janus-elements.git "$CACHE_DIR"
  else
    git -C "$CACHE_DIR" fetch --depth 1 origin patriarch
    git -C "$CACHE_DIR" checkout -q FETCH_HEAD
  fi
  JANUS_SRC="$CACHE_DIR"
fi

rm -rf docs/lib
mkdir -p docs/lib
cp -R "$JANUS_SRC/src/janus" docs/lib/janus
echo "Synced janus from $JANUS_SRC into docs/lib/janus"
