import { NextResponse } from "next/server";
import { ampQuery } from "@/lib/amp";
import { handle, ApiError } from "@/lib/errors";
import { guardSql, SQL_MAX_BYTES, SQL_FORCED_LIMIT } from "@/lib/sql-guard";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET() {
  return NextResponse.json({
    endpoint: "/v1/sql",
    method: "POST",
    body: {
      shape: { query: "SELECT ..." },
      alternative: "raw text/plain SQL body works too",
    },
    contract: {
      max_query_bytes: SQL_MAX_BYTES,
      forced_limit: SQL_FORCED_LIMIT,
      timeout_ms: env.AMP_QUERY_TIMEOUT_MS,
      requires: "every query must reference block_num in the WHERE clause",
    },
    available_tables: [`${env.AMP_DATASET}.logs`, `${env.AMP_DATASET}.transactions`, `${env.AMP_DATASET}.blocks`],
    helpful_constants: {
      usdc_base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      authorization_used_topic:
        "0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5",
      transfer_topic:
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    },
    example: `SELECT COUNT(*) AS settlements
FROM "${env.AMP_DATASET}".logs
WHERE block_num BETWEEN 46985000 AND 46985999
  AND address = X'833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  AND topic0 = X'98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5'`,
  });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let raw: string;
    if (contentType.includes("application/json")) {
      const body = (await req.json().catch(() => null)) as { query?: unknown } | null;
      const q = body?.query;
      if (typeof q !== "string")
        throw new ApiError("bad_request", 400, "JSON body must include { query: '...' }");
      raw = q;
    } else {
      raw = await req.text();
    }

    const guard = guardSql(raw);
    if (!guard.ok) {
      return NextResponse.json(
        { error: { code: guard.code, message: guard.message, hint: guard.hint } },
        { status: guard.status },
      );
    }

    const started = Date.now();
    const rows = await ampQuery(guard.sql);
    return NextResponse.json(
      { count: rows.length, rows, elapsed_ms: Date.now() - started },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return handle(e);
  }
}
