"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type RecentRow = {
  block_num: number;
  timestamp: string;
  tx_hash: string;
  authorizer: string;
  nonce: string;
};
type RecipientRow = { recipient_topic: string; payment_count: number };
type AddrFootprint = {
  address: string;
  from_block: number;
  to_block: number;
  as_payer: { count: number; first_block: number | null; last_block: number | null };
  as_recipient: { count: number; first_block: number | null; last_block: number | null };
  elapsed_ms: number;
};
type StatusRow = {
  tip_block: number | null;
  earliest_block: number | null;
  span_blocks: number | null;
  source_status?: "live" | "rebuilding";
};

function topicToAddress(topic: string): string {
  const stripped = topic.replace(/^0x/, "");
  if (stripped.length === 64) return "0x" + stripped.slice(24);
  return "0x" + stripped;
}
function shortAddr(addr: string, head = 6, tail = 4): string {
  const a = addr.startsWith("0x") ? addr : "0x" + addr;
  return a.length > head + tail + 1 ? `${a.slice(0, head)}…${a.slice(-tail)}` : a;
}
function shortHash(h: string): string {
  return h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h;
}
function timeAgo(iso: string): string {
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}

// Shared styles
const mono: React.CSSProperties = { fontFamily: '"JetBrains Mono", ui-monospace, monospace' };
const card: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(15,23,42,0.6) 0%, rgba(15,23,42,0.4) 100%)",
  border: "1px solid rgba(56,189,248,0.12)",
  borderRadius: 14,
  padding: 24,
  margin: "20px 0",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};
const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#94a3b8",
  margin: 0,
  textTransform: "uppercase",
  letterSpacing: "0.15em",
};

