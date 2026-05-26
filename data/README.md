# /data — first self-hosted Amp test run

Result of bringing up an `ampd` node on a MacBook with `$0` of infrastructure,
indexing a 1,091-block window of Base mainnet, and querying x402 activity.

## Setup

- **Host**: macOS arm64, `ampd v0.0.35` via `https://ampup.sh/install`
- **Postgres**: macOS Homebrew `postgresql@15` (already installed)
- **RPC**: `https://base.publicnode.com` (free, supports `eth_getBlockReceipts`
  — note: `https://mainnet.base.org` does NOT and is unusable for `ampd`)
- **Workspace**: `~/amp-test/` (must be a no-space path due to
  ampd v0.0.35 double URL-encoding bug on paths containing spaces)
- **Backfill rate**: ~6 blocks/sec on free RPC — comparable to Chainstack
  Growth in Lodestar's blog
- **Total time**: 1,091 blocks (~36 min of Base) backfilled in 3 minutes
- **On-disk size**: 87 MB raw parquet across 18 files

## Files

- `protocol_summary.json` — overview: log counts, storage projection
- `window.json` — block range covered
- `sample_authorizations.jsonl` — 100 sample EIP-3009 `AuthorizationUsed` events
- `x402_permit2_events.jsonl` — every log emitted by the x402 Permit2 proxy
  (`0x402085c248EeA27D92E8b30b2C58ed07f9E20001`) in the window

## Findings

- **4,225 EIP-3009 `AuthorizationUsed` events** in 36 minutes → ~7,000/hour →
  x402's EIP-3009 path is firing constantly on Base
- **1 x402 Permit2 proxy log** in the same window — Permit2 path is much rarer
- **138,583 USDC logs total** in the window
- **Storage**: 75 KB/block → 3.26 GB/day → 98 GB/month → ~1.2 TB/year for full
  Base mainnet at this resolution
