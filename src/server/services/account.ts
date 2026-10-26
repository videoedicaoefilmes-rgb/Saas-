import { db } from "../db";
import { auth } from "../auth";
import { AppError } from "../errors";
import { audit } from "../audit";
import { getStorage } from "../storage";
import { userPrefix } from "../storage/keys";
import { logger } from "../logger";
import { getEnv } from "../env";

export async function verifyPassword(userId: string, password: string): Promise<boolean> {
  const account = await db.account.findFirst({ where: { userId, providerId: "credential" }, select: { password: true } });
  if (!account?.password) return false;
  const ctx = await auth.$context;
  return ctx.password.verify({ hash: account.password, password });
}

/** Registra o aceite dos termos vigentes (chamado no cadastro). */
export async function recordTermsAcceptance(userId: string): Promise<void> {
  const version = getEnv().TERMS_VERSION;
  await db.user.update({ where: { id: userId }, data: { termsAcceptedAt: new Date(), termsVersion: version } });
  await audit({ actorUserId: userId, action: "user.terms_accepted", targetType: "User", targetId: userId, metadata: { version } });
}

/**
 * Exclusão de conta: remove todos os arquivos do usuário e os dados pessoais (cascata).
 * Mantém apenas um registro de auditoria sem dados pessoais.
 * ATENÇÃO: antes de operar com pagamentos reais, revisar com jurídico/contábil quais
 * registros financeiros precisam ser retidos (ver docs/SECURITY.md).
 */
export async function deleteAccount(userId: string, password: string): Promise<void> {
  if (!(await verifyPassword(userId, password))) throw new AppError("VALIDATION", "Senha incorreta.");
  const active = await db.processingJob.count({ where: { userId, status: { in: ["QUEUED", "RUNNING"] } } });
  if (active > 0) throw new AppError("CONFLICT", "Aguarde os processamentos em andamento terminarem.");

  const files = await getStorage().deletePrefix(userPrefix(userId));
  await db.user.delete({ where: { id: userId } });
  await audit({ actorUserId: null, action: "user.account_deleted", targetType: "User", targetId: userId, metadata: { filesRemoved: files } });
  logger.info({ userId, filesRemoved: files }, "Conta excluída");
}
