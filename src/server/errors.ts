/**
 * Erro de domínio com mensagem segura para o usuário final (pt-BR).
 * Qualquer outro erro é tratado como interno e exibido de forma genérica.
 */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly status: number = statusFor(code),
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INSUFFICIENT_CREDITS"
  | "RATE_LIMITED"
  | "PRICE_CHANGED"
  | "UNAVAILABLE";

function statusFor(code: AppErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION":
      return 400;
    case "CONFLICT":
    case "PRICE_CHANGED":
      return 409;
    case "INSUFFICIENT_CREDITS":
      return 402;
    case "RATE_LIMITED":
      return 429;
    case "UNAVAILABLE":
      return 503;
  }
}

/** Recurso inexistente OU de outro usuário — mesma resposta, para não revelar existência (anti-IDOR). */
export function notFound(what = "Recurso"): AppError {
  return new AppError("NOT_FOUND", `${what} não encontrado.`);
}

export const GENERIC_ERROR_MESSAGE = "Algo deu errado. Tente novamente em instantes.";

export function toUserMessage(err: unknown): string {
  return err instanceof AppError ? err.message : GENERIC_ERROR_MESSAGE;
}
