import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "./env";

type Db = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as { __gmPrisma?: Db };

function createClient(): Db {
  const adapter = new PrismaPg({ connectionString: getEnv().DATABASE_URL });
  return new PrismaClient({ adapter });
}

/** Cliente único por processo (reaproveitado entre recarregamentos em desenvolvimento). */
export const db: Db = globalForPrisma.__gmPrisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.__gmPrisma = db;

export type { Db };
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
