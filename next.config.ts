/** Configuration Next.js du POC Blog Maker (React Compiler, Sanity UI / styled-components). */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  // Peer de @sanity/ui — accélère SSR / hydrate des styles runtime restants (v4).
  compiler: {
    styledComponents: true,
  },
};

export default nextConfig;
