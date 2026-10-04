import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (the embedded Postgres used locally when DATABASE_URL is unset)
  // ships WASM and data files it loads from its own package directory, so it
  // must be required natively rather than bundled. `pg` is externalised by
  // Next already.
  serverExternalPackages: ["@electric-sql/pglite"],
  // SQL migrations are read from disk at startup (src/server/db/migrate.ts);
  // make sure they ship with the server output.
  outputFileTracingIncludes: {
    "/**": ["./db/migrations/**/*"],
  },
};

export default nextConfig;
