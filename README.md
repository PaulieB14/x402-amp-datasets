# x402 Analytics on Amp

Multi-chain analytics datasets for the [x402 payment protocol](https://x402.org),
built on [Amp](https://github.com/edgeandnode/amp) by Edge & Node.

## Datasets

| Dataset | Chain | Status |
|---|---|---|
| `x402/exact_base_analytics` | Base | ✅ Published |
| `x402/exact_ethereum_analytics` | Ethereum | TBD |
| `x402/exact_polygon_analytics` | Polygon | TBD |
| `x402/exact_arbitrum_analytics` | Arbitrum One | TBD |
| `x402/exact_optimism_analytics` | Optimism | TBD |

## Tables (all chains)

| Table | Description |
|---|---|
| `daily_stats` | Payment count + volume by UTC day |
| `top_payers` | All payer addresses ranked by total spend |
| `top_recipients` | All recipients ranked by total revenue |
| `protocol_summary` | Single-row all-time cumulative totals |

## Usage

```typescript
import { AmpClient } from "@edgeandnode/amp"

const client = new AmpClient({ url: "<AMP_ENDPOINT>" })

const summary = await client.query(
  "SELECT * FROM x402.exact_base_analytics.protocol_summary"
)
```

## Upstream Dependencies

Built on [Ampersend](https://github.com/edgeandnode/ampersend) raw event data:
- `ampersend/exact_base_mainnet@0.2.1` (Base)
- Additional chains pending raw dataset availability
