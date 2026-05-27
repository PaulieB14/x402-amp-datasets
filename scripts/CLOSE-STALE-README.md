# Force-closing stale Graph Horizon allocations

This is unrelated to the x402 datasets in this repo — just colocated here
for convenience. It's a one-off permissionless network-maintenance script.

## What it does

Per the Graph Horizon spec, **anyone** can call `closeStaleAllocation(address)`
on the SubgraphService contract to force-close an allocation that has gone
stale (POI not submitted within `maxPOIStaleness`). No reward is offered;
this is pure network hygiene.

`scripts/stale-allocations-candidates.csv` lists 62 candidate allocations
(≥1000 GRT each, opened more than 28 epochs ago — the legacy threshold,
used here as a "probably stale" heuristic). **Total stake stuck: ~2.03M GRT.**

`scripts/close-stale-allocations.sh` iterates the CSV:
1. Simulates each close via `cast call` (free read-only)
2. If simulation succeeds → sends the real tx via `cast send`
3. If simulation reverts (allocation actually not stale, or altruistic) → skips
4. Logs everything to `scripts/close-stale-results.log`

## Prereqs

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (provides `cast`)
- A signer key with ETH gas on Arbitrum One (~$1–5 worst case for all 62)
- Arbitrum RPC URL (default: `https://arb1.arbitrum.io/rpc`)

## Usage

```bash
# Dry-run first — see which would close without spending anything
DRY_RUN=true ./scripts/close-stale-allocations.sh

# Real run — sends transactions
PRIVATE_KEY=0xYOURKEY ./scripts/close-stale-allocations.sh

# Real run, capped at 5 closes (sanity check)
PRIVATE_KEY=0xYOURKEY MAX_CLOSES=5 ./scripts/close-stale-allocations.sh

# Resume from row 30 if it died mid-run
PRIVATE_KEY=0xYOURKEY START_LINE=30 ./scripts/close-stale-allocations.sh
```

## Important caveats

- **The legacy 28-epoch rule isn't authoritative on Horizon.** Horizon's
  real rule is `maxPOIStaleness` — POI-collection-timestamp-based. The
  contract enforces it; the script relies on `cast call` simulation to
  surface that and skip non-stale candidates safely.
- **No financial reward** to you for closing them. This is network maintenance.
- **Allocations rotate**. The CSV is a snapshot from 2026-05-26. Re-pull
  before running if more than a few days have passed.

## Re-pulling the candidate list

```bash
# In a fresh session, re-run the substreams subgraph query for large stale
# (≥1000 GRT, createdAtEpoch <= currentEpoch - 28) and overwrite the CSV.
# See git history for the GraphQL query used.
```
