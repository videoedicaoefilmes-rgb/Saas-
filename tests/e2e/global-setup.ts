import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { e2eEnv } from "../../playwright.config";
import { ensureFixtures } from "../fixtures/videos";

export default function globalSetup() {
  const env = { ...process.env, ...e2eEnv };
  execFileSync("pnpm", ["prisma", "migrate", "deploy"], { env, stdio: "pipe" });
  execFileSync(
    "psql",
    [e2eEnv.DATABASE_URL, "-c", 'TRUNCATE TABLE "users", "app_settings", "audit_logs", "plans", "webhook_events" CASCADE'],
    { stdio: "pipe" },
  );
  rmSync(e2eEnv.STORAGE_LOCAL_DIR, { recursive: true, force: true });
  ensureFixtures();
}
