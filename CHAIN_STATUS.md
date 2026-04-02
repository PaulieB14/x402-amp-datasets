# Chain Status

| Chain     | Raw RPC Dataset          | x402 Raw Extraction          | Analytics     | Notes |
|-----------|-------------------------|------------------------------|---------------|-------|
| Base      | `_/base_rpc@latest`     | `x402/base_mainnet_raw`     | 15 tables     | EIP-3009 + Permit2 + facilitator |
| Ethereum  | `_/eth_rpc@latest`      | Pending                      | Template ready | Confirm dataset registered |
| Polygon   | `_/polygon_rpc@latest`  | Pending                      | Template ready | Confirm dataset registered |
| Arbitrum  | `_/arbitrum_rpc@latest` | Pending                      | Template ready | Confirm dataset registered |
| Optimism  | `_/optimism_rpc@latest` | Pending                      | Template ready | Confirm dataset registered |

## Architecture

```
Amp raw EVM data (_/base_rpc)
  → x402 raw extraction (x402/base_mainnet_raw)
    - eip3009_transfers: AuthorizationUsed + Transfer joins
    - permit2_transfers: Settled() + Transfer joins
    - permit2_gasless_transfers: SettledWithPermit() + Transfer joins
    - all_transfers: unified view of all paths
  → x402 analytics (x402/exact_base_analytics)
    - 13 tables: daily/hourly stats, top payers/recipients, growth curves, etc.
```

## Contract Addresses (Base)

| Contract | Address |
|---|---|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| x402ExactPermit2Proxy | `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` |
