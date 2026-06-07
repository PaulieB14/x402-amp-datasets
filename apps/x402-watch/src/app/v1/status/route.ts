import { NextResponse } from "next/server";
import { ampQuery, table } from "@/lib/amp";

export const runtime = "nodejs";
export const maxDuration = 15;

let earliestCache: { value: number; at: number } | null = null;
const EARLIEST_TTL_MS = 5 * 60 * 1000;

// Run a query with a hard timeout, return null instead of throwing. We never
// want /v1/status to return 5xx — the UI uses the response to render the
// "live" indicator, and a fast 200 with null fields beats a slow 504.
async function ampQueryOrNull<T = unknown>(sql: string, timeoutMs: number): Promise<T[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const rows = await ampQuery(sql, controller.signal);
    return rows as T[];
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  // 7s hard cap — well under Vercel's 15s function limit, lets us still
  // populate the earliest cache with a slower second query if tip succeeded.
  const tipRows = await ampQueryOrNull<{ tip?: number }>(
    `SELECT MAX(block_num) AS tip FROM ${table("logs")}`,
    7000,
  );
  const tip = tipRows ? Number(tipRows[0]?.tip ?? 0) || null : null;

  let earliest: number | null = earliestCache?.value ?? null;
  const cacheCold = !earliestCache || Date.now() - earliestCache.at > EARLIEST_TTL_MS;
  if (cacheCold && tip != null) {
    const eRows = await ampQueryOrNull<{ earliest?: number }>(
      `SELECT MIN(block_num) AS earliest FROM ${table("logs")}`,
      5000,
    );
    const e = eRows ? Number(eRows[0]?.earliest ?? 0) : 0;
    if (e > 0) {
      earliest = e;
      earliestCache = { value: e, at: Date.now() };
    }
  }

  // Source status: indexer is "live" only if tip query succeeded
  const source_status = tip != null ? "live" : "rebuilding";

  return NextResponse.json(
    {
      tip_block: tip,
      earliest_block: earliest,
      span_blocks: tip != null && earliest != null ? tip - earliest + 1 : null,
      dataset: process.env.AMP_DATASET,
      source_status,
    },
    {
      headers: {
        "Cache-Control":
          source_status === "live"
            ? "public, s-maxage=30, stale-while-revalidate=300"
            : // While rebuilding, cache aggressively so we don't hammer ampd
              "public, s-maxage=60, stale-while-revalidate=600",
      },
    },
  );
}
