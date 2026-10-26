import nodemailer, { type Transporter } from "nodemailer";
import { getEnv } from "./env";
import { logger } from "./logger";

export type MailMessage = { to: string; subject: string; text: string; html?: string };

/** Caixa de saída em memória — usada pelos testes automatizados para ler e-mails enviados. */
export const testOutbox: MailMessage[] = [];

let transport: Transporter | null = null;

export async function sendMail(message: MailMessage): Promise<void> {
  const env = getEnv();
  if (env.NODE_ENV === "test") {
    testOutbox.push(message);
    return;
  }
  if (env.MAIL_DRIVER === "console") {
    // Somente desenvolvimento (bloqueado em produção pela validação do ambiente).
    logger.info({ subject: message.subject }, "E-mail (modo console) — conteúdo abaixo");
    console.log(`\n──── E-MAIL para ${message.to} ────\nAssunto: ${message.subject}\n\n${message.text}\n────────────────────\n`);
    return;
  }
  transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  await transport.sendMail({ from: env.MAIL_FROM, ...message });
}
