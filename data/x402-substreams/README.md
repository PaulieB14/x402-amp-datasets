# /data/x402-substreams — x402 payments via Substreams sink (partial backfill)

x402 settlements on Base, extracted via [`x402-base-pulse`](https://substreams.dev/packages/x402-base-pulse/v3.0.0) (your own Substreams package) sinked to parquet via `substreams-sink-files`. Free-tier Substreams plan, no Substreams subscription, no Mac required (after the sink finishes).

## Status: partial / in-progress

The Substreams free tier caps at **7,000,000 processed blocks per month**. The
`x402-base-pulse` package has stores starting at block `25,000,000` (USDC
contract launch on Base), but x402 itself didn't have any settlements until
around block `30,011,612` (FacilitatorRegistry deployment, 2025-05-13).
So the first ~5M blocks of any backfill are "empty work" — the engine still
processes them in case there are settlements, but no rows are emitted.

Concretely: a single-month free tier budget yields ~5-7M linearly-streamed
blocks before halting. Started at block 25M, that gets us roughly to block
**~32M** — about **1 month past x402 launch** — before the budget resets the
next billing cycle.

Strategy: run the sink each month, advance the cursor via `state.yaml`,
eventually cover the full range. Or pay $100 once for Scaling tier to finish
in <1 day (155M blocks included).

## What's actually in `output/settlements/`

| File | Block range | Rows | Status |
|---|---|---|---|
| `0025000000-0025100000.parquet` | 25.0M-25.1M | 0 | empty (pre-x402) |
| `0025100000-0025200000.parquet` | 25.1M-25.2M | 0 | empty |
| `0025200000-0025300000.parquet` | 25.2M-25.3M | 0 | empty |
| `0025300000-0025400000.parquet` | 25.3M-25.4M | 0 | empty |
| `0025400000-0025500000.parquet` | 25.4M-25.5M | 0 | empty |
| ... | ... | ... | sink still running, ~5-7M more blocks before free-tier halts |

Once we cross block ~30M, rows will start appearing.

## Schema

Each parquet file has the pre-decoded settlement schema from `x402-base-pulse`'s `map_x402_settlements` module:

| Column | Type | Notes |
|---|---|---|
| `id` | varchar | unique per settlement event |
| `tx_hash` | varchar | hex string |
| `log_index` | uint | position within transaction |
| `block_number` | ubigint | Base block height |
| `timestamp` | timestamp with tz | UTC |
| `payer` | varchar | hex address (the actual user paying) |
| `recipient` | varchar | hex address (the resource server) |
| `token` | varchar | USDC contract by default |
| `amount` | varchar | atomic units (string to avoid uint256 overflow) |
| `settlement_type` | varchar | `eip3009` or `permit2` |
| `facilitator` | varchar | hex address (whoever called settle) |
| `gas_used` | varchar | atomic units |
| `gas_price` | varchar | atomic units |
| `nonce` | varchar | EIP-3009 nonce, null for Permit2 |

This is **strictly richer than the omnigraph subgraph data** — Substreams
pre-decodes facilitator + gas cost + settlement type per row, which the
subgraph schema either flattens or omits.

## Resuming from `state.yaml`

The `state.yaml` file records the substreams cursor. To resume after a free-tier
exhaust (next billing cycle) or after stopping the sink:

```bash
# Pick up where you left off
export SUBSTREAMS_API_TOKEN=$(grep "^api-token" ~/.config/substreams/config.toml | sed 's/.*= *"//; s/"$//')
substreams-sink-files run x402-base-pulse map_x402_settlements \
  -e base-mainnet.streamingfast.io:443 \
  --encoder=parquet \
  --start-block=25000000 \
  --file-block-count=100000 \
  --state-store=./state.yaml \
  --final-blocks-only
```

The `state-store` reads the cursor; sink resumes from the last successful
boundary, not from `--start-block`.

## Comparison with other datasets in this repo

| Folder | Source | Time-to-have-data | Lifetime coverage | Per-row richness |
|---|---|---|---|---|
| `data/` | one-off ampd sample | done | 36 minutes of Base | low (raw logs) |
| `data/x402-omnigraph/` | x402-omnigraph subgraph | **already done** | **all 12+ months** | medium (entity rollups) |
| `data/amp-derived/` | self-hosted ampd | done (partial 7-day) | 7-day window | low (raw logs JOINed) |
| **`data/x402-substreams/`** (this) | x402-base-pulse Substreams + sink | months on free tier OR 1 day for $100 | partial → expanding | **highest** (pre-decoded) |
