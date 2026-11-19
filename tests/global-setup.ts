import "dotenv/config";
import { execSync } from "node:child_process";

/** Applies migrations to the test database once per run. `migrate deploy` only applies pending migrations. */
export default function setup() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error("TEST_DATABASE_URL is not set. Start a test database with `npx prisma dev --name papertrail-test` (see README).");
  }
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: testUrl };
  delete env.DATABASE_URL_UNPOOLED;
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
}
