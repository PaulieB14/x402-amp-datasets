// Public /v1/sql guard. Lifted from camp's sql-guard.ts, scoped tighter
// because this server only exposes x402-relevant tables.

const FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern:
      /\b(?:insert|update|delete|drop|create|alter|truncate|grant|revoke|copy|attach|detach|use|set|reset|begin|commit|rollback|savepoint)\b/i,
    reason: "only SELECT statements are allowed",
  },
  {
    pattern:
      /\b(?:read_csv|read_parquet|read_json|read_avro|read_ndjson|read_file|read_table|to_csv|to_parquet|to_json)\s*\(/i,
    reason: "file-IO functions are not allowed",
  },
  {
    pattern: /\b(?:pg_[a-z_]+|information_schema)\b/i,
    reason: "system catalogs are not allowed",
  },
  {
    pattern: /\b(?:load\s+extension|attach\s+database|using\s+csv)\b/i,
    reason: "engine loaders are not allowed",
  },
  {
    pattern: /\binto\s+outfile\b|\binto\s+dumpfile\b/i,
    reason: "file-write clauses are not allowed",
  },
  { pattern: /--|\/\*|\*\//, reason: "SQL comments are not allowed" },
  {
    pattern: /;[\s\S]*\S/,
    reason: "only one statement per request (no semicolon separator)",
  },
];

const REQUIRED_BLOCK_NUM = /\bblock_num\b/i;
const STARTS_WITH_SELECT = /^\s*(?:with\b[\s\S]+?\bselect\b|select\b)/i;
const LIMIT_PRESENT = /\blimit\s+\d+\b/i;

export const SQL_MAX_BYTES = 4096;
export const SQL_FORCED_LIMIT = 1000;

export type SqlGuardResult =
  | { ok: true; sql: string }
  | { ok: false; status: number; code: string; message: string; hint?: string };

export function guardSql(raw: string): SqlGuardResult {
  let sql = raw.trim();
  if (sql.endsWith(";")) sql = sql.slice(0, -1).trimEnd();

  if (sql.length === 0)
    return { ok: false, status: 400, code: "empty_query", message: "query is empty" };
  if (sql.length > SQL_MAX_BYTES)
    return {
      ok: false,
      status: 413,
      code: "query_too_large",
      message: `query exceeds ${SQL_MAX_BYTES} bytes`,
    };
  if (!STARTS_WITH_SELECT.test(sql))
    return {
      ok: false,
      status: 400,
      code: "not_select",
      message: "only SELECT (or WITH ... SELECT) is allowed",
    };
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(sql))
      return { ok: false, status: 400, code: "forbidden_form", message: reason };
  }
  if (!REQUIRED_BLOCK_NUM.test(sql))
    return {
      ok: false,
      status: 400,
      code: "missing_block_num_filter",
      message: "every query must reference block_num in WHERE (range-bounded scans only)",
      hint: "add `WHERE block_num BETWEEN <a> AND <b>` to bound the scan",
    };
  if (!LIMIT_PRESENT.test(sql)) sql = `${sql} LIMIT ${SQL_FORCED_LIMIT}`;

  return { ok: true, sql };
}
