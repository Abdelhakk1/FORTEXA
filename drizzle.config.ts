import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Use session mode (port 5432) for migrations — needs direct connection
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
