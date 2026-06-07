# x402-watch-amp

Thin REST API over a local ampd node, exposing x402 settlement analytics
on Base mainnet. Architecturally lifted from
[lodestar-team/camp](https://github.com/lodestar-team/camp) — same
`text/plain SQL → ampd JSONL` integration pattern, scoped to x402.

## Setup

```bash
cp .env.local.example .env.local
# AMP_ORIGIN should already point at http://localhost:1603 if ampd is
# running with `ampd solo --jsonl-server`. Adjust AMP_DATASET if your
# registered Base dataset is at a different version.
npm install
npm run dev
# open http://localhost:3000/v1/status
```

## Endpoints

| Path | Purpose |
|---|---|
| `GET /v1/status` | Tip block, earliest block, span. Sanity check. |
| `POST /v1/sql` | Public guarded SQL endpoint (forces `block_num` predicate, 1000-row cap). |
| `GET /v1/sql` | Self-describing usage payload. |
| `GET /v1/x402/recent` | Most recent x402 settlements (AuthorizationUsed events). |
| `GET /v1/x402/top-recipients` | Top recipients of x402-shaped Transfers in a block window. |
| `GET /v1/x402/address/{addr}` | x402 footprint for one address (as_payer + as_recipient). |
| `GET /v1/x402/daily-stats` | Daily AuthorizationUsed counts in a block window. |

## Architecture

```
HTTP request → Next.js route handler → ampQuery(sql) → POST localhost:1603 → JSONL rows → JSON response
```

The whole integration is `src/lib/amp.ts` — ~70 lines. Everything else
is route handlers that build SQL from URL params.

## Known caveats

- `top-recipients` decodes the Transfer amount via a placeholder `CAST(bytea→DOUBLE)`. Replace with `evm_decode_log` once the right signature is wired in.
- The "x402-shaped Transfer" filter joins on `tx_hash`. Non-EIP-3009 USDC transfers are excluded — matches the x402 Base subgraph's curation, but be aware it's narrower than "all USDC traffic."
- ampd's small-parquet backlog (post-restart, pre-compaction) makes some queries slow. Tune `AMP_QUERY_TIMEOUT_MS` and watch ampd's RSS / CPU.

## Why this exists vs querying ampd directly

- Type safety on URL params (zod).
- One place to keep x402 constants (USDC contract, EIP-3009 topics).
- HTTP/JSON consumers don't have to learn DataFusion SQL.
- Same Vercel deploy story as the original x402-watch — set AMP_ORIGIN to a tunnel URL and ship.
