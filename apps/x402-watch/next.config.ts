import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin workspace root so Turbopack doesn't walk up to ~/package.json
  // (an unrelated old project lives there — see CLAUDE notes).
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