function PulseDot({ color = "#10b981" }: { color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 12px ${color}, 0 0 4px ${color}`,
        animation: "x402pulse 1.6s ease-in-out infinite",
      }}
    />
  );
}

type SourceStatus = "live" | "rebuilding" | "unreachable";

export function StatsStrip() {
  const [tip, setTip] = useState<number | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());
  const [status, setStatus] = useState<SourceStatus>("rebuilding");
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const s: StatusRow = await fetch("/v1/status", { cache: "no-store" }).then((r) =>
        r.json(),
      );
      setTip(s.tip_block);
      setStatus(s.source_status === "rebuilding" ? "rebuilding" : s.tip_block ? "live" : "rebuilding");
      if (s.tip_block) {
        const to = s.tip_block;
        const from = Math.max(0, to - 43200);
        try {
          const daily = await fetch(
            `/v1/x402/daily-stats?from_block=${from}&to_block=${to}`,
            { cache: "no-store" },
          ).then((r) => r.json());
          const total = (daily.buckets ?? []).reduce(
            (sum: number, b: { settlements: number }) => sum + b.settlements,
            0,
          );
          setTodayCount(total);
        } catch {
          // keep previous count
        }
      }
      setUpdatedAt(Date.now());
    } catch {
      setStatus("unreachable");
    }
  }, []);

  useEffect(() => {
    refresh();
    // Polls every 60s — Vercel edge caches /v1/status for 30s, so the
    // dashboard hits ampd at most once per 30s window even with many
    // concurrent visitors.
    const id = setInterval(refresh, 60_000);
    const tickId = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      clearInterval(id);
      clearInterval(tickId);
    };
  }, [refresh]);

  const sinceUpdate = Math.round((Date.now() - updatedAt) / 1000);
  void tick;

  const statusInfo: Record<SourceStatus, { color: string; label: string }> = {
    live: { color: "#10b981", label: "live from base mainnet" },
    rebuilding: { color: "#f59e0b", label: "indexer compacting — data may be stale" },
    unreachable: { color: "#ef4444", label: "data source unreachable" },
  };
  const si = statusInfo[status];

  return (
    <>
      {status === "rebuilding" && (
        <div
          style={{
            background: "linear-gradient(90deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: 10,
            padding: "12px 18px",
            fontSize: 13,
            color: "#fbbf24",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#f59e0b",
              boxShadow: "0 0 10px #f59e0b",
              animation: "x402pulse 1.6s ease-in-out infinite",
              flexShrink: 0,
            }}
          />
          <span>
            <strong>indexer rebuilding indices</strong> — ampd is running a large compaction merge. live
            data will resume in a few minutes. retrying every 60s.
          </span>
        </div>
      )}
      <div
        style={{
          ...card,
          padding: 0,
          overflow: "hidden",
          marginTop: 0,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr",
          }}
        >
          <StatCell
            label="tip block"
            value={tip?.toLocaleString() ?? "…"}
            sub={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <PulseDot color={si.color} />
                {si.label}
              </span>
            }
          />
          <StatCell
            label="payments last 24h"
            value={todayCount?.toLocaleString() ?? "…"}
            accent="#22d3ee"
            sub="USDC settlements via x402"
          />
          <StatCell
            label="last refresh"
            value={`${sinceUpdate}s`}
            sub="auto every 60s"
            muted
          />
        </div>
      </div>
    </>
  );
}

function StatCell({
  label,
  value,
  accent,
  muted,
  sub,
}: {
  label: string;
  value: string;
  accent?: string;
  muted?: boolean;
  sub?: React.ReactNode;
}) {
  return (
    <div style={{ padding: "28px 32px", borderRight: "1px solid rgba(56,189,248,0.08)" }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </div>
      <div
        style={{
          ...mono,
          fontSize: 36,
          color: muted ? "#475569" : accent ?? "#f8fafc",
          fontWeight: 700,
          lineHeight: 1,
          textShadow: accent ? `0 0 20px ${accent}40` : "none",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 10 }}>{sub}</div>
    </div>
  );
}

export function LiveFeed() {
  const [rows, setRows] = useState<RecentRow[]>([]);
  const [newBlocks, setNewBlocks] = useState<Set<number>>(new Set());
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/v1/x402/recent?limit=10", { cache: "no-store" });
      const data = await res.json();
      setError(false);
      setRows((prev) => {
        const prevTop = prev[0]?.block_num ?? 0;
        const incoming: RecentRow[] = data.rows ?? [];
        const fresh = new Set<number>();
        for (const r of incoming) if (r.block_num > prevTop) fresh.add(r.block_num);
        if (fresh.size > 0) {
          setNewBlocks(fresh);
          setTimeout(() => setNewBlocks(new Set()), 1800);
        }
        return incoming;
      });
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Polls every 10s — edge cache holds 5s, real ampd hit at most every 5s.
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={sectionTitle}>● live activity</h2>
        <span style={{ fontSize: 11, color: "#475569", letterSpacing: "0.05em" }}>
          {error ? "● disconnected" : "every 10s"}
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["block", "time", "authorizer", "tx"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderBottom: "1px solid rgba(56,189,248,0.1)",
                    fontWeight: 500,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "#64748b",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={4} style={{ padding: 20, color: "#475569", textAlign: "center" }}>
                  waiting for data…
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={4} style={{ padding: 20, color: "#ef4444", textAlign: "center" }}>
                  data source unreachable
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const flash = newBlocks.has(r.block_num);
              return (
                <tr
                  key={`${r.tx_hash}-${r.nonce}`}
                  style={{
                    background: flash
                      ? "linear-gradient(90deg, rgba(16,185,129,0.22) 0%, rgba(16,185,129,0.05) 100%)"
                      : "transparent",
                    transition: "background 1.8s",
                  }}
                >
                  <td style={tdStyle}>
                    <span style={{ ...mono, color: "#e2e8f0" }}>{r.block_num.toLocaleString()}</span>
                  </td>
                  <td style={{ ...tdStyle, color: "#64748b" }}>{timeAgo(r.timestamp)}</td>
                  <td style={tdStyle}>
                    <span style={{ ...mono, color: "#22d3ee" }}>
                      {shortAddr(topicToAddress(r.authorizer))}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <a
                      href={`https://basescan.org/tx/0x${r.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...mono, color: "#a78bfa", textDecoration: "none" }}
                    >
                      {shortHash("0x" + r.tx_hash)} ↗
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "12px 12px",
  borderBottom: "1px solid rgba(56,189,248,0.05)",
};

export function TopRecipients() {
  const [rows, setRows] = useState<RecipientRow[]>([]);
  const [windowBlocks, setWindowBlocks] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const status: StatusRow = await fetch("/v1/status", { cache: "no-store" }).then((r) =>
        r.json(),
      );
      if (status.tip_block == null) return; // indexer not ready
      const to = status.tip_block;
      const from = Math.max(0, to - 10_000);
      const res = await fetch(
        `/v1/x402/top-recipients?from_block=${from}&to_block=${to}&limit=8`,
        { cache: "no-store" },
      ).then((r) => r.json());
      setRows(res.rows ?? []);
      setWindowBlocks(to - from);
    } catch {
      // keep last good
    }
  }, []);

  useEffect(() => {
    refresh();
    // Polls every 60s — edge cache holds 30s.
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.payment_count)), [rows]);

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={sectionTitle}>● top recipients</h2>
        <span style={{ fontSize: 11, color: "#475569", letterSpacing: "0.05em" }}>
          {windowBlocks ? `last ${windowBlocks.toLocaleString()} blocks` : "loading…"}
        </span>
      </div>
      {rows.length === 0 && <div style={{ color: "#475569", padding: 16 }}>loading…</div>}
      {rows.map((r, i) => {
        const pct = (r.payment_count / max) * 100;
        const addr = topicToAddress(r.recipient_topic);
        const rank = i + 1;
        const hue = i === 0 ? "#22d3ee" : i === 1 ? "#a78bfa" : "#475569";
        return (
          <div
            key={addr}
            style={{
              display: "grid",
              gridTemplateColumns: "32px 140px 1fr 100px",
              alignItems: "center",
              gap: 16,
              padding: "12px 0",
              borderBottom: "1px solid rgba(56,189,248,0.05)",
              fontSize: 13,
            }}
          >
            <span
              style={{
                ...mono,
                color: hue,
                textAlign: "right",
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              #{rank}
            </span>
            <span style={{ ...mono, color: "#e2e8f0", fontSize: 12 }}>{shortAddr(addr)}</span>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: "rgba(56,189,248,0.06)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${pct}%`,
                  borderRadius: 4,
                  background: `linear-gradient(90deg, ${hue}66 0%, ${hue} 100%)`,
                  boxShadow: i === 0 ? `0 0 16px ${hue}66` : "none",
                  transition: "width 0.6s",
                }}
              />
            </div>
            <span
              style={{
                ...mono,
                color: "#f8fafc",
                textAlign: "right",
                fontWeight: 600,
              }}
            >
              {r.payment_count.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AddressLookup() {
  const [addr, setAddr] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AddrFootprint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setError(null);
    setResult(null);
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr.trim())) {
      setError("address must be 0x + 40 hex chars");
      return;
    }
    setLoading(true);
    try {
      const status: StatusRow = await fetch("/v1/status", { cache: "no-store" }).then((r) =>
        r.json(),
      );
      if (status.tip_block == null) {
        setError("indexer rebuilding — try again in a few minutes");
        return;
      }
      const to = status.tip_block;
      const from = Math.max(0, to - 50_000);
      const res = await fetch(
        `/v1/x402/address/${addr.trim()}?from_block=${from}&to_block=${to}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error.message ?? "lookup failed");
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [addr]);

  return (
    <div style={card}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={sectionTitle}>● address lookup</h2>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="0xe9030014f5dae217d0a152f02a043567b16c1abf"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{
            flex: 1,
            padding: "12px 16px",
            background: "rgba(15,23,42,0.6)",
            border: "1px solid rgba(56,189,248,0.2)",
            borderRadius: 8,
            fontSize: 13,
            color: "#f8fafc",
            outline: "none",
            ...mono,
          }}
        />
        <button
          onClick={submit}
          disabled={loading}
          style={{
            padding: "12px 24px",
            background: loading
              ? "rgba(34,211,238,0.3)"
              : "linear-gradient(135deg, #22d3ee 0%, #0ea5e9 100%)",
            color: "#0a0e1a",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: loading ? "none" : "0 4px 16px rgba(34,211,238,0.3)",
          }}
        >
          {loading ? "querying…" : "lookup"}
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>
        scans the last 50,000 blocks (~28h). press enter to submit.
      </div>
      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            color: "#fca5a5",
            padding: 14,
            borderRadius: 8,
            marginTop: 16,
            fontSize: 13,
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          {error}
        </div>
      )}
      {result && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 18 }}>
          <FootprintCard
            label="as payer"
            count={result.as_payer.count}
            firstBlock={result.as_payer.first_block}
            lastBlock={result.as_payer.last_block}
            color="#a78bfa"
          />
          <FootprintCard
            label="as recipient"
            count={result.as_recipient.count}
            firstBlock={result.as_recipient.first_block}
            lastBlock={result.as_recipient.last_block}
            color="#22d3ee"
          />
        </div>
      )}
    </div>
  );
}

function FootprintCard({
  label,
  count,
  firstBlock,
  lastBlock,
  color,
}: {
  label: string;
  count: number;
  firstBlock: number | null;
  lastBlock: number | null;
  color: string;
}) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${color}0a 0%, ${color}02 100%)`,
        padding: 20,
        borderRadius: 10,
        border: `1px solid ${color}22`,
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </div>
      <div
        style={{
          ...mono,
          fontSize: 36,
          fontWeight: 700,
          marginTop: 6,
          color: count > 0 ? color : "#475569",
          textShadow: count > 0 ? `0 0 16px ${color}40` : "none",
          lineHeight: 1,
        }}
      >
        {count.toLocaleString()}
      </div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
        events
        {firstBlock && lastBlock && (
          <>
            {" · "}
            <span style={mono}>
              {firstBlock.toLocaleString()}–{lastBlock.toLocaleString()}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function SqlPlayground() {
  const [open, setOpen] = useState(false);
  const [sql, setSql] = useState(
    `-- count x402 payments in a 1000-block window\nSELECT COUNT(*) AS payments\nFROM "_/base_mainnet@2.0.0".logs\nWHERE block_num >= 47030000 AND block_num <= 47031000\n  AND address = X'833589fcd6edb6e08f4c7c32d4f71b54bda02913'\n  AND topic0 = X'98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5'`,
  );
  const [result, setResult] = useState<unknown[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const run = useCallback(async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    const t0 = performance.now();
    try {
      const res = await fetch("/v1/sql", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: sql,
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error.message ?? "query failed");
        return;
      }
      setResult(data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setElapsed(Math.round(performance.now() - t0));
    }
  }, [sql]);

  return (
    <div style={card}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          color: "#94a3b8",
          ...sectionTitle,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ color: "#22d3ee" }}>{open ? "▼" : "▶"}</span> sql playground
      </button>
      {open && (
        <>
          <p style={{ fontSize: 12, color: "#64748b", margin: "12px 0 14px" }}>
            arbitrary SQL against the ampd dataset. requires{" "}
            <code style={{ background: "rgba(56,189,248,0.1)", padding: "2px 6px", borderRadius: 3, color: "#22d3ee" }}>
              block_num
            </code>{" "}
            in WHERE. capped at 1000 rows.
          </p>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            spellCheck={false}
            style={{
              width: "100%",
              minHeight: 140,
              padding: 14,
              background: "rgba(2,6,23,0.6)",
              border: "1px solid rgba(56,189,248,0.15)",
              borderRadius: 8,
              fontSize: 12,
              ...mono,
              resize: "vertical",
              boxSizing: "border-box",
              color: "#e2e8f0",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
            <button
              onClick={run}
              disabled={loading}
              style={{
                padding: "10px 24px",
                background: loading
                  ? "rgba(167,139,250,0.3)"
                  : "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 600,
                boxShadow: loading ? "none" : "0 4px 16px rgba(167,139,250,0.3)",
              }}
            >
              {loading ? "running…" : "run query"}
            </button>
            {elapsed !== null && (
              <span style={{ fontSize: 11, color: "#64748b", ...mono }}>{elapsed}ms</span>
            )}
          </div>
          {error && (
            <pre
              style={{
                background: "rgba(239,68,68,0.08)",
                color: "#fca5a5",
                padding: 14,
                borderRadius: 8,
                marginTop: 14,
                fontSize: 12,
                overflowX: "auto",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              {error}
            </pre>
          )}
          {result && (
            <pre
              style={{
                background: "rgba(2,6,23,0.6)",
                padding: 14,
                borderRadius: 8,
                marginTop: 14,
                fontSize: 12,
                overflowX: "auto",
                maxHeight: 360,
                color: "#22d3ee",
                border: "1px solid rgba(56,189,248,0.1)",
                ...mono,
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
