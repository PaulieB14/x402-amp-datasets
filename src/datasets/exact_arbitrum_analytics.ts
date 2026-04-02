import { defineDataset } from "@edgeandnode/amp"

export default defineDataset(() => ({
  namespace: "x402",
  name: "exact_arbitrum_analytics",
  version: "0.3.0",
  description:
    "x402 payment analytics for Arbitrum One mainnet. Hourly/daily volume, top payers, " +
    "top recipients, first-seen tracking, growth curves, payment size distribution, " +
    "payer-recipient pairs, and raw transfers derived from ampersend/exact_arbitrum_mainnet.",
  keywords: ["x402", "analytics", "arbitrum", "usdc", "payments", "agentic"],
  sources: ["https://github.com/edgeandnode/ampersend"],
  network: "arbitrum-one-mainnet",
  dependencies: {
    arbitrum: "ampersend/exact_arbitrum_mainnet@latest",
  },
  tables: {
    daily_stats: {
      sql: `
        SELECT
          DATE_TRUNC('day', TO_TIMESTAMP(timestamp))   AS date,
          COUNT(*)                                      AS total_payments,
          SUM(value_usdc)                               AS total_volume_usdc,
          SUM(value_usdc) / 1000000.0                  AS total_volume_usdc_decimal,
          COUNT(DISTINCT buyer_address)                 AS unique_payers,
          COUNT(DISTINCT seller_address)                AS unique_recipients
        FROM arbitrum.usdc_transfers
        GROUP BY 1
        ORDER BY 1 DESC
      `,
    },
    hourly_stats: {
      sql: `
        SELECT
          DATE_TRUNC('hour', TO_TIMESTAMP(timestamp))   AS hour,
          COUNT(*)                                       AS total_payments,
          SUM(value_usdc)                                AS total_volume_usdc,
          SUM(value_usdc) / 1000000.0                   AS total_volume_usdc_decimal,
          COUNT(DISTINCT buyer_address)                  AS unique_payers,
          COUNT(DISTINCT seller_address)                 AS unique_recipients
        FROM arbitrum.usdc_transfers
        GROUP BY 1
        ORDER BY 1 DESC
      `,
    },
    top_payers: {
      sql: `
        SELECT
          buyer_address,
          COUNT(*)                       AS payment_count,
          SUM(value_usdc)                AS total_volume_usdc,
          SUM(value_usdc) / 1000000.0   AS total_volume_usdc_decimal,
          MIN(timestamp)                 AS first_payment_ts,
          MAX(timestamp)                 AS last_payment_ts,
          COUNT(DISTINCT seller_address) AS unique_recipients_paid
        FROM arbitrum.usdc_transfers
        GROUP BY buyer_address
        ORDER BY total_volume_usdc DESC
      `,
    },
    top_recipients: {
      sql: `
        SELECT
          seller_address,
          COUNT(*)                      AS payment_count,
          SUM(value_usdc)               AS total_revenue_usdc,
          SUM(value_usdc) / 1000000.0  AS total_revenue_usdc_decimal,
          MIN(timestamp)                AS first_payment_ts,
          MAX(timestamp)                AS last_payment_ts,
          COUNT(DISTINCT buyer_address) AS unique_payers
        FROM arbitrum.usdc_transfers
        GROUP BY seller_address
        ORDER BY total_revenue_usdc DESC
      `,
    },
    first_seen_payers: {
      sql: `
        SELECT
          buyer_address,
          MIN(timestamp)                AS first_seen_ts,
          MIN(block_num)                AS first_seen_block,
          COUNT(*)                      AS total_payments,
          SUM(value_usdc) / 1000000.0  AS total_volume_usdc_decimal
        FROM arbitrum.usdc_transfers
        GROUP BY buyer_address
        ORDER BY first_seen_ts ASC
      `,
    },
    first_seen_recipients: {
      sql: `
        SELECT
          seller_address,
          MIN(timestamp)                AS first_seen_ts,
          MIN(block_num)                AS first_seen_block,
          COUNT(*)                      AS total_payments,
          SUM(value_usdc) / 1000000.0  AS total_volume_usdc_decimal
        FROM arbitrum.usdc_transfers
        GROUP BY seller_address
        ORDER BY first_seen_ts ASC
      `,
    },
    raw_transfers: {
      sql: `
        SELECT
          timestamp,
          block_num,
          tx_hash,
          buyer_address,
          seller_address,
          value_usdc,
          value_usdc / 1000000.0       AS value_usdc_decimal,
          nonce
        FROM arbitrum.usdc_transfers
      `,
    },
    new_payers_daily: {
      sql: `
        SELECT
          DATE_TRUNC('day', TO_TIMESTAMP(first_seen_ts)) AS date,
          COUNT(*)                                        AS new_payers
        FROM (
          SELECT buyer_address, MIN(timestamp) AS first_seen_ts
          FROM arbitrum.usdc_transfers
          GROUP BY buyer_address
        )
        GROUP BY 1
        ORDER BY 1 DESC
      `,
    },
    new_recipients_daily: {
      sql: `
        SELECT
          DATE_TRUNC('day', TO_TIMESTAMP(first_seen_ts)) AS date,
          COUNT(*)                                        AS new_recipients
        FROM (
          SELECT seller_address, MIN(timestamp) AS first_seen_ts
          FROM arbitrum.usdc_transfers
          GROUP BY seller_address
        )
        GROUP BY 1
        ORDER BY 1 DESC
      `,
    },
    payer_recipient_pairs: {
      sql: `
        SELECT
          buyer_address,
          seller_address,
          COUNT(*)                      AS payment_count,
          SUM(value_usdc)               AS total_volume_usdc,
          SUM(value_usdc) / 1000000.0  AS total_volume_usdc_decimal,
          MIN(timestamp)                AS first_payment_ts,
          MAX(timestamp)                AS last_payment_ts
        FROM arbitrum.usdc_transfers
        GROUP BY buyer_address, seller_address
        ORDER BY total_volume_usdc DESC
      `,
    },
    payment_size_distribution: {
      sql: `
        SELECT
          CASE
            WHEN value_usdc / 1000000.0 < 0.01   THEN 'micro (<$0.01)'
            WHEN value_usdc / 1000000.0 < 0.10   THEN 'small ($0.01-$0.10)'
            WHEN value_usdc / 1000000.0 < 1.00   THEN 'medium ($0.10-$1.00)'
            WHEN value_usdc / 1000000.0 < 10.00  THEN 'large ($1-$10)'
            WHEN value_usdc / 1000000.0 < 100.00 THEN 'xlarge ($10-$100)'
            ELSE 'whale ($100+)'
          END                           AS size_bucket,
          COUNT(*)                      AS payment_count,
          SUM(value_usdc)               AS total_volume_usdc,
          SUM(value_usdc) / 1000000.0  AS total_volume_usdc_decimal,
          MIN(value_usdc) / 1000000.0  AS min_payment_decimal,
          MAX(value_usdc) / 1000000.0  AS max_payment_decimal,
          AVG(value_usdc) / 1000000.0  AS avg_payment_decimal
        FROM arbitrum.usdc_transfers
        GROUP BY 1
        ORDER BY total_volume_usdc DESC
      `,
    },
    protocol_summary: {
      sql: `
        SELECT
          COUNT(*)                       AS total_payments_all_time,
          SUM(value_usdc)                AS total_volume_usdc_all_time,
          SUM(value_usdc) / 1000000.0   AS total_volume_decimal,
          COUNT(DISTINCT buyer_address)  AS total_unique_payers,
          COUNT(DISTINCT seller_address) AS total_unique_recipients,
          MIN(timestamp)                 AS first_payment_ts,
          MAX(timestamp)                 AS last_payment_ts,
          MAX(block_num)                 AS latest_block
        FROM arbitrum.usdc_transfers
      `,
    },
  },
}))
