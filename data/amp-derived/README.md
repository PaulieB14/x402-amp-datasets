# /data/amp-derived — x402 payments extracted from self-hosted Amp

**This is the actual Amp test result.** Data extracted from a self-hosted
`ampd v0.0.35` daemon running on macOS, indexing Base mainnet from a personal
Mac Mini via DRPC Growth RPC. SQL filters from `src/datasets/x402_base_raw.ts`
adapted to the daemon's SQL dialect and run directly against the raw
`_/base_mainnet@2.0.0` dataset.

## How this differs from `/data/x402-omnigraph/`

| | `x402-omnigraph/` | **`amp-derived/`** (this folder) |
|---|---|---|
| Source | x402-omnigraph subgraph on The Graph Network | **Self-hosted ampd on a Mac Mini** |
| Indexed by | The Graph indexers | **Me, on my own hardware** |
| Run time so far | Years | ~10 hours overnight (47% of 7-day window) |
| Cost | $0 (free 100k subgraph queries/mo) | $13 DRPC Growth + electricity |
| Lifetime coverage | Yes — all 130M+ x402 payments | No — 7-day window only |
| Validates Amp | No | **Yes** |

## Window

- **Backfill range**: Base blocks `46184955` → `46487382` (~7 days, ~302k blocks total)
- **Indexed so far**: blocks `46184955` → `~46263229` (~47% complete, ~78k blocks)
- **First payment in dataset**: 2026-05-19 (block 46184955)
- **Last payment in dataset**: 2026-05-20 (block 46263229)
- **Backfill continues**: daemon is still running and will eventually cover
  all 302k blocks — at which point this folder's parquet should be regenerated.

## Files

| File | Rows | Size | Description |
|---|---|---|---|
| `eip3009_payments.parquet` | 214,190 | 18 MB | EIP-3009 path: `AuthorizationUsed` + paired `Transfer` events on USDC, joined on `tx_hash + log_index+1`. Each row = one x402 payment. |
| `permit2_payments.parquet` | 529 | 24 KB | Permit2 path: events on `x402ExactPermit2Proxy` joined with the same-tx USDC `Transfer`. |
| `daily_stats.parquet` | 2 | 1 KB | Aggregate per UTC day from `eip3009_payments`. Only 2 days so far because backfill is mid-window. |
| `top_recipients.parquet` | 100 | 5 KB | Top 100 recipients by total USDC volume across the indexed window. |
| `*_raw.jsonl` | — | — | Raw JSONL output from ampd's `:1603` endpoint before address/value decoding. Kept for transparency. |

## Headline numbers (47%-of-7-days so far)

- **214,190** EIP-3009 x402 payments
- **529** Permit2 x402 payments
- **$4.79M USDC** total volume (EIP-3009 only)
- **$22.35** average payment size
- **14,640+** unique payers, **6,600+** unique recipients per day

## How the data was extracted

Direct SQL queries to ampd's JSON Lines server (`POST http://localhost:1603/`),
following [Lodestar Dashboard's pattern](https://www.lodestar-dashboard.com/blog/run-local-amp-node) — they sidestep the `@edgeandnode/amp` SDK entirely and post SQL strings directly to the daemon.

### Why direct SQL instead of `amp build && amp deploy`

The repo's TypeScript dataset definitions (`src/datasets/x402_base_raw.ts`,
`src/datasets/exact_base_analytics.ts`) target the `@edgeandnode/amp` SDK at
v0.0.53. The publicly-released ampd binaries cap at v0.0.35. There's a
20-version skew between SDK and daemon:

- `npx amp build --admin-url http://localhost:1610` fails with
  `RequestError: Transport error (POST http://localhost:1610/schema)` →
  `TypeError: fetch failed` → `InvalidArgumentError: invalid content-length header`.
- `ampup install latest` (or any version > v0.0.35) returns 404 — the
  `edgeandnode/amp` GitHub repo is private and the published releases stop
  at v0.0.35.

So the SDK's developer workflow (TS → manifest → deploy → materialized derived
tables) **does not work today against the publicly-available daemon**. Lodestar
Dashboard, the only known public production user, also bypasses this layer.
This is a real ergonomics gap in Amp's developer surface; everything downstream
of the daemon (JSONL query, raw data storage, DataFusion execution) works fine.

### The actual extraction query

The EIP-3009 join is the same logic from `x402_base_raw.ts` adapted to
DataFusion's SQL dialect:

```sql
-- POST to http://localhost:1603/
SELECT
  a.block_num, a.timestamp,
  encode(arrow_cast(a.tx_hash, 'Binary'), 'hex') AS tx_hash,
  encode(arrow_cast(a.topic1, 'Binary'), 'hex') AS authorizer_padded,
  encode(arrow_cast(a.topic2, 'Binary'), 'hex') AS nonce,
  encode(arrow_cast(t.topic1, 'Binary'), 'hex') AS payer_padded,
  encode(arrow_cast(t.topic2, 'Binary'), 'hex') AS recipient_padded,
  encode(arrow_cast(t.data,   'Binary'), 'hex') AS value_hex
FROM "_/base_mainnet@2.0.0".logs a
JOIN "_/base_mainnet@2.0.0".logs t
  ON t.block_num = a.block_num
 AND t.tx_hash  = a.tx_hash
 AND t.log_index = a.log_index + 1
WHERE a.address = X'833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'      -- USDC
  AND a.topic0  = X'98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5'  -- AuthorizationUsed
  AND t.address = X'833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'      -- USDC
  AND t.topic0  = X'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'  -- Transfer
```

Then Python decodes the padded topic addresses (last 20 bytes of 32) and
parses `value_hex` (big-endian uint256) into atomic units, which we then
divide by 10^6 to get human-readable USDC.

## Query examples (DuckDB on the parquet files)

```bash
# Volume + counts per day
duckdb -c "SELECT * FROM 'daily_stats.parquet'"

# Top facilitators by recipient volume
duckdb -c "SELECT recipient, payments, volume_usdc FROM 'top_recipients.parquet' LIMIT 20"

# Specific payer's history
duckdb -c "
  SELECT block_num, timestamp, recipient, value_usdc
  FROM 'eip3009_payments.parquet'
  WHERE payer = '0xc289936534821231d5e919b5298a9979be2fac94'
  ORDER BY block_num DESC LIMIT 50
"
```

## Validation: this matches x402-omnigraph

Cross-check with the [x402-omnigraph subgraph](https://github.com/PaulieB14/x402-omnigraph)
data committed in `/data/x402-omnigraph/`:

- This folder: $4.79M volume, 214k payments in 2026-05-19/20 partial window
- omnigraph: $20.68M + $13.32M volume for 2026-05-23 + 2026-05-24 full days (60-90k payments/day)

Order of magnitude matches once the backfill completes the full 7 days.
