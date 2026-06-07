import { fetchTip, ampQuery, table } from "@/lib/amp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Status = { tip: number | null; earliest: number | null; error: string | null };

async function getStatus(): Promise<Status> {
  try {
    const tip = await fetchTip();
    const rows = await ampQuery(
      `SELECT MIN(block_num) AS earliest FROM ${table("logs")} WHERE block_num >= 0`,
    );
    return { tip, earliest: Number(rows[0]?.earliest ?? 0), error: null };
  } catch (e: unknown) {
    return { tip: null, earliest: null, error: e instanceof Error ? e.message : String(e) };
  }
}

const ENDPOINTS = [
  { path: "/v1/status", note: "tip + earliest block + span" },
  { path: "/v1/x402/recent?limit=5", note: "5 most recent AuthorizationUsed events" },
  { path: "/v1/x402/daily-stats?from_block=47030000&to_block=47031000", note: "settlement counts bucketed by day" },
  { path: "/v1/x402/top-recipients?from_block=47028000&to_block=47038000&limit=5", note: "top recipients by payment count" },
  {
    path: "/v1/x402/address/0xe9030014f5dae217d0a152f02a043567b16c1abf?from_block=47028000&to_block=47038000",
    note: "as-payer + as-recipient footprint for an address",
  },
];

export default async function Home() {
  const status = await getStatus();

  return (
    <main
      style={{
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        maxWidth: 760,
        margin: "0 auto",
        padding: "48px 24px",
        color: "#0f172a",
        lineHeight: 1.55,
      }}
    >
      <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>x402-watch-amp</h1>
      <p style={{ color: "#64748b", margin: "0 0 32px" }}>
        Live x402 payment activity on Base — REST endpoints over a self-hosted{" "}
        <a href="https://github.com/lodestar-team/amp" style={{ color: "#0369a1" }}>Amp</a> indexer.
      </p>

      <section
        style={{
          background: status.error ? "#fef2f2" : "#f0fdf4",
          border: `1px solid ${status.error ? "#fecaca" : "#bbf7d0"}`,
          borderRadius: 8,
          padding: "16px 20px",
          margin: "0 0 32px",
        }}
      >
        {status.error ? (
          <>
            <strong style={{ color: "#b91c1c" }}>Data source unreachable</strong>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#7f1d1d" }}>
              The ampd backend (self-hosted on a Mac via Cloudflare Tunnel) is currently down or
              the tunnel restarted. UI is up, queries will resume when the source returns.
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#7f1d1d", fontFamily: "ui-monospace, monospace" }}>
              {status.error}
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: "#166534" }}>data source live</div>
            <div style={{ display: "flex", gap: 32, margin: "8px 0 0", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748b" }}>tip block</div>
                <div style={{ fontSize: 20, fontFamily: "ui-monospace, monospace" }}>
                  {status.tip?.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#64748b" }}>earliest block</div>
                <div style={{ fontSize: 20, fontFamily: "ui-monospace, monospace" }}>
                  {status.earliest?.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#64748b" }}>span</div>
                <div style={{ fontSize: 20, fontFamily: "ui-monospace, monospace" }}>
                  {((status.tip ?? 0) - (status.earliest ?? 0)).toLocaleString()} blocks
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <h2 style={{ fontSize: 18, margin: "0 0 12px" }}>Endpoints</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {ENDPOINTS.map((ep) => (
          <li
            key={ep.path}
            style={{
              padding: "12px 0",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <a
              href={ep.path}
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 14,
                color: "#0369a1",
                textDecoration: "none",
                wordBreak: "break-all",
              }}
            >
              GET {ep.path}
            </a>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{ep.note}</div>
          </li>
        ))}
      </ul>

      <p style={{ marginTop: 40, fontSize: 13, color: "#64748b" }}>
        Source:{" "}
        <a
          href="https://github.com/PaulieB14/x402-amp-datasets/tree/main/apps/x402-watch"
          style={{ color: "#0369a1" }}
        >
          PaulieB14/x402-amp-datasets · apps/x402-watch
        </a>
      </p>
    </main>
  );
}
