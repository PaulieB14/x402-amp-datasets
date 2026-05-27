# x402-amp-datasets

x402 payment-protocol datasets on Base, built four different ways and committed
side-by-side so you can pick whichever fits your use case (or compare them).

This repo started as Amp dataset definitions for the [x402 protocol](https://x402.org).
After spending ~24 hours testing the full Amp self-host stack against real
infrastructure (Mac Mini + DRPC + GitHub Actions + Substreams free tier),
it now ships four queryable datasets and the operational scripts behind them.

➡️ **Start here:** [`data/README.md`](data/README.md) — full guide to the four
data folders, when to use each, and the cross-validation finding that
matters for picking one.

➡️ **Test write-up:** [`TEST-RESULTS.md`](TEST-RESULTS.md) — what we set out
to validate about Amp, what actually worked, what didn't, and what we'd do
differently.

## Quick query examples

```bash
# x402 lifetime daily stats — full 12+ months, refreshed daily by CI
duckdb -c "SELECT date, totalPayments, totalVolumeDecimal
           FROM 'data/x402-omnigraph/daily_stats.parquet'
           ORDER BY date DESC LIMIT 7"

# Top 20 recipients by all-time USDC volume
duckdb -c "SELECT address, totalPayments, totalVolumeDecimal
           FROM 'data/x402-omnigraph/top_recipients.parquet' LIMIT 20"

# Recent payment-level records (last 1000)
duckdb -c "SELECT blockTimestamp, amountDecimal, transferMethod, \"from\", \"to\"
           FROM 'data/x402-omnigraph/recent_payments.parquet' LIMIT 5"
```

## Data folders

| Folder | Source | Coverage | Refresh |
|---|---|---|---|
| [`data/initial-sample/`](data/initial-sample/) | self-hosted ampd | 1,091 blocks (36 min of Base) | static |
| [`data/amp-derived/`](data/amp-derived/) | self-hosted ampd | ~3.5 days of Base, ~371k EIP-3009 events | manual |
| [`data/x402-omnigraph/`](data/x402-omnigraph/) | x402-omnigraph subgraph | **full lifetime** | **daily auto via GitHub Actions** |
| [`data/x402-substreams/`](data/x402-substreams/) | Substreams sink-files | progressive, multi-month grind on free tier | manual via resume script |

## Scripts

| Script | Purpose |
|---|---|
| [`scripts/refresh-x402-omnigraph.sh`](scripts/refresh-x402-omnigraph.sh) | Pull fresh subgraph snapshot → parquet. Used by the GitHub Actions cron daily. |
| [`scripts/resume-substreams-sink.sh`](scripts/resume-substreams-sink.sh) | Resume the Substreams sink from its cursor (e.g. after a free-tier month-end reset). |

## Original Amp dataset definitions (TypeScript)

The repo also contains the original `defineDataset()` TypeScript files in
[`src/datasets/`](src/datasets/) — they describe `x402/base_mainnet_raw` (raw
extraction) and `x402/exact_base_analytics` (15 analytics tables). These were
the *intent* the repo was built around.

**These don't deploy successfully today** against the publicly-available
`ampd v0.0.35` binary due to an SDK/daemon protocol skew (the SDK on npm is
at v0.0.55+; the released daemon caps at v0.0.35). The SQL logic inside them
still works — the test reproduced the same outputs by querying ampd's
JSON Lines endpoint directly with the same SQL bodies. See
[`TEST-RESULTS.md`](TEST-RESULTS.md) for the full story.

## Original protocol architecture (still accurate)

x402 settles on-chain through two paths. Both are captured:

- **EIP-3009**: `transferWithAuthorization` (USDC native; pairs Transfer + AuthorizationUsed events)
- **Permit2**: `settle()` / `settleWithPermit()` via the x402ExactPermit2Proxy contract

Strict x402 analytics (subgraph + Substreams package) further gate via the
on-chain `FacilitatorRegistry` — only `transferWithAuthorization` calls from
registered facilitators count as x402.

## Contracts on Base mainnet

| Contract | Address |
|---|---|
| USDC (FiatTokenV2_2) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| FacilitatorRegistry | `0x67C75c4FD5BbbF5f6286A1874fe2d7dF0024Ebe8` |
| x402ExactPermit2Proxy | `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` |
