import { NextResponse } from "next/server";
import { ampQuery, table } from "@/lib/amp";
import { handle } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET() {
  try {
    // Tip + count + earliest. WHERE block_num >= 0 forces a predicated scan
    // so DataFusion can prune; without it, /v1/status is a full table scan
    // and gets very slow on a not-yet-compacted ampd store.
    const rows = await ampQuery(
      `SELECT MAX(block_num) AS tip,
              MIN(block_num) AS earliest
         FROM ${table("logs")}
         WHERE block_num >= 0`,
    );
    const row = (rows[0] ?? {}) as { tip?: number; earliest?: number };
    return NextResponse.json({
      tip_block: row.tip ?? null,
      earliest_block: row.earliest ?? null,
      span_blocks:
        row.tip != null && row.earliest != null ? row.tip - row.earliest + 1 : null,
      dataset: process.env.AMP_DATASET,
    });
  } catch (e) {
    return handle(e);
  }
}
