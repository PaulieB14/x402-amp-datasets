#!/usr/bin/env bash
# Pull a fresh snapshot of x402 activity from the x402-omnigraph subgraph
# and write parquet files into data/x402-omnigraph/.
#
# Requirements:
#   - $GRAPH_API_KEY (gateway key from thegraph.com/studio/apikeys)
#   - python3
#   - duckdb in PATH (brew install duckdb on macOS, or curl install on Linux)
#   - curl
#
# Run locally: GRAPH_API_KEY=xxx ./scripts/refresh-x402-omnigraph.sh
# Run in CI: invoked from .github/workflows/refresh-x402-data.yml

set -euo pipefail

if [[ -z "${GRAPH_API_KEY:-}" ]]; then
  echo "ERROR: GRAPH_API_KEY env var is required" >&2
  exit 1
fi

SUBGRAPH_ID="Cb56epg3EvQ6JRpPfknbkM54QxpzTvLa7mwKNQQfUyoj"  # x402 Base, see data/x402-omnigraph/README.md
SUBGRAPH_URL="https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/${SUBGRAPH_ID}"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/data/x402-omnigraph"
mkdir -p "$OUT_DIR"
cd "$OUT_DIR"

gql() {
  local query="$1"
  curl -fsS -X POST -H "Content-Type: application/json" \
    --data "{\"query\":\"$(printf '%s' "$query" | tr -d '\n' | sed 's/"/\\"/g')\"}" \
    "$SUBGRAPH_URL"
}

extract_rows() {
  local file="$1"
  local key="$2"
  python3 - "$file" "$key" <<'PY'
import json, sys
path, key = sys.argv[1], sys.argv[2]
d = json.load(open(path))
rows = d.get("data", {}).get(key, [])
out = path.replace(".json", ".ndjson")
with open(out, "w") as f:
    for r in rows:
        fac = r.pop("facilitator", None) if "facilitator" in r else None
        if fac:
            r["facilitator_id"] = fac.get("id")
            r["facilitator_name"] = fac.get("name")
        f.write(json.dumps(r) + "\n")
print(f"{key}: {len(rows)} rows", file=sys.stderr)
PY
}

echo "→ querying meta..."
META=$(gql '{ _meta { block { number timestamp } hasIndexingErrors deployment } }')
echo "$META" | python3 -m json.tool > _meta.json
BLOCK=$(python3 -c "import json; print(json.load(open('_meta.json'))['data']['_meta']['block']['number'])")
echo "  subgraph at block $BLOCK"

echo "→ daily_stats (all days)..."
gql '{ x402DailyStats(first: 1000, orderBy: date, orderDirection: desc) { id date totalPayments totalVolume totalVolumeDecimal eip3009Payments permit2Payments } }' > daily_stats.json
extract_rows daily_stats.json x402DailyStats

echo "→ facilitators (all, active+inactive)..."
gql '{ facilitators(first: 1000, orderBy: totalSettlements, orderDirection: desc) { id address name userDefined_url isActive addedAtBlock addedAtTimestamp removedAtBlock removedAtTimestamp totalSettlements totalVolume totalVolumeDecimal } }' > facilitators.json
extract_rows facilitators.json facilitators

echo "→ top 1000 recipients by volume..."
gql '{ x402AddressSummaries(first: 1000, where: { role: RECIPIENT }, orderBy: totalVolume, orderDirection: desc) { id address role totalPayments totalVolume totalVolumeDecimal firstPaymentTimestamp lastPaymentTimestamp } }' > top_recipients.json
extract_rows top_recipients.json x402AddressSummaries

echo "→ top 1000 payers by volume..."
gql '{ x402AddressSummaries(first: 1000, where: { role: PAYER }, orderBy: totalVolume, orderDirection: desc) { id address role totalPayments totalVolume totalVolumeDecimal firstPaymentTimestamp lastPaymentTimestamp } }' > top_payers.json
extract_rows top_payers.json x402AddressSummaries

echo "→ latest 1000 payments..."
gql '{ x402Payments(first: 1000, orderBy: blockNumber, orderDirection: desc) { id blockNumber blockTimestamp transactionHash from to amount amountDecimal asset assetSymbol nonce transferMethod chainId network facilitator { id name } } }' > recent_payments.json
extract_rows recent_payments.json x402Payments

echo "→ converting to parquet..."
for f in daily_stats facilitators top_recipients top_payers recent_payments; do
  duckdb -c "COPY (SELECT * FROM read_ndjson_auto('${f}.ndjson')) TO '${f}.parquet' (FORMAT PARQUET, COMPRESSION ZSTD)"
done

echo "→ cleanup intermediate files..."
rm -f *.ndjson _meta.json

echo "→ summary:"
duckdb -c "
SELECT 'daily_stats' AS table, COUNT(*) AS rows FROM 'daily_stats.parquet' UNION ALL
SELECT 'facilitators', COUNT(*) FROM 'facilitators.parquet' UNION ALL
SELECT 'top_recipients', COUNT(*) FROM 'top_recipients.parquet' UNION ALL
SELECT 'top_payers', COUNT(*) FROM 'top_payers.parquet' UNION ALL
SELECT 'recent_payments', COUNT(*) FROM 'recent_payments.parquet'
"

echo "✓ refresh complete — synced to subgraph block $BLOCK"
