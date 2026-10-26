import { randomUUID } from "node:crypto";
import type { CreditTransaction, CreditTransactionType } from "@/generated/prisma/client";
import { db, type Tx } from "../db";
import { AppError, notFound } from "../errors";
import { audit } from "../audit";
import { getSettings } from "../settings";
import { logger } from "../logger";

/**
 * Carteira de créditos — livro-razão auditável.
 *
 * Invariantes:
 * 1. Toda mudança de saldo acontece numa transação de banco que (a) trava a linha da
 *    carteira (SELECT ... FOR UPDATE), (b) grava um CreditTransaction e (c) atualiza o saldo.
 * 2. Cada lançamento tem `idempotencyKey` única: repetir a operação devolve o lançamento
 *    existente em vez de cobrar/creditar de novo. A checagem acontece DEPOIS do lock,
 *    então duas requisições simultâneas não passam juntas.
 * 3. Saldo nunca fica negativo (validação aqui + CHECK no banco).
 * 4. O saldo é sempre lido do banco — nunca do cliente.
 */

type LockedWallet = { id: string; balance: number };

async function lockWallet(tx: Tx, userId: string): Promise<LockedWallet> {
  await tx.creditWallet.upsert({ where: { userId }, create: { userId }, update: {} });
  const rows = await tx.$queryRaw<LockedWallet[]>`
    SELECT "id", "balance" FROM "credit_wallets" WHERE "userId" = ${userId} FOR UPDATE`;
  const wallet = rows[0];
  if (!wallet) throw new Error("Carteira não encontrada após upsert");
  return wallet;
}

export type PostInput = {
  userId: string;
  type: CreditTransactionType;
  amount: number;
  idempotencyKey: string;
  jobId?: string;
  paymentId?: string;
  actorUserId?: string;
  reason?: string;
};

export type PostResult = { transaction: CreditTransaction; duplicate: boolean };

/** Lança um movimento dentro de uma transação existente. */
export async function postCreditTransaction(tx: Tx, input: PostInput): Promise<PostResult> {
  if (!Number.isInteger(input.amount)) throw new Error("Valor de crédito deve ser inteiro");
  const wallet = await lockWallet(tx, input.userId);

  const existing = await tx.creditTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.userId !== input.userId) throw new Error("Chave de idempotência pertence a outro usuário");
    return { transaction: existing, duplicate: true };
  }

  const balanceAfter = wallet.balance + input.amount;
  if (balanceAfter < 0) {
    throw new AppError(
      "INSUFFICIENT_CREDITS",
      `Créditos insuficientes: necessário ${-input.amount}, disponível ${wallet.balance}.`,
    );
  }

  await tx.creditWallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter } });
  const transaction = await tx.creditTransaction.create({
    data: {
      walletId: wallet.id,
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      balanceAfter,
      idempotencyKey: input.idempotencyKey,
      jobId: input.jobId,
      paymentId: input.paymentId,
      actorUserId: input.actorUserId,
      reason: input.reason,
    },
  });
  return { transaction, duplicate: false };
}

export async function getBalance(userId: string): Promise<number> {
  const wallet = await db.creditWallet.findUnique({ where: { userId }, select: { balance: true } });
  return wallet?.balance ?? 0;
}

export async function ensureWallet(userId: string): Promise<void> {
  await db.creditWallet.upsert({ where: { userId }, create: { userId }, update: {} });
}

export async function listTransactions(userId: string, limit = 50) {
  return db.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      amount: true,
      balanceAfter: true,
      reason: true,
      createdAt: true,
      jobId: true,
      job: { select: { project: { select: { id: true, name: true } } } },
    },
  });
}

/** Bônus de cadastro (idempotente por usuário). */
export async function grantSignupBonus(userId: string): Promise<void> {
  const settings = await getSettings();
  await ensureWallet(userId);
  if (settings.signupBonusCredits <= 0) return;
  await db.$transaction((tx) =>
    postCreditTransaction(tx, {
      userId,
      type: "SIGNUP_BONUS",
      amount: settings.signupBonusCredits,
      idempotencyKey: `signup-bonus:${userId}`,
      reason: "Créditos de boas-vindas",
    }),
  );
}

export const TEST_GRANTS_PER_DAY = 5;

/** Créditos de teste para desenvolvimento/homologação. Desligável no painel admin. */
export async function grantTestCredits(userId: string): Promise<PostResult> {
  const settings = await getSettings();
  if (!settings.testCreditsEnabled) {
    throw new AppError("FORBIDDEN", "Créditos de teste estão desativados neste ambiente.");
  }
  return db.$transaction(async (tx) => {
    await lockWallet(tx, userId);
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const recent = await tx.creditTransaction.count({
      where: { userId, type: "TEST_GRANT", createdAt: { gte: since } },
    });
    if (recent >= TEST_GRANTS_PER_DAY) {
      throw new AppError("RATE_LIMITED", "Limite diário de créditos de teste atingido. Tente amanhã.");
    }
    return postCreditTransaction(tx, {
      userId,
      type: "TEST_GRANT",
      amount: settings.testCreditsAmount,
      idempotencyKey: `test-grant:${randomUUID()}`,
      reason: "Créditos de teste (sem valor comercial)",
    });
  });
}

