import { NextResponse } from "next/server";
import { ampQuery, fetchTip } from "@/lib/amp";
import { handle, ApiError } from "@/lib/errors";
import {
  PREDICATES,
  logsTable,
  authorizerIsTopic,
  recipientIsTopic,
} from "@/lib/x402";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET /v1/x402/address/{addr}?from_block=&to_block=
//
// x402 footprint for a single address over a block window.
//   - as_payer:     count of AuthorizationUsed where topic1 = address
//   - as_recipient: count of x402-shaped Transfers where topic2 = address
//   - first/last block seen as either role
//
// Mirrors the shape of GA's /onchain-x402/address subgraph endpoint, but
// computed from raw ampd logs (no subgraph dependency).
export async function GET(
  req: Request,
  ctx: { params: Promise<{ addr: string }> },
) {
  try {
    const { addr } = await ctx.params;
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr))
      throw new ApiError("bad_request", 400, "addr must be a 20-byte 0x hex address");

    const { searchParams } = new URL(req.url);
    const toParam = searchParams.get("to_block");
    const toBlock = toParam != null ? Number(toParam) : await fetchTip();
    const fromParam = searchParams.get("from_block");
    const fromBlock = fromParam != null ? Number(fromParam) : Math.max(0, toBlock - 100_000);

    if (!Number.isFinite(fromBlock) || !Number.isFinite(toBlock) || fromBlock > toBlock)
      throw new ApiError("bad_request", 400, "from_block/to_block invalid");

    // Two parallel queries, merged in JS. Avoids a DataFusion planner edge
    // case where UNION ALL + IN-subquery on the same logical table closes the
    // TCP connection without an error response.
    const payerSql = `
      SELECT COUNT(*) AS cnt,
             MIN(block_num) AS first_block,
             MAX(block_num) AS last_block
      FROM ${logsTable()}
      WHERE block_num BETWEEN ${fromBlock} AND ${toBlock}
        AND ${PREDICATES.usdcAuthorizationUsed()}
        AND ${authorizerIsTopic(addr)}
    `;
    const recipientSql = `
      WITH auth AS (
        SELECT tx_hash FROM ${logsTable()}
        WHERE block_num BETWEEN ${fromBlock} AND ${toBlock}
          AND ${PREDICATES.usdcAuthorizationUsed()}
      )
      SELECT COUNT(*) AS cnt,
             MIN(t.block_num) AS first_block,
             MAX(t.block_num) AS last_block
      FROM ${logsTable()} t
      INNER JOIN auth a ON a.tx_hash = t.tx_hash
      WHERE t.block_num BETWEEN ${fromBlock} AND ${toBlock}
        AND ${PREDICATES.usdcTransfer()}
        AND ${recipientIsTopic(addr)}
    `;

    const started = Date.now();
    const [payerRows, recipientRows] = await Promise.all([
      ampQuery(payerSql),
      ampQuery(recipientSql),
    ]);
    const payer = payerRows[0];
    const recipient = recipientRows[0];
    return NextResponse.json({
      address: addr.toLowerCase(),
      from_block: fromBlock,
      to_block: toBlock,
      as_payer: {
        count: payer?.cnt ?? 0,
        first_block: payer?.first_block ?? null,
        last_block: payer?.last_block ?? null,
      },
      as_recipient: {
        count: recipient?.cnt ?? 0,
        first_block: recipient?.first_block ?? null,
        last_block: recipient?.last_block ?? null,
      },
      elapsed_ms: Date.now() - started,
    });
  } catch (e) {
    return handle(e);
  }
}
