# amp vs x402-omnigraph cross-validation

Side-by-side comparison of EIP-3009 settlement counts and USDC volumes from
the self-hosted ampd daemon vs the x402-omnigraph subgraph, for overlapping
calendar days.

## Summary finding

**ampd's simple SQL filter (any `AuthorizationUsed` + paired `Transfer` in
same tx on USDC) catches both x402 *and non-x402* EIP-3009 traffic.** This
includes OTC desks, bridge ops, exchange settlements — anywhere
`transferWithAuthorization` is used outside the x402 facilitator network.

The x402-omnigraph subgraph applies stricter gating: a settlement only counts
if `tx.from` is a registered facilitator in the on-chain `FacilitatorRegistry`
contract. This is the correct definition of "an x402 payment" per the
protocol.

## Comparison (overlapping days)

| Date | ampd events | omnigraph events | Excess | ampd $USDC | omnigraph $USDC | Volume ratio |
|---|---|---|---|---|---|---|
| 2026-05-19 | 93,094 | 64,838 | +43.6% | $3.10M | $27.8k | **111×** |
| 2026-05-20 | 127,522 | 86,405 | +47.6% | $1.73M | $23.1k | **75×** |
| 2026-05-21 | 96,597 | 74,165 | +30.2% | $1.69M | $21.8k | **77×** |
| 2026-05-22 (partial) | 53,938 | 87,950 | -38.7% | $1.66M | $17.7k | n/a |

## What's in the gap

Payment size distribution from ampd's loose filter:

| Bucket | Payments | Volume USDC |
|---|---|---|
| <$0.01 (micro) | 229,632 | $530 |
| <$0.10 (micro) | 70,558 | $2,193 |
| <$1 (small) | 38,143 | $16,941 |
| <$10 (medium) | 22,470 | $56,247 |
| <$100 (large) | 6,899 | $208,022 |
| <$1k (xlarge) | 2,433 | $684,672 |
| **≥$1k (whale)** | **1,016** | **$7,209,160** |

**1,016 "whale" transactions ≥ $1k contribute $7.2M of $8.18M total volume —
88% of ampd's volume comes from <0.3% of its events.** Those are almost
certainly institutional USDC moves (treasuries, exchanges, bridges) using
`transferWithAuthorization` for gas efficiency, not x402 retail payments.

## Implications

1. **For "what is x402 activity?" → use omnigraph or the
   `x402-base-pulse` Substreams package.** Both are strict-gated and give
   the canonical answer.
2. **For "all on-chain EIP-3009 activity on USDC" → ampd's raw
   query is correct.** It's just not what x402-specific analytics need.
3. **The Substreams sink data (when chunks contain rows) will match
   omnigraph, not ampd.** Both use the FacilitatorRegistry gate.

## Reproduce this finding

```bash
duckdb -c "
WITH amp AS (
  SELECT CAST(date AS DATE) AS date, payments AS amp_payments, volume_usdc AS amp_volume
  FROM 'daily_stats.parquet'
),
og AS (
  SELECT CAST(date AS DATE) AS date,
    CAST(totalPayments AS BIGINT) AS og_payments,
    CAST(totalVolumeDecimal AS DOUBLE) AS og_volume
  FROM '../x402-omnigraph/daily_stats.parquet'
)
SELECT amp.date, amp_payments, og_payments,
  amp_payments - og_payments AS excess,
  ROUND(100.0 * (amp_payments - og_payments) / og_payments, 1) AS excess_pct,
  ROUND(amp_volume, 2) AS amp_vol, ROUND(og_volume, 2) AS og_vol
FROM amp JOIN og USING(date) ORDER BY amp.date DESC
"
```
