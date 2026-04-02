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

## Analytics Tables (13 per chain)

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
| `raw_transfers` | Pass-through of all x402 events with transfer_method tag |
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

// Payment size distribution
const sizes = await client.query(
  "SELECT * FROM x402.exact_base_analytics.payment_size_distribution"
)
```

## What We Need From the Amp Team

1. **Production Amp endpoint URL**
2. **Raw EVM RPC dataset name for Base** (e.g., `_/base_mainnet_rpc@latest`)
3. **Raw RPC availability for other chains** (Ethereum, Polygon, Arbitrum, Optimism)
