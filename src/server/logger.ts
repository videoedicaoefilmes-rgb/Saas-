import pino from "pino";

/**
 * Logs estruturados (JSON). Regras:
 * - Nunca registrar senhas, tokens, URLs assinadas ou conteúdo de vídeo.
 * - Identificar usuários por ID, não por e-mail/nome.
 * - Usar `correlationId` (ID do processamento) para seguir uma tarefa entre web e worker.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: process.env.SERVICE_NAME ?? "web" },
  redact: {
    paths: ["password", "*.password", "token", "*.token", "url", "*.url", "email", "*.email", "headers.cookie"],
    censor: "[omitido]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
