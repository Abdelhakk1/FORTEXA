import { readFile, realpath } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local", quiet: true });

const migrationPath = process.argv[2];

if (!migrationPath) {
  throw new Error("Usage: node scripts/apply-db-migration.mjs <migration.sql>");
}

const projectRoot = process.cwd();
const migrationsDir = await realpath(resolve(projectRoot, "src/db/migrations"));
const resolvedPath = await realpath(resolve(projectRoot, migrationPath));
const relativePath = relative(migrationsDir, resolvedPath);

if (relativePath.startsWith("..") || relativePath === "") {
  throw new Error("Migration path must be inside src/db/migrations.");
}

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

const sqlText = await readFile(resolvedPath, "utf8");
const sql = postgres(databaseUrl, {
  prepare: false,
  max: 1,
});

try {
  await sql.unsafe(sqlText);
  console.log(
    JSON.stringify({
      result: "applied",
      migration: `src/db/migrations/${relativePath}`,
    })
  );
} finally {
  await sql.end();
}
