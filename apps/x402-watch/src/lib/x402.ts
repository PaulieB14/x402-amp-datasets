// x402 protocol constants on Base mainnet.
// USDC contract + EIP-3009 + ERC-20 Transfer event signatures used to
// identify x402 settlements in raw EVM log data.

import { env } from "./env";
import { hexLiteral, addressAsTopic, table } from "./amp";

// USDC on Base mainnet.
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// EIP-3009 events.
// keccak256("AuthorizationUsed(address,bytes32)")
export const AUTHORIZATION_USED_TOPIC =
  "0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5";

// keccak256("Transfer(address,address,uint256)") — ERC-20 standard
export const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// Reusable SQL predicates for x402-shaped events on USDC/Base.
export const PREDICATES = {
  usdcAuthorizationUsed: () =>
    `address = ${hexLiteral(USDC_BASE)} AND topic0 = ${hexLiteral(AUTHORIZATION_USED_TOPIC)}`,
  usdcTransfer: () =>
    `address = ${hexLiteral(USDC_BASE)} AND topic0 = ${hexLiteral(TRANSFER_TOPIC)}`,
};

// In the AuthorizationUsed event, topic1 is the authorizer (= payer).
// In the Transfer event, topic1 is `from` and topic2 is `to`.
// All are 32-byte indexed values with the actual 20-byte address in the lower bytes.

export function authorizerIsTopic(addr: string): string {
  return `topic1 = ${addressAsTopic(addr)}`;
}

export function recipientIsTopic(addr: string): string {
  return `topic2 = ${addressAsTopic(addr)}`;
}

export function fromIsTopic(addr: string): string {
  return `topic1 = ${addressAsTopic(addr)}`;
}

export function logsTable(): string {
  return table("logs");
}

export function datasetVersion(): string {
  return env.AMP_DATASET;
}
