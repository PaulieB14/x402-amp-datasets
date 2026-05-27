#!/usr/bin/env bash
# Force-close stale allocations on The Graph Horizon (Arbitrum One).
#
# This script:
#   1. Reads candidate allocations from scripts/stale-allocations-candidates.csv
#   2. For each, dry-runs `closeStaleAllocation()` via `cast call` (free)
#   3. If the simulation succeeds, sends the tx via `cast send`
#   4. Logs results to scripts/close-stale-results.log
#
# Required env vars:
#   PRIVATE_KEY    — your signer key with ETH gas on Arbitrum One
#   ARB_RPC_URL    — Arbitrum One RPC endpoint (default: https://arb1.arbitrum.io/rpc)
#
# Optional env vars:
#   DRY_RUN=true   — only simulate, never send (useful first pass)
#   MAX_CLOSES=N   — cap number of actual closes (default: unlimited)
#   START_LINE=N   — resume from row N in CSV (1-indexed, after header)
#
# Cost: ~$0.01–0.05 per close on Arbitrum. 1000 candidates ≈ $10–50 worst case.
# Reward: none — the doc states force-closing is permissionless network maintenance.
#
# Usage:
#   PRIVATE_KEY=0x... ./scripts/close-stale-allocations.sh        # real run
#   DRY_RUN=true     ./scripts/close-stale-allocations.sh         # simulate only
#
# Stop with Ctrl-C anytime; the results log keeps your progress.

set -uo pipefail  # -e dropped: we want the loop to continue past individual failures

REPO="$(cd "$(dirname "$0")/.." && pwd)"
CSV="$REPO/scripts/stale-allocations-candidates.csv"
LOG="$REPO/scripts/close-stale-results.log"

SUBGRAPH_SERVICE="0xb2Bb92d0DE618878E438b55D5846cfecD9301105"
ARB_RPC_URL="${ARB_RPC_URL:-https://arb1.arbitrum.io/rpc}"
DRY_RUN="${DRY_RUN:-false}"
MAX_CLOSES="${MAX_CLOSES:-0}"  # 0 = unlimited
START_LINE="${START_LINE:-1}"

if [[ ! -f "$CSV" ]]; then
  echo "ERROR: $CSV not found." >&2
  exit 1
fi

if ! command -v cast >/dev/null; then
  echo "ERROR: 'cast' (Foundry) not in PATH. Install: https://book.getfoundry.sh/getting-started/installation" >&2
  exit 1
fi

if [[ "$DRY_RUN" != "true" && -z "${PRIVATE_KEY:-}" ]]; then
  echo "ERROR: PRIVATE_KEY env var required for real run. Use DRY_RUN=true to simulate only." >&2
  exit 1
fi

echo "=== Stale-allocation force-close ===" | tee -a "$LOG"
echo "  Subgraph Service: $SUBGRAPH_SERVICE" | tee -a "$LOG"
echo "  RPC: $ARB_RPC_URL" | tee -a "$LOG"
echo "  CSV: $CSV ($(tail -n +2 "$CSV" | wc -l | tr -d ' ') candidates)" | tee -a "$LOG"
echo "  Dry run: $DRY_RUN" | tee -a "$LOG"
echo "  Started: $(date -u +%FT%TZ)" | tee -a "$LOG"
echo "" | tee -a "$LOG"

closed=0
skipped_stale=0
skipped_altruistic=0
skipped_other=0
errors=0
processed=0

# Iterate candidates (skip header)
tail -n +2 "$CSV" | awk -v s="$START_LINE" 'NR >= s' | while IFS=, read -r alloc_id indexer epoch grt; do
  processed=$((processed + 1))
  printf "[%4d] %s (indexer=%s, %s GRT, epoch %s) ... " "$processed" "$alloc_id" "${indexer:0:10}…" "$grt" "$epoch" | tee -a "$LOG"

  # Dry-run via cast call. State-changing functions revert in cast call if they'd revert when sent.
  SIM_OUT=$(cast call "$SUBGRAPH_SERVICE" "closeStaleAllocation(address)" "$alloc_id" --rpc-url "$ARB_RPC_URL" 2>&1)
  SIM_EXIT=$?

  if [[ $SIM_EXIT -ne 0 ]]; then
    # Classify the revert
    if echo "$SIM_OUT" | grep -qi "SubgraphServiceCannotForceCloseAllocation"; then
      echo "skip (not stale per Horizon rule)" | tee -a "$LOG"
      skipped_stale=$((skipped_stale + 1))
    elif echo "$SIM_OUT" | grep -qi "SubgraphServiceAllocationIsAltruistic"; then
      echo "skip (altruistic, 0 tokens)" | tee -a "$LOG"
      skipped_altruistic=$((skipped_altruistic + 1))
    else
      echo "skip (other revert)" | tee -a "$LOG"
      echo "       $SIM_OUT" | head -c 300 | tee -a "$LOG"
      echo "" | tee -a "$LOG"
      skipped_other=$((skipped_other + 1))
    fi
    continue
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "WOULD CLOSE (dry run)" | tee -a "$LOG"
    closed=$((closed + 1))
    [[ $MAX_CLOSES -gt 0 && $closed -ge $MAX_CLOSES ]] && { echo "Hit MAX_CLOSES=$MAX_CLOSES"; break; }
    continue
  fi

  # Real send
  SEND_OUT=$(cast send "$SUBGRAPH_SERVICE" "closeStaleAllocation(address)" "$alloc_id" \
    --rpc-url "$ARB_RPC_URL" --private-key "$PRIVATE_KEY" 2>&1)
  SEND_EXIT=$?

  if [[ $SEND_EXIT -eq 0 ]]; then
    TX=$(echo "$SEND_OUT" | grep -oE '0x[a-fA-F0-9]{64}' | head -1)
    echo "CLOSED ($TX)" | tee -a "$LOG"
    closed=$((closed + 1))
  else
    echo "SEND ERROR" | tee -a "$LOG"
    echo "       $SEND_OUT" | head -c 300 | tee -a "$LOG"
    echo "" | tee -a "$LOG"
    errors=$((errors + 1))
  fi

  [[ $MAX_CLOSES -gt 0 && $closed -ge $MAX_CLOSES ]] && { echo "Hit MAX_CLOSES=$MAX_CLOSES"; break; }

  # Light pacing to avoid hammering RPC
  sleep 0.5
done

echo "" | tee -a "$LOG"
echo "=== Done ===" | tee -a "$LOG"
echo "  Processed: $processed" | tee -a "$LOG"
echo "  Closed: $closed" | tee -a "$LOG"
echo "  Skipped (not stale): $skipped_stale" | tee -a "$LOG"
echo "  Skipped (altruistic): $skipped_altruistic" | tee -a "$LOG"
echo "  Skipped (other revert): $skipped_other" | tee -a "$LOG"
echo "  Errors: $errors" | tee -a "$LOG"
echo "  Finished: $(date -u +%FT%TZ)" | tee -a "$LOG"
