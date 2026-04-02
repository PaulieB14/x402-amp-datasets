# x402 Analytics on Amp

Multi-chain analytics datasets for the [x402 payment protocol](https://x402.org),
built on [Amp](https://github.com/edgeandnode/amp) by Edge & Node.

## Architecture

Self-contained two-layer pipeline — no external dependencies beyond Amp's raw EVM data:

```
Amp raw EVM RPC → x402 raw extraction → x402 analytics
```

The raw extraction layer filters for x402 settlement events across both payment paths:
- **EIP-3009**: `transferWithAuthorization` (USDC native, pairs Transfer + AuthorizationUsed)
- **Permit2**: `settle()` / `settleWithPermit()` via x402ExactPermit2Proxy

## Datasets

| Dataset | Layer | Chain | Status |
|---|---|---|---|
| `x402/base_mainnet_raw` | Raw extraction | Base | Code-ready |
| `x402/exact_base_analytics` | Analytics | Base | Code-ready |

Other chains (Ethereum, Polygon, Arbitrum, Optimism) follow the same pattern — pending raw RPC dataset availability from the Amp team.

## Analytics Tables (15 per chain)

| Table | Description |
|---|---|
| `daily_stats` | Payment count + volume by UTC day |
| `hourly_stats` | Payment count + volume by hour (for intraday charts) |
| `top_payers` | All payer addresses ranked by total spend |
| `top_recipients` | All recipients ranked by total revenue |
| `first_seen_payers` | First appearance of each payer address (growth tracking) |
| `first_seen_recipients` | First appearance of each recipient address (growth tracking) |
| `new_payers_daily` | Count of first-time payers per day (adoption curve) |
| `new_recipients_daily` | Count of first-time recipients per day (adoption curve) |
| `payer_recipient_pairs` | Who pays whom — relationship mapping with volume |
| `payment_size_distribution` | Volume bucketed by payment size (micro/small/medium/large/xlarge/whale) |
| `transfer_method_stats` | Volume breakdown by settlement path (eip3009 vs permit2) |
| `facilitator_stats` | All-time stats per facilitator (Coinbase CDP, PayAI, Thirdweb, etc.) |
| `facilitator_daily` | Daily volume per facilitator (for operator dashboards) |
| `raw_transfers` | Pass-through of all x402 events with facilitator + transfer_method |
| `protocol_summary` | Single-row all-time cumulative totals |

## Usage

```typescript
import { AmpClient } from "@edgeandnode/amp"

const client = new AmpClient({ url: "<AMP_ENDPOINT>" })

// Protocol summary
const summary = await client.query(
  "SELECT * FROM x402.exact_base_analytics.protocol_summary"
)

// EIP-3009 vs Permit2 breakdown
const methods = await client.query(
  "SELECT * FROM x402.exact_base_analytics.transfer_method_stats"
)

// Facilitator leaderboard (Coinbase CDP, PayAI, etc.)
const facilitators = await client.query(
  "SELECT * FROM x402.exact_base_analytics.facilitator_stats"
)

// Payment size distribution
const sizes = await client.query(
  "SELECT * FROM x402.exact_base_analytics.payment_size_distribution"
)
```

## Deployment Checklist

**Confirmed from Amp source (`tests/config/`):**
- [x] Raw EVM RPC dataset name for Base: `_/base_rpc` (from `tests/config/manifests/base_rpc.json`)
- [x] Network string: `base-mainnet` (from provider config `rpc_eth_base.toml`)
- [x] Dependency format: `_/base_rpc@latest` (matches `_/eth_rpc@0.0.0` pattern in tests)
- [x] SQL alias: `base_rpc.logs`, `base_rpc.transactions` (standard alias dot notation)
- [x] Inter-table refs: `self.` prefix (confirmed in `datasets-derived-inter-table-dependencies.md`)

**Confirm with Amp team at deployment:**
- [ ] Production Amp endpoint URL
- [ ] `_/base_rpc` is registered and extracting on production (with appropriate start_block)
- [ ] Namespace `x402` is authorized (fallback: use wallet address as namespace)
- [ ] Raw RPC availability for other chains (`_/eth_rpc`, `_/polygon_rpc`, `_/arbitrum_rpc`, `_/optimism_rpc`)
- [ ] `TO_TIMESTAMP()` timezone behavior — add `AT TIME ZONE 'UTC'` if daily_stats totals don't match protocol_summary
