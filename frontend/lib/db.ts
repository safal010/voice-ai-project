import { Pool } from "pg";

// Keep one pool alive during development, so hot reloads don't open new ones.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}