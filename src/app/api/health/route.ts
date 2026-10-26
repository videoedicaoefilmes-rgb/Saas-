import { db } from "@/server/db";
import { getRedis } from "@/server/queue";

/** Verificação de saúde para o orquestrador/balanceador. Não expõe detalhes internos. */
export async function GET() {
  const checks = await Promise.allSettled([db.$queryRaw`SELECT 1`, getRedis().ping()]);
  const ok = checks.every((c) => c.status === "fulfilled");
  return Response.json({ status: ok ? "ok" : "degraded" }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
