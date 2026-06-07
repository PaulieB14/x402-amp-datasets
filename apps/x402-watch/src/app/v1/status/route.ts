import { NextResponse } from "next/server";
import { ampQuery, table } from "@/lib/amp";
import { handle } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 20;

// In-memory cache for status. Tip is cheap (parquet stats), earliest is not
// (forces full-file scan), so cache earliest aggressively and refresh tip
// per-request.
let earliestCache: { value: number; at: number } | null = null;
const EARLIEST_TTL_MS = 5 * 60 * 1000;

export async function GET() {
  try {
    // Tip — no WHERE clause so DataFusion uses parquet footer stats
    // for MAX. Fast even on a non-compacted store.
    const tipRows = await ampQuery(`SELECT MAX(block_num) AS tip FROM ${table("logs")}`);
    const tip = Number((tipRows[0] as { tip?: number })?.tip ?? 0) || null;

    // Earliest — only fetch if cache is cold. The first request after a
    // deploy takes ~2-5s; subsequent requests within 5 min are instant.
    let earliest: number | null = earliestCache?.value ?? null;
    const cacheCold = !earliestCache || Date.now() - earliestCache.at > EARLIEST_TTL_MS;
    if (cacheCold) {
      try {
        const eRows = await ampQuery(
          `SELECT MIN(block_num) AS earliest FROM ${table("logs")}`,
        );
        const e = Number((eRows[0] as { earliest?: number })?.earliest ?? 0);
        if (e > 0) {
          earliest = e;
          earliestCache = { value: e, at: Date.now() };
        }
      } catch {
        // If earliest fails, ship tip anyway — clients usually only need tip
      }
    }

    return NextResponse.json(
      {
        tip_block: tip,
        earliest_block: earliest,
        span_blocks: tip != null && earliest != null ? tip - earliest + 1 : null,
        dataset: process.env.AMP_DATASET,
      },
      {
        headers: {
          // Cache at Vercel edge for 30s, serve stale for up to 5 min while
          // refreshing in background. Survives ampd compaction stalls.
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
        },
      },
    );
  } catch (e) {
    return handle(e);
  }
}
