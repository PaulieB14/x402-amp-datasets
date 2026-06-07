import {
  AddressLookup,
  LiveFeed,
  SqlPlayground,
  StatsStrip,
  TopRecipients,
} from "@/components/Dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "56px 24px 80px",
      }}
    >
      <header style={{ marginBottom: 40 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            background: "rgba(34,211,238,0.08)",
            border: "1px solid rgba(34,211,238,0.2)",
            borderRadius: 999,
            fontSize: 11,
            color: "#22d3ee",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#22d3ee",
              boxShadow: "0 0 8px #22d3ee",
              animation: "x402glow 2s ease-in-out infinite",
            }}
          />
          self-hosted amp · live tip
        </div>
        <h1
          style={{
            fontSize: 52,
            fontWeight: 800,
            margin: 0,
            background: "linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
          }}
        >
          x402-watch
          <span
            style={{
              background: "linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            -amp
          </span>
        </h1>
        <p
          style={{
            fontSize: 18,
            color: "#94a3b8",
            margin: "16px 0 0",
            maxWidth: 640,
            lineHeight: 1.55,
          }}
        >
          Real-time x402 payment activity on Base, served from a self-hosted{" "}
          <a
            href="https://github.com/lodestar-team/amp"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#22d3ee", textDecoration: "none", borderBottom: "1px solid rgba(34,211,238,0.3)" }}
          >
            Amp
          </a>{" "}
          indexer on a Mac Mini, queried over a Cloudflare Tunnel.
        </p>
      </header>

      <StatsStrip />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
          gap: 20,
        }}
      >
        <LiveFeed />
        <TopRecipients />
      </div>

      <AddressLookup />
      <SqlPlayground />

      <footer
        style={{
          marginTop: 60,
          paddingTop: 24,
          borderTop: "1px solid rgba(56,189,248,0.1)",
          fontSize: 12,
          color: "#475569",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span>
          source ·{" "}
          <a
            href="https://github.com/PaulieB14/x402-amp-datasets/tree/main/apps/x402-watch"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#94a3b8", textDecoration: "none" }}
          >
            PaulieB14/x402-amp-datasets/apps/x402-watch
          </a>
        </span>
        <span>
          engine ·{" "}
          <a
            href="https://engine.camp"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#94a3b8", textDecoration: "none" }}
          >
            inspired by lodestar-team/camp
          </a>
        </span>
      </footer>
    </main>
  );
}
