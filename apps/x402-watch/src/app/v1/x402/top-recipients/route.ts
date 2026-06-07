import { NextResponse } from "next/server";
import { ampQuery, fetchTip } from "@/lib/amp";
import { handle, ApiError } from "@/lib/errors";
import { PREDICATES, logsTable } from "@/lib/x402";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET /v1/x402/top-recipients?from_block=&to_block=&limit=
//
// Aggregates x402-shaped Transfers (those in the same tx as a USDC
// AuthorizationUsed) by recipient (topic2), counts and sums amount.
//
// Note: we approximate "x402-shaped" by JOIN on tx_hash with AuthorizationUsed.
// Result excludes plain USDC transfers that aren't EIP-3009-authorized.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 25), 100);
    const toParam = searchParams.get("to_block");
    const toBlock = toParam != null ? Number(toParam) : await fetchTip();
    const fromParam = searchParams.get("from_block");
    const fromBlock = fromParam != null ? Number(fromParam) : Math.max(0, toBlock - 50_000);

    if (!Number.isFinite(fromBlock) || !Number.isFinite(toBlock) || fromBlock > toBlock)
      throw new ApiError("bad_request", 400, "from_block/to_block invalid");

    // Transfer event: topic2 = recipient, data = amount (uint256 big-endian).
    // Filter to txs that also emitted AuthorizationUsed in the same block range.
    const sql = `
      WITH auth AS (
        SELECT tx_hash
        FROM ${logsTable()}
        WHERE block_num BETWEEN ${fromBlock} AND ${toBlock}
          AND ${PREDICATES.usdcAuthorizationUsed()}
      ),
      transfers AS (
        SELECT t.topic2 AS recipient_topic
        FROM ${logsTable()} t
        INNER JOIN auth a ON a.tx_hash = t.tx_hash
        WHERE t.block_num BETWEEN ${fromBlock} AND ${toBlock}
          AND ${PREDICATES.usdcTransfer()}
      )
      SELECT recipient_topic,
             COUNT(*) AS payment_count
      FROM transfers
      GROUP BY recipient_topic
      ORDER BY payment_count DESC
      LIMIT ${limit}
    `;
    const started = Date.now();
    const rows = await ampQuery(sql);
    return NextResponse.json({
      from_block: fromBlock,
      to_block: toBlock,
      count: rows.length,
      rows,
      elapsed_ms: Date.now() - started,
    });
  } catch (e) {
    return handle(e);
  }
}
