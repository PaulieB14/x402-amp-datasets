# Amp self-host test — results

A 24-hour stress test of the full Amp self-hosting stack: a personal Mac Mini
running `ampd`, indexing real Base mainnet via paid RPC, with the goal of
deploying the TypeScript dataset definitions in this repo and producing live
x402 analytics. This document captures what we set out to validate, what we
actually found, and what we'd do differently next time.

## The brief

1. Can a non-Edge-and-Node user stand up Amp on consumer hardware?
2. Can the dataset definitions in `src/datasets/` deploy against that daemon?
3. Can the resulting parquet output match the canonical x402 dataset
   (the [x402-omnigraph subgraph](https://github.com/PaulieB14/x402-omnigraph))?
4. What's the realistic cost / time profile for someone wanting to repeat this?

## What worked

| Component | Result |
|---|---|
| `ampd v0.0.35` install on macOS arm64 (Apple Silicon) | ✅ Native binary via `ampup.sh`, no Docker, no Linux VM |
| Postgres metadata store | ✅ Existing Homebrew `postgresql@15` used as-is |
| Raw chain dataset registration (`_/base_mainnet@1.0.0` and `@2.0.0`) | ✅ Via `ampctl manifest generate` + `register` + `deploy` |
| Multi-vendor RPC discovery | ✅ Verified DRPC archive route works for `eth_getBlockReceipts`; documented which free providers do not (`mainnet.base.org`, `publicnode` for archive) |
| 7-day Base backfill via `ampd` | 🟡 Partial — `~54% complete` at time of writing; throttled by sink contention |
| JSON Lines query endpoint | ✅ POST SQL to `:1603`, get rows back, sub-second latency on indexed data |
| Substreams sink → parquet on disk | ✅ End-to-end via `substreams-sink-files`, multi-vendor (GM + Pinax tested) |
| GitHub Actions daily-refresh of subgraph data | ✅ Workflow runs nightly, commits diffs automatically |
| Cross-validation against the omnigraph subgraph | ✅ Revealed a real analytical finding (see below) |

## What didn't work (and why it matters)

### 1. SDK / daemon protocol skew

The TypeScript dataset framework `@edgeandnode/amp` on npm is at **v0.0.55+**.
The publicly-released `ampd` binary caps at **v0.0.35**. The protocol between
them is incompatible:

```
$ npx amp build --admin-url http://localhost:1610
ManifestBuilderError: Failed to get schemas
RequestError: Transport error (POST http://localhost:1610/schema)
TypeError: fetch failed
InvalidArgumentError: invalid content-length header
```

`ampup install latest` / `install vX.Y.Z` for any version > v0.0.35 returns 404
because the GitHub `edgeandnode/amp` release page caps at v0.0.35. The
intermediate versions (v0.0.36 → v0.0.55) exist on npm but not as binary
releases.

**Practical impact**: the developer experience `amp build` → `amp deploy` →
`amp query` documented in this repo's README does not work today against any
publicly-available daemon. Lodestar Dashboard (the only known third-party
production Amp user) sidesteps this entirely by posting SQL strings directly
to the daemon's JSON Lines endpoint — and that is what this test ended up
doing too.

### 2. Free-tier RPC archive routing for non-trivial workloads

`mainnet.base.org` doesn't support `eth_getBlockReceipts` at all. `publicnode`
supports the method but only for recent blocks (no archive). `Alchemy` free
tier rate-limits too aggressively for `ampd`'s burst pattern.

The only setup that gave **archive + sustained throughput on a free key** was
DRPC's Growth plan ($13/mo). Even then, ~40–75% of `eth_getBlockReceipts`
calls returned 0-receipt responses (the load balancer occasionally routing
to non-archive replicas). `ampd` retries cleanly but the net throughput
dropped from a theoretical ~12 b/s to a sustained ~4–5 b/s.

### 3. Substreams package store-init-block design

The [`x402-base-pulse`](https://substreams.dev/packages/x402-base-pulse/v3.0.0)
package (also authored by the repo owner) sets its store `initial_block` to
**25,000,000** — USDC's Base deployment. But x402's FacilitatorRegistry
doesn't deploy until block **30,011,612**, so the first ~5M blocks scanned
produce **zero rows**. On the Substreams free tier's 7M processed-blocks/month
cap, this means roughly the first 70% of monthly budget is spent on
guaranteed-empty work.

**Practical impact**: a single free-tier month gets us only ~1–2 weeks past
x402 launch. Three months of monthly resets needed to cover full x402
history. Or $100 for one month of Substreams Scaling tier to do it in <1 day.

## Cross-validation finding

The test cross-checked three independent x402 datasets for shared days:

| Source | Daily payments (2026-05-19) | Daily USDC volume |
|---|---|---|
| **`data/amp-derived/`** (self-hosted ampd, loose SQL filter) | 93,094 | **$3.10M** |
| **`data/x402-omnigraph/`** (subgraph, strict FacilitatorRegistry-gated) | 64,838 | **$27.8k** |

**The volume gap is 100× and reveals a definitional issue, not a bug:**

- `amp-derived` matches "all USDC `AuthorizationUsed` events with a paired
  `Transfer` in the same tx" — captures the entire EIP-3009 surface,
  including OTC desks, bridges, and exchange settlements that use
  `transferWithAuthorization` for gas efficiency but aren't x402 payments.
- `x402-omnigraph` matches "EIP-3009 settlements where `tx.from` is in the
  on-chain `FacilitatorRegistry`" — the actual x402 protocol definition.

Empirically the gap is dominated by **1,016 "whale" transactions ≥ $1k that
contribute 88% of `amp-derived`'s total volume** — these are clearly
institutional moves, not x402 retail payments. Full breakdown:
[`data/amp-derived/amp_vs_omnigraph_validation.md`](data/amp-derived/amp_vs_omnigraph_validation.md).

**Conclusion**: for x402-specific analytics, use omnigraph or the Substreams
package (both gate via FacilitatorRegistry). For "all on-chain EIP-3009
USDC activity" (a superset), use the loose ampd query.

## Cost summary for the test

| Line item | Cost | Notes |
|---|---|---|
| Mac Mini (existing) | $0 | Apple Silicon, 16 GB RAM, plenty for `ampd v0.0.35` |
| External SSD (existing) | $0 | 1 TB Samsung T7 |
| Homebrew Postgres (existing) | $0 | Pre-installed |
| **DRPC Growth** | **$13** | One month subscription, cancelable |
| **Substreams Graph Market free tier** | **$0** | 7M processed blocks/month (mostly burned on pre-x402 zone) |
| **Substreams Pinax free tier** | **$0** | Tested, $25/mo of compute reserved for next month's restart |
| **GitHub Actions** | **$0** | Free on public repos |
| **Total** | **$13** | For ~3.5 days of backfilled Base + full lifetime omnigraph + 6.1M blocks of substreams progress |

## If you're going to repeat this

1. **Skip the SDK.** Don't `npx amp build/deploy`. Just `ampctl manifest
   generate` to register the raw chain dataset, then post SQL directly to
   the daemon's `:1603` JSON Lines endpoint. Lodestar's pattern, this repo's
   pattern.
2. **Pick your strictness up front.** If you want x402-specific data, use the
   FacilitatorRegistry-gated approach (subgraph or Substreams package). If
   you want the broad EIP-3009 surface, the loose SQL JOIN suffices.
3. **For Base specifically: DRPC Growth.** It's the only free-or-cheap option
   that supports both `eth_getBlockReceipts` AND archive. Even with the ~40%
   misroute issue, it works.
4. **Substreams free tier ≠ scaling tier for time-sensitive work.** Free
   covers 1–2 weeks of x402 history per month. $100/mo Scaling for one
   month does the full backfill in hours. If you need it now, pay; if you
   can wait 3 months, free works.
5. **The subgraph already won.** [`x402-omnigraph`](https://github.com/PaulieB14/x402-omnigraph)
   is queried for $0 against The Graph Network, gives you full lifetime
   data instantly, refreshes automatically. The Amp test exists to validate
   the alternatives — it's not what you reach for if you just want data.

## What's still cooking

At the time this document was written, two backfills are still running:

- `ampd` 7-day Base backfill: ~54.7% complete, slowed dramatically by network
  contention with the parallel Substreams sink. Will eventually complete; the
  parquet at `data/amp-derived/` can be regenerated then.
- Substreams sink (GM free tier): chunk 59 / ~165 expected before budget cap.
  May exhaust free tier today, June 1 resumes from cursor in `state.yaml`.

Neither finishing is required for the conclusions above to hold.
