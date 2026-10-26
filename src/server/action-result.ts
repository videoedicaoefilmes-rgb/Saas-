import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { isAPIError } from "better-auth/api";
import { AppError, GENERIC_ERROR_MESSAGE } from "./errors";
import { logger } from "./logger";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; fields?: Record<string, string> };

export const initialActionState: ActionResult<never> = { ok: true };

const AUTH_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  USER_ALREADY_EXISTS: "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.",
  PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
  PASSWORD_TOO_LONG: "A senha é longa demais.",
  INVALID_TOKEN: "O link de redefinição é inválido ou expirou. Peça um novo.",
  INVALID_EMAIL: "E-mail inválido.",
  INVALID_PASSWORD: "Senha incorreta.",
};

/** Converte qualquer erro em resposta segura; erros inesperados são registrados e ocultados. */
export function toActionError(err: unknown): ActionResult<never> {
  unstable_rethrow(err); // redirect()/notFound() seguem o fluxo normal do Next
  if (err instanceof AppError) return { ok: false, error: err.message };
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: err.issues[0]?.message ?? "Dados inválidos.", fieldErrors };
  }
  if (isAPIError(err)) {
    const code = (err.body as { code?: string } | undefined)?.code ?? "";
    if (err.status === "TOO_MANY_REQUESTS" || err.statusCode === 429) {
      return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
    }
    return { ok: false, error: AUTH_MESSAGES[code] ?? "Não foi possível concluir. Verifique os dados e tente novamente." };
  }
  logger.error({ err }, "Erro inesperado em ação");
  return { ok: false, error: GENERIC_ERROR_MESSAGE };
}

export function formString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

/**
 * O React 19 limpa o formulário após cada envio. Em caso de erro, devolvemos os campos
 * NÃO sensíveis para repreenchê-los (nunca senhas).
 */
export function withFields(result: ActionResult<never>, form: FormData, keys: string[]): ActionResult<never> {
  if (result.ok) return result;
  return { ...result, fields: Object.fromEntries(keys.map((k) => [k, formString(form, k)])) };
}
