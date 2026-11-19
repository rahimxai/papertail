import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and follow the README.");
  }
  // Serverless functions each hold their own pool, so keep it small; Neon's pooler handles fan-in.
  // Local `prisma dev` (PGlite) serves one connection at a time, so .env sets DATABASE_POOL_MAX=1 there.
  const max = Number(process.env.DATABASE_POOL_MAX ?? 5);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max }) });
}

// Created lazily so `next build` can import modules without a database connection.
export function db(): PrismaClient {
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}
