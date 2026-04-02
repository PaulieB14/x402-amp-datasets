import { AmpClient } from "@edgeandnode/amp"

const client = new AmpClient({
  url: process.env.AMP_ENDPOINT ?? "http://localhost:8000",
})

const CHAINS = ["base", "ethereum", "polygon", "arbitrum", "optimism"] as const

async function checkChain(chain: string) {
  try {
    const summary = await client.query(
      `SELECT * FROM x402.exact_${chain}_analytics.protocol_summary`
    )
    const row = summary[0]
    console.log(`\n✅ ${chain.toUpperCase()}`)
    console.log(`   Payments:   ${row.total_payments_all_time}`)
    console.log(`   Volume:     $${Number(row.total_volume_decimal).toFixed(2)} USDC`)
    console.log(`   Payers:     ${row.total_unique_payers}`)
    console.log(`   Recipients: ${row.total_unique_recipients}`)
    console.log(`   Latest blk: ${row.latest_block}`)
  } catch (e) {
    console.log(`\n⏭  ${chain.toUpperCase()} — skipped (dataset not available)`)
  }
}

async function run() {
  console.log("=== x402 Multi-Chain Analytics Smoke Test ===")
  for (const chain of CHAINS) {
    await checkChain(chain)
  }
}

run().catch(console.error)
