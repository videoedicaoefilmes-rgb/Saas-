import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { auth } from "@/server/auth";

/** Limpa todas as tabelas de domínio entre testes. */
export async function resetDb(): Promise<void> {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE "exports", "credit_transactions", "processing_jobs", "clips", "media_assets",
      "projects", "credit_wallets", "payments", "subscriptions", "plans", "webhook_events",
      "audit_logs", "app_settings", "sessions", "accounts", "verifications", "users" CASCADE`);
  await rm(path.resolve(getEnv().STORAGE_LOCAL_DIR), { recursive: true, force: true });
}

export async function createUser(opts: { name?: string; email?: string; password?: string } = {}) {
  const email = opts.email ?? `user-${randomUUID().slice(0, 8)}@teste.dev`;
  const password = opts.password ?? "senha-segura-123";
  const res = await auth.api.signUpEmail({ body: { name: opts.name ?? "Usuário Teste", email, password } });
  return { id: res.user.id, email, password };
}

/** Copia um arquivo para o armazenamento local de testes na chave indicada (simula o upload do navegador). */
export async function putLocalObject(key: string, source: string): Promise<void> {
  const dest = path.resolve(getEnv().STORAGE_LOCAL_DIR, key);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(source, dest);
}

export const testFfmpeg = { ffmpegPath: "ffmpeg", ffprobePath: "ffprobe", threads: 2, timeoutMs: 120_000 };
