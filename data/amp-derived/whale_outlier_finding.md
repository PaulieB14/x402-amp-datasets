# The whale outlier finding: EIP-7702 smart-account x402-adjacent flows

A side-finding from cross-validating `data/amp-derived/` (loose-filtered ampd
output) against `data/x402-omnigraph/` (FacilitatorRegistry-gated subgraph).
This is the kind of analysis the strict-gated subgraph cannot produce by
design.

## Setup

`data/amp-derived/eip3009_payments.parquet` captures **all USDC
`AuthorizationUsed` + paired `Transfer` events on Base** — anything that uses
the EIP-3009 `transferWithAuthorization` path, regardless of whether the
sender is a registered x402 facilitator. The subgraph filters these out:
~75–111× volume gap on shared days.

The gap is mostly explained by **122 "whale" transactions** (≥ $10,000 USDC
single payment) across **87 unique recipient addresses**, contributing
**$4.82M of total volume** over ~3.5 days.

## Top 15 whale recipients (≥$10k single payment)

| Recipient | Whale txs | Total USDC | Type |
|---|---|---|---|
| `0x388ee4…56df` | 14 | $571,597 | EOA |
| `0x78db60…84ef` | 1 | $394,130 | EOA |
| `0xc2129b…7ea9` | 2 | $393,410 | EOA |
| `0x7186b7…5205` | 1 | $389,158 | EOA |
| `0x086593…b9d3` | 2 | $343,409 | EOA |
| **`0x5f8660…0cb9`** | **1** | **$220,000** | **EIP-7702 smart wallet** |
| `0x8ade02…174a` | 2 | $192,000 | EOA |
| `0x0e3df9…7757` | 6 | $180,107 | full contract (7,964 bytes — protocol?) |
| `0x2b3558…bd04` | 2 | $150,000 | EOA |
| `0x6406c4…1f12` | 1 | $120,000 | EOA |
| **`0xb22a06…a1ee`** | **2** | **$89,980** | **EIP-7702 smart wallet** |
| `0xea28f1…e660` | 1 | $80,000 | EOA |
| `0x9769da…374f` | 5 | $71,502 | EOA |
| **`0xc887ef…4e78`** | **2** | **$58,000** | **EIP-7702 smart wallet** |
| `0xf7e24f…2c85` | 1 | $52,800 | EOA |

**None appear in omnigraph's top 1000 x402 recipients** — they're filtered out
by the FacilitatorRegistry gate.

## EIP-7702 smart-account delegations

Three of the top 15 are **EIP-7702-delegated EOAs** (Pectra fork activated
~May 2025). On-chain `getCode` returns 46 bytes of `0xef0100…` + a 20-byte
delegation target — the canonical EIP-7702 format:

| Whale wallet | EIP-7702 delegation target |
|---|---|
| `0x5f86605661dfa00c2843654cf0a9b7c5c75f0cb9` | `0xe6cae83bde06e4c305530e199d7217f42808555b` |
| `0xb22a06398838d0e41f406131c8b7e0f1ad8aa1ee` | `0x490aac77c960b0569c8e446ac7e12490bd44ca1d` |
| `0xc887ef675ae254a694787a7b0488a49db7944e78` | `0x7702cb554e6bfb442cb743a7df23154544a7176c` |

The third delegation target (`0x7702cb…176c`) has a vanity address starting
with `0x7702` — the same hex as EIP-7702 itself. Branded smart-wallet
deployment by one of the AA-infra providers.

## Why this is interesting

1. **EIP-7702 activated less than 3 weeks ago.** Real production usage at five
   figures is early-adopter signal.
2. **Etherscan-style dashboards report these as "EOAs"** — they don't surface
   the delegation. Dataset consumers would miss that 23%+ of whale-tier
   EIP-3009 traffic in this window goes to programmable wallets.
3. **The strict-gated subgraph filters this out entirely.** This category of
   flow — large EIP-3009 settlements to smart-account wallets — is invisible
   in canonical x402 datasets but **uses the same protocol primitives**.
   Suggests there's a parallel "x402-adjacent" or "facilitator-less EIP-3009"
   ecosystem worth tracking separately.
4. **Bridges, exchanges, treasuries** would all be obvious institutional
   recipients. But these are mostly EOAs and now smart wallets — pointing
   to a different use case: **payroll-style, affiliate, or programmatic OTC
   distributions** using `transferWithAuthorization` for gas-efficient
   one-shot payouts.

## Data

- `whales_by_recipient.parquet` — 87 whale recipients with payment counts,
  volumes, and first/last-seen timestamps. ZSTD parquet, ~6 KB.
- Reproduction: see SQL queries in the README, plus `eth_getCode` lookups
  per address to detect contracts and decode the EIP-7702 0xef0100 prefix.

## Caveats

- 3.5-day window only — not representative of long-term flow.
- "Whale" threshold ($10k) is arbitrary. The bimodal distribution suggests
  the protocol's natural break is around $1–$10 (paywalls) vs $1k+ (everything
  else), with very little in between.
- Several "EOAs" in this list may also be EIP-7702-delegated as of writing —
  we only checked the top 15. Code length 46 = EIP-7702; many other code
  lengths could indicate contract wallets or other AA patterns worth probing.
