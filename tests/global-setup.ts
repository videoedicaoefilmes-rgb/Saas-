import { execFileSync } from "node:child_process";
import { ensureFixtures } from "./fixtures/videos";

export default function setup() {
  process.loadEnvFile(".env.test");
  // Aplica as migrações no banco de testes (separado do banco de desenvolvimento).
  execFileSync("pnpm", ["prisma", "migrate", "deploy"], { stdio: "pipe", env: process.env });
  ensureFixtures();
}
