# Status

Last touched: 2026-06-07 morning.

## What works

All 5 endpoints, smoke-tested green against local ampd, sub-3s on 50k-block windows:

- `GET /v1/status`
- `GET /v1/x402/recent?limit=N`
- `GET /v1/x402/daily-stats?from_block&to_block`
- `GET /v1/x402/top-recipients?from_block&to_block&limit`
- `GET /v1/x402/address/{addr}?from_block&to_block`
- `GET/POST /v1/sql` (guarded raw SQL)

## How to start

```bash
# 1. ampd at port 1603 (see ~/amp-test or /Volumes/ExtremeSSD/amp-x402/ampd.toml)
ps | grep "ampd solo"

# 2. dev server
cd ~/x402-watch-amp
PORT=3030 npm run dev

# 3. smoke test
curl http://localhost:3030/v1/status
```

## What's next

- [ ] Push to a new GitHub repo `PaulieB14/x402-watch-amp` (NOT into x402-amp-datasets — that repo is for dataset definitions, this is a runtime app)
- [ ] Deploy: either Cloudflare Tunnel from Mac (free, easy) or Railway with ampd co-located (paid, durable)
- [ ] Real amount decoding in `/v1/x402/top-recipients` — currently returns payment_count only
- [ ] Tune ampd's `write_concurrency` from 4 → 6 — overnight monitor showed compactor at ~80% of ingest throughput, growing file count from 6.8k → 20.6k in 11h

## Gotchas baked in

- `src/app/v1/x402/address/[addr]/route.ts` uses **two parallel queries**, NOT UNION ALL. DataFusion in ampd 0.0.36 panics on UNION ALL + IN-subquery on the same logical table.
- `src/app/v1/x402/top-recipients/route.ts` does NOT compute USDC amounts. The `arrow_cast(bytes, 'Utf8')` approach crashes; need substr-based uint256 decode.
- `.env.local`'s `AMP_QUERY_TIMEOUT_MS=60000` is generous — drop to 15000 once ampd is fully steady-state.

## Related

- Local ampd: `/Volumes/ExtremeSSD/amp-x402/ampd.toml` — compactor config lives at `[writer.compactor]`, NOT top-level `[compactor]` (silently ignored).
- Stale sibling: `https://x402-watch.vercel.app/ask` reads R2 parquets that stopped updating 2026-06-03. This scaffold is the live-tip replacement.
- Sibling repo (different concern): `https://github.com/PaulieB14/x402-amp-datasets` — Amp dataset definitions, compiled and shipped as parquets via CI.
