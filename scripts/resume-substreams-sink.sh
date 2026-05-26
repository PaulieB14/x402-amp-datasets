#!/usr/bin/env bash
# Resume the x402-base-pulse Substreams sink from the last cursor in state.yaml.
# Use this on the 1st of any month after the free-tier processed-blocks quota
# resets (7M blocks/month), or any time the sink was killed.
#
# Reads cursor from data/x402-substreams/state.yaml — DO NOT DELETE that file.
# Outputs parquet to data/x402-substreams/output/settlements/.
#
# Run: ./scripts/resume-substreams-sink.sh
#
# To stop:  pkill -f substreams-sink-files

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$REPO/data/x402-substreams"

if [[ ! -f "$WORK/state.yaml" ]]; then
  echo "ERROR: $WORK/state.yaml not found. Without a cursor, resuming would" >&2
  echo "re-burn the previous month's processed-blocks budget. Either restore" >&2
  echo "state.yaml from git (git checkout HEAD -- data/x402-substreams/state.yaml)" >&2
  echo "or start fresh by deleting this guard." >&2
  exit 1
fi

# Substreams CLI reads its API token from ~/.config/substreams/config.toml after
# `substreams auth login`; the sink expects it in SUBSTREAMS_API_TOKEN env var.
if [[ -z "${SUBSTREAMS_API_TOKEN:-}" ]]; then
  if [[ -f "$HOME/.config/substreams/config.toml" ]]; then
    SUBSTREAMS_API_TOKEN=$(grep "^api-token" "$HOME/.config/substreams/config.toml" | sed 's/.*= *"//; s/"$//')
    export SUBSTREAMS_API_TOKEN
  else
    echo "ERROR: SUBSTREAMS_API_TOKEN env var not set and ~/.config/substreams/config.toml not found." >&2
    echo "Run: substreams auth login" >&2
    exit 1
  fi
fi

CURSOR_BLOCK=$(awk '/^    number:/ {print $2; exit}' "$WORK/state.yaml")
echo "→ resuming from cursor at block $CURSOR_BLOCK"
echo "→ sink writes parquet chunks to $WORK/output/settlements/"
echo "→ logs: /tmp/substreams-sink.log"
echo "→ stop with: pkill -f substreams-sink-files"

mkdir -p "$WORK/output/settlements"
cd "$WORK"

# Sink reads --start-block as the manifest's initial block but actually resumes
# from state.yaml's cursor. final-blocks-only avoids reorg complexity.
substreams-sink-files run x402-base-pulse map_x402_settlements \
  -e base-mainnet.streamingfast.io:443 \
  --encoder=parquet \
  --start-block=25000000 \
  --file-block-count=100000 \
  --state-store=./state.yaml \
  --final-blocks-only > /tmp/substreams-sink.log 2>&1 &

SINK_PID=$!
sleep 3
if kill -0 "$SINK_PID" 2>/dev/null; then
  echo "✓ sink started (PID $SINK_PID)"
  echo ""
  echo "Watch progress live:"
  echo "  tail -F /tmp/substreams-sink.log | grep --line-buffered boundary"
  echo ""
  echo "Or peek at the latest chunks:"
  echo "  ls $WORK/output/settlements/ | tail -5"
else
  echo "✗ sink died on startup — check /tmp/substreams-sink.log" >&2
  tail -10 /tmp/substreams-sink.log >&2
  exit 1
fi
