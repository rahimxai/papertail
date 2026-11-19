import "dotenv/config";
import { afterAll } from "vitest";

// Point the app's database client at the test database before any test imports it.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is not set.");
process.env.DATABASE_URL = testUrl;
delete process.env.DATABASE_URL_UNPOOLED;

// Close connections gracefully after each file. Local `prisma dev` (PGlite) serves one connection at a time and
// can stay stuck on a connection whose process exited without saying goodbye.
afterAll(async () => {
  const { db } = await import("@/lib/db");
  await db().$disconnect();
});
