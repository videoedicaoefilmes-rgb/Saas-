import { defineConfig } from "prisma/config";

// Prisma 7 não carrega .env automaticamente.
try {
  process.loadEnvFile();
} catch {
  // Sem .env (ex.: CI/produção com variáveis injetadas) — segue com o ambiente atual.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
