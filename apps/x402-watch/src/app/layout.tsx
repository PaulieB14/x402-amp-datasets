export const metadata = {
  title: "x402-watch-amp · live Base activity",
  description: "Real-time x402 payment activity on Base, served from a self-hosted Amp indexer.",
};

const globalStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    background:
      radial-gradient(ellipse 60% 80% at 50% -10%, rgba(34,211,238,0.15) 0%, transparent 60%),
      radial-gradient(ellipse 80% 50% at 100% 100%, rgba(167,139,250,0.1) 0%, transparent 60%),
      linear-gradient(180deg, #050810 0%, #0a0e1a 100%);
    background-attachment: fixed;
    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
  ::selection { background: rgba(34,211,238,0.3); }
  input:focus {
    border-color: rgba(34,211,238,0.5) !important;
    box-shadow: 0 0 0 3px rgba(34,211,238,0.1);
  }
  textarea:focus {
    border-color: rgba(34,211,238,0.4) !important;
    box-shadow: 0 0 0 3px rgba(34,211,238,0.08);
  }
  @keyframes x402pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
  }
  @keyframes x402glow {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
