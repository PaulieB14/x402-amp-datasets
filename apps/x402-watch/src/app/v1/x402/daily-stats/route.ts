import { NextResponse } from "next/server";
import { ampQuery, fetchTip } from "@/lib/amp";
import { handle, ApiError } from "@/lib/errors";
import { PREDICATES, logsTable } from "@/lib/x402";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET /v1/x402/daily-stats?from_block=&to_block=
//
// Daily AuthorizationUsed counts in the requested block window. Bucketed
// by date(timestamp). Useful for time-series charts.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const toParam = searchParams.get("to_block");
    const toBlock = toParam != null ? Number(toParam) : await fetchTip();
    const fromParam = searchParams.get("from_block");
    const fromBlock = fromParam != null ? Number(fromParam) : Math.max(0, toBlock - 50_000);

    if (!Number.isFinite(fromBlock) || !Number.isFinite(toBlock) || fromBlock > toBlock)
      throw new ApiError("bad_request", 400, "from_block/to_block invalid");

    const sql = `
      SELECT date_trunc('day', timestamp) AS bucket_day,
             COUNT(*) AS settlements
      FROM ${logsTable()}
      WHERE block_num BETWEEN ${fromBlock} AND ${toBlock}
        AND ${PREDICATES.usdcAuthorizationUsed()}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    const started = Date.now();
    const rows = await ampQuery(sql);
    return NextResponse.json({
      from_block: fromBlock,
      to_block: toBlock,
      buckets: rows,
      elapsed_ms: Date.now() - started,
    });
  } catch (e) {
    return handle(e);
  }
}
