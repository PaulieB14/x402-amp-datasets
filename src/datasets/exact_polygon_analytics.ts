import { defineDataset } from "@edgeandnode/amp"

export default defineDataset(() => ({
  namespace: "x402",
  name: "exact_polygon_analytics",
  version: "0.1.0",
  description:
    "x402 payment analytics for Polygon mainnet. Daily volume, top payers, " +
    "and top recipients derived from ampersend/exact_polygon_mainnet.",
  keywords: ["x402", "analytics", "polygon", "usdc", "payments", "agentic"],
  sources: ["https://github.com/edgeandnode/ampersend"],
  network: "polygon-mainnet",
  dependencies: {
    polygon: "ampersend/exact_polygon_mainnet@latest",
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
        FROM polygon.usdc_transfers
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
        FROM polygon.usdc_transfers
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
        FROM polygon.usdc_transfers
        GROUP BY seller_address
        ORDER BY total_revenue_usdc DESC
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
        FROM polygon.usdc_transfers
      `,
    },
  },
}))
