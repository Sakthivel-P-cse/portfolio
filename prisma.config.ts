import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 moves connection config out of schema.prisma into here.
// DATABASE_URL = pooled (PgBouncer) URL used by the app at runtime.
// DIRECT_URL   = direct connection used by `prisma migrate` / introspection.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
