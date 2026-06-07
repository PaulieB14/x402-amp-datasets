import { NextResponse } from "next/server";
import { ampQuery, fetchTip } from "@/lib/amp";
import { handle, ApiError } from "@/lib/errors";
import { PREDICATES, logsTable } from "@/lib/x402";

export const runtime = "nodejs";
export const maxDuration = 20;

// GET /v1/x402/recent?from_block=&to_block=&limit=
//
// Returns the N most-recent USDC AuthorizationUsed events in a block window.
// AuthorizationUsed is x402's canonical settlement signal — every EIP-3009
// transferWithAuthorization emits it once.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
    const toParam = searchParams.get("to_block");
    const toBlock = toParam != null ? Number(toParam) : await fetchTip();
    const fromParam = searchParams.get("from_block");
    const fromBlock = fromParam != null ? Number(fromParam) : Math.max(0, toBlock - 10_000);

    if (!Number.isFinite(fromBlock) || !Number.isFinite(toBlock) || fromBlock > toBlock)
      throw new ApiError("bad_request", 400, "from_block/to_block invalid");

    const sql = `
      SELECT block_num, timestamp, tx_hash, topic1 AS authorizer, topic2 AS nonce
      FROM ${logsTable()}
      WHERE block_num BETWEEN ${fromBlock} AND ${toBlock}
        AND ${PREDICATES.usdcAuthorizationUsed()}
      ORDER BY block_num DESC
      LIMIT ${limit}
    `;
    const started = Date.now();
    const rows = await ampQuery(sql);
    return NextResponse.json(
      {
        from_block: fromBlock,
        to_block: toBlock,
        count: rows.length,
        rows,
        elapsed_ms: Date.now() - started,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=5, stale-while-revalidate=60",
        },
      },
    );
  } catch (e) {
    return handle(e);
  }
}
