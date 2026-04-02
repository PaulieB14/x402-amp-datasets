import { defineDataset } from "@edgeandnode/amp"

// USDC on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
// x402ExactPermit2Proxy on Base: 0x402085c248EeA27D92E8b30b2C58ed07f9E20001

export default defineDataset(() => ({
  namespace: "x402",
  name: "base_mainnet_raw",
  version: "0.3.0",
  description:
    "Raw x402 payment events on Base mainnet. Extracts EIP-3009 (transferWithAuthorization) " +
    "and Permit2 (settle/settleWithPermit) payment flows from USDC and the x402 proxy contracts. " +
    "Includes facilitator address extracted from transaction sender.",
  keywords: ["x402", "raw", "base", "usdc", "eip3009", "permit2", "payments", "facilitator"],
  network: "base-mainnet",
  dependencies: {
    base_rpc: "_/base_rpc@latest",
  },
  tables: {
    // EIP-3009 path: USDC Transfer events paired with AuthorizationUsed
    // facilitator = tx.from (whoever submitted transferWithAuthorization)
    eip3009_transfers: {
      sql: `
        SELECT
          t.timestamp,
          t.block_num,
          evm_decode_hex(t.tx_hash)                        AS tx_hash,
          evm_decode_hex(transfer.from)                     AS buyer_address,
          evm_decode_hex(transfer.to)                       AS seller_address,
          evm_decode_hex(tx.from)                           AS facilitator_address,
          transfer.value                                    AS value_usdc,
          CAST(transfer.value AS DOUBLE) / 1000000.0       AS value_usdc_decimal,
          auth.nonce                                        AS nonce,
          t.log_index                                       AS transfer_log_index,
          'eip3009'                                         AS transfer_method
        FROM (
          SELECT timestamp, block_num, tx_hash, log_index,
            evm_decode_log(topic1, topic2, topic3, data,
              'Transfer(address indexed from, address indexed to, uint256 value)'
            ) AS transfer
          FROM base_rpc.logs
          WHERE address = evm_encode_hex('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
            AND topic0 = evm_topic('Transfer(address indexed from, address indexed to, uint256 value)')
        ) t
        JOIN (
          SELECT tx_hash, block_num, log_index,
            evm_decode_log(topic1, topic2, topic3, data,
              'AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)'
            ) AS auth
          FROM base_rpc.logs
          WHERE address = evm_encode_hex('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
            AND topic0 = evm_topic('AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)')
        ) a
          ON t.tx_hash = a.tx_hash
         AND t.block_num = a.block_num
         AND t.log_index = a.log_index + 1
        JOIN base_rpc.transactions tx
          ON t.tx_hash = tx.tx_hash
         AND t.block_num = tx.block_num
      `,
    },
    // Permit2 path: Settled() events on the x402ExactPermit2Proxy
    // paired with USDC Transfer in the same tx
    // facilitator = tx.from (whoever called settle())
    permit2_transfers: {
      sql: `
        SELECT
          t.timestamp,
          t.block_num,
          evm_decode_hex(t.tx_hash)                        AS tx_hash,
          evm_decode_hex(transfer.from)                     AS buyer_address,
          evm_decode_hex(transfer.to)                       AS seller_address,
          evm_decode_hex(tx.from)                           AS facilitator_address,
          transfer.value                                    AS value_usdc,
          CAST(transfer.value AS DOUBLE) / 1000000.0       AS value_usdc_decimal,
          'settled'                                         AS settlement_type,
          'permit2'                                         AS transfer_method
        FROM (
          SELECT timestamp, block_num, tx_hash, log_index,
            evm_decode_log(topic1, topic2, topic3, data,
              'Transfer(address indexed from, address indexed to, uint256 value)'
            ) AS transfer
          FROM base_rpc.logs
          WHERE address = evm_encode_hex('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
            AND topic0 = evm_topic('Transfer(address indexed from, address indexed to, uint256 value)')
        ) t
        JOIN (
          SELECT tx_hash, block_num
          FROM base_rpc.logs
          WHERE address = evm_encode_hex('0x402085c248EeA27D92E8b30b2C58ed07f9E20001')
            AND topic0 = evm_topic('Settled()')
        ) s
          ON t.tx_hash = s.tx_hash
         AND t.block_num = s.block_num
        JOIN base_rpc.transactions tx
          ON t.tx_hash = tx.tx_hash
         AND t.block_num = tx.block_num
      `,
    },
    // Permit2 path: SettledWithPermit() events (gasless variant)
    // facilitator = tx.from
    permit2_gasless_transfers: {
      sql: `
        SELECT
          t.timestamp,
          t.block_num,
          evm_decode_hex(t.tx_hash)                        AS tx_hash,
          evm_decode_hex(transfer.from)                     AS buyer_address,
          evm_decode_hex(transfer.to)                       AS seller_address,
          evm_decode_hex(tx.from)                           AS facilitator_address,
          transfer.value                                    AS value_usdc,
          CAST(transfer.value AS DOUBLE) / 1000000.0       AS value_usdc_decimal,
          'settled_with_permit'                             AS settlement_type,
          'permit2'                                         AS transfer_method
        FROM (
          SELECT timestamp, block_num, tx_hash, log_index,
            evm_decode_log(topic1, topic2, topic3, data,
              'Transfer(address indexed from, address indexed to, uint256 value)'
            ) AS transfer
          FROM base_rpc.logs
          WHERE address = evm_encode_hex('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
            AND topic0 = evm_topic('Transfer(address indexed from, address indexed to, uint256 value)')
        ) t
        JOIN (
          SELECT tx_hash, block_num
          FROM base_rpc.logs
          WHERE address = evm_encode_hex('0x402085c248EeA27D92E8b30b2C58ed07f9E20001')
            AND topic0 = evm_topic('SettledWithPermit()')
        ) s
          ON t.tx_hash = s.tx_hash
         AND t.block_num = s.block_num
        JOIN base_rpc.transactions tx
          ON t.tx_hash = tx.tx_hash
         AND t.block_num = tx.block_num
      `,
    },
    // Unified view of all x402 transfers (both paths)
    all_transfers: {
      sql: `
        SELECT timestamp, block_num, tx_hash, buyer_address, seller_address,
               facilitator_address, value_usdc, value_usdc_decimal, transfer_method
        FROM self.eip3009_transfers
        UNION ALL
        SELECT timestamp, block_num, tx_hash, buyer_address, seller_address,
               facilitator_address, value_usdc, value_usdc_decimal, transfer_method
        FROM self.permit2_transfers
        UNION ALL
        SELECT timestamp, block_num, tx_hash, buyer_address, seller_address,
               facilitator_address, value_usdc, value_usdc_decimal, transfer_method
        FROM self.permit2_gasless_transfers
      `,
    },
  },
}))
