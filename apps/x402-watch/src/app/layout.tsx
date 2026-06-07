export const metadata = {
  title: "x402-watch-amp",
  description: "Live x402 payment activity on Base, served from a self-hosted Amp indexer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fafafa" }}>{children}</body>
    </html>
  );
}