/** Ajuste manual por administrador — exige justificativa e gera auditoria. */
export async function adminAdjustCredits(input: {
  adminUserId: string;
  targetUserId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}): Promise<PostResult> {
  const reason = input.reason.trim();
  if (reason.length < 10) throw new AppError("VALIDATION", "Descreva a justificativa (mínimo de 10 caracteres).");
  if (!Number.isInteger(input.amount) || input.amount === 0 || Math.abs(input.amount) > 100_000) {
    throw new AppError("VALIDATION", "Informe uma quantidade inteira diferente de zero (até 100.000).");
  }
  const target = await db.user.findUnique({ where: { id: input.targetUserId }, select: { id: true } });
  if (!target) throw notFound("Usuário");

  return db.$transaction(async (tx) => {
    const result = await postCreditTransaction(tx, {
      userId: input.targetUserId,
      type: "ADMIN_ADJUSTMENT",
      amount: input.amount,
      idempotencyKey: `admin-adjust:${input.idempotencyKey}`,
      actorUserId: input.adminUserId,
      reason,
    });
    if (!result.duplicate) {
      await audit(
        {
          actorUserId: input.adminUserId,
          action: "credits.admin_adjust",
          targetType: "User",
          targetId: input.targetUserId,
          metadata: { amount: input.amount, reason, transactionId: result.transaction.id },
        },
        tx,
      );
    }
    return result;
  });
}

// ─── Processamento: reserva → confirmação | reembolso ───────────────────────

export function holdKey(jobId: string) {
  return `job:${jobId}:hold`;
}

/** Reserva (debita) os créditos de um processamento. Chamado dentro da transação que cria o job. */
export async function holdCreditsForJob(tx: Tx, job: { id: string; userId: string; creditsCharged: number }) {
  if (job.creditsCharged === 0) return null;
  return postCreditTransaction(tx, {
    userId: job.userId,
    type: "PROCESSING_HOLD",
    amount: -job.creditsCharged,
    idempotencyKey: holdKey(job.id),
    jobId: job.id,
    reason: "Reserva para processamento",
  });
}

type LockedJob = { id: string; userId: string; creditsCharged: number; creditStatus: string };

async function lockJob(tx: Tx, jobId: string): Promise<LockedJob | null> {
  const rows = await tx.$queryRaw<LockedJob[]>`
    SELECT "id", "userId", "creditsCharged", "creditStatus"::text AS "creditStatus"
    FROM "processing_jobs" WHERE "id" = ${jobId} FOR UPDATE`;
  return rows[0] ?? null;
}

/**
 * Confirma o consumo após sucesso. Idempotente; nunca confirma um job já reembolsado.
 * Deve ser chamado dentro da transação que marca o job como concluído.
 */
export async function captureCreditsForJob(tx: Tx, jobId: string): Promise<"captured" | "noop"> {
  const job = await lockJob(tx, jobId);
  if (!job) throw notFound("Processamento");
  if (job.creditStatus !== "HELD") return "noop";
  await tx.processingJob.update({ where: { id: jobId }, data: { creditStatus: "CAPTURED" } });
  if (job.creditsCharged > 0) {
    await postCreditTransaction(tx, {
      userId: job.userId,
      type: "PROCESSING_CAPTURE",
      amount: 0,
      idempotencyKey: `job:${jobId}:capture`,
      jobId,
      reason: `Consumo confirmado: ${job.creditsCharged} crédito(s)`,
    });
  }
  return "captured";
}

/**
 * Devolve os créditos de um processamento que falhou definitivamente.
 * Idempotente; nunca reembolsa um job já confirmado.
 */
export async function refundCreditsForJob(tx: Tx, jobId: string, reason: string): Promise<"refunded" | "noop"> {
  const job = await lockJob(tx, jobId);
  if (!job) throw notFound("Processamento");
  if (job.creditStatus !== "HELD") return "noop";
  await tx.processingJob.update({ where: { id: jobId }, data: { creditStatus: "REFUNDED" } });
  if (job.creditsCharged > 0) {
    await postCreditTransaction(tx, {
      userId: job.userId,
      type: "PROCESSING_REFUND",
      amount: job.creditsCharged,
      idempotencyKey: `job:${jobId}:refund`,
      jobId,
      reason,
    });
  }
  logger.info({ correlationId: jobId, credits: job.creditsCharged }, "Créditos reembolsados");
  return "refunded";
}

// ─── Pagamentos (estrutura pronta; nenhum provedor real conectado) ───────────

/**
 * Concede os créditos de um pagamento confirmado. Chamado pelo processamento de webhook
 * verificado. Idempotente: webhooks repetidos não concedem créditos duas vezes.
 */
export async function grantCreditsForPayment(paymentId: string): Promise<"granted" | "noop"> {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; status: string; creditsGrantedAt: Date | null }[]>`
      SELECT "id", "status"::text AS "status", "creditsGrantedAt" FROM "payments" WHERE "id" = ${paymentId} FOR UPDATE`;
    const payment = rows[0];
    if (!payment) throw notFound("Pagamento");
    if (payment.status !== "PAID" || payment.creditsGrantedAt) return "noop";
    const full = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    await postCreditTransaction(tx, {
      userId: full.userId,
      type: full.subscriptionId ? "SUBSCRIPTION_GRANT" : "PURCHASE",
      amount: full.creditsToGrant,
      idempotencyKey: `payment:${paymentId}:grant`,
      paymentId,
      reason: "Créditos do pagamento confirmado",
    });
    await tx.payment.update({ where: { id: paymentId }, data: { creditsGrantedAt: new Date() } });
    return "granted";
  });
}
