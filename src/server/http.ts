import { ZodError } from "zod";
import { AppError, GENERIC_ERROR_MESSAGE } from "./errors";
import { getEnv } from "./env";
import { logger } from "./logger";

export function jsonError(err: unknown): Response {
  if (err instanceof AppError) return Response.json({ error: err.message, code: err.code }, { status: err.status });
  if (err instanceof ZodError) return Response.json({ error: err.issues[0]?.message ?? "Dados inválidos.", code: "VALIDATION" }, { status: 400 });
  logger.error({ err }, "Erro inesperado em rota");
  return Response.json({ error: GENERIC_ERROR_MESSAGE, code: "INTERNAL" }, { status: 500 });
}

/**
 * Defesa contra CSRF nas rotas que alteram estado: exige que a requisição venha da
 * própria aplicação (cabeçalho Origin). Server Actions já têm checagem equivalente no Next.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const allowed = new URL(getEnv().APP_URL).origin;
  const self = new URL(request.url).origin;
  if (!origin || (origin !== allowed && origin !== self)) {
    throw new AppError("FORBIDDEN", "Origem da requisição não permitida.");
  }
}

export const noStore = { "Cache-Control": "private, no-store" };
