# /data/x402-omnigraph — x402 on Base, sourced from x402-omnigraph subgraph

Snapshot of x402 protocol activity on Base mainnet, queried from the live
[x402-omnigraph](https://github.com/PaulieB14/x402-omnigraph) subgraph and
dumped to parquet for in-place query via DuckDB.

## Source

- **Subgraph**: `x402 Base` on The Graph Network
- **Subgraph ID**: `Cb56epg3EvQ6JRpPfknbkM54QxpzTvLa7mwKNQQfUyoj`
- **Deployment hash**: `QmPtuuoU9nu9VJyodiVohf21y8RsR2fx8BpxuVBRHhP29D`
- **Synced to block**: 46,504,836
- **Snapshot date**: 2026-05-26
- **Indexing errors**: none

## Headline numbers (lifetime, x402 on Base)

- **130,927,632** EIP-3009 settlements
- **5,724** Permit2 settlements
- **$41.9M USDC** total volume
- **105** registered facilitators
- ~60-90k payments/day, $13-23k volume/day in last week

## Top 5 facilitators by settlement count

| Name | Settlements | Volume (USDC) |
|---|---|---|
| Daydreams | 11.8M | $2.76M |
| PayAI (`0xc669...cb63`) | 4.88M | $2.14M |
| PayAI (`0xb2bd...371b`) | 4.52M | $0.98M |
| Coinbase (10 hot addresses) | ~4.4M each | $1.5-1.6M each |

## Files

| File | Rows | Description |
|---|---|---|
| `daily_stats.parquet` | 379 | Daily rollup — total payments, volume, EIP-3009 vs Permit2 breakdown |
| `facilitators.parquet` | 105 | All registered facilitators with running totals |
| `top_recipients.parquet` | 1,000 | Address summaries for top recipients by lifetime volume |
| `top_payers.parquet` | 1,000 | Address summaries for top payers by lifetime volume |
| `recent_payments.parquet` | 1,000 | Latest 1,000 payment-level records (subgraph caps `first` at 1000) |
| `*.json` | — | Raw GraphQL responses (kept for transparency) |

Total parquet size: **~262 KB** (zstd-compressed).

## Query examples (DuckDB)

```bash
# Daily volume last 30 days
duckdb -c "
  SELECT date, totalPayments::BIGINT AS pmts, totalVolumeDecimal::DOUBLE AS volume_usdc
  FROM 'daily_stats.parquet'
  ORDER BY date DESC LIMIT 30
"

# Top facilitators by USDC volume
duckdb -c "
  SELECT name, totalSettlements::BIGINT AS settlements, totalVolumeDecimal::DOUBLE AS volume_usdc
  FROM 'facilitators.parquet'
  WHERE isActive = true
  ORDER BY totalVolumeDecimal::DOUBLE DESC LIMIT 20
"

# Average payment size in last 1000 payments
duckdb -c "
  SELECT
    AVG(amountDecimal::DOUBLE) AS avg_usdc,
    MEDIAN(amountDecimal::DOUBLE) AS median_usdc,
    SUM(amountDecimal::DOUBLE) AS total_usdc
  FROM 'recent_payments.parquet'
"

# Permit2 vs EIP-3009 lifetime
duckdb -c "
  SELECT
    SUM(eip3009Payments::BIGINT) AS eip3009,
    SUM(permit2Payments::BIGINT) AS permit2,
    SUM(totalVolumeDecimal::DOUBLE) AS total_volume_usdc
  FROM 'daily_stats.parquet'
"
```

## How this was produced

```bash
# 1. Query the subgraph
GRAPH_API_KEY=<your_key>
SUBGRAPH_URL="https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/Cb56epg3EvQ6JRpPfknbkM54QxpzTvLa7mwKNQQfUyoj"

# 2. Pull each entity (subgraph caps `first` at 1000)
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"query":"{ x402DailyStats(first: 1000, orderBy: date, orderDirection: desc) { date totalPayments totalVolumeDecimal eip3009Payments permit2Payments } }"}' \
  $SUBGRAPH_URL > daily_stats.json

# 3. Flatten + convert via duckdb
python3 -c "import json; d=json.load(open('daily_stats.json')); [print(json.dumps(r)) for r in d['data']['x402DailyStats']]" > daily_stats.ndjson
duckdb -c "COPY (SELECT * FROM read_ndjson_auto('daily_stats.ndjson')) TO 'daily_stats.parquet' (FORMAT PARQUET, COMPRESSION ZSTD)"
```

## Refresh frequency

The subgraph syncs continuously with Base mainnet (block lag typically <30s).
To refresh this snapshot, re-run the queries above. The parquet files can be
diffed to identify new payments, daily stats deltas, etc.

For a fully automated refresh, wire up a GitHub Actions cron that runs the
queries and commits updated parquet daily — `GRAPH_API_KEY` as a repo secret.

## Why this exists alongside `data/` (the original 1,091-block ampd sample)

Tonight's experiment proved two paths to x402 data:

1. **Self-hosted Amp + RPC** (the original `data/` files) — full raw Base
   blocks/txs/logs, queryable via DataFusion SQL. Validates that Amp works on
   macOS. Slow ingest (4-5 blocks/sec on DRPC Growth, ~20h for 7 days).
2. **x402-omnigraph subgraph** (this folder) — pre-indexed by The Graph,
   queries return in milliseconds, free, schema is already x402-specific.
   Strictly better for x402 analytics.

If your goal is "ship x402 datasets to GitHub", path #2 (this folder) wins on
every axis. Path #1 stays useful for raw Base data exploration outside x402.
