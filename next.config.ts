import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (Postgres embebido en WASM) y pg no deben pasar por el bundler.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
