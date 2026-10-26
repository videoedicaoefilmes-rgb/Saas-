import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import {
  adminAdjustCredits,
  captureCreditsForJob,
  getBalance,
  grantCreditsForPayment,
  grantTestCredits,
  holdCreditsForJob,
  postCreditTransaction,
  refundCreditsForJob,
} from "@/server/services/credits";
import { updateSettings } from "@/server/settings";
import { createProject } from "@/server/services/projects";
import { createUser, resetDb } from "../helpers";

async function seedJob(userId: string, credits: number) {
  const project = await createProject(userId, { name: "Projeto" });
  const asset = await db.mediaAsset.create({
    data: {
      userId,
      projectId: project.id,
      storageKey: `users/${userId}/projects/${project.id}/source/${randomUUID().replaceAll("-", "")}.mp4`,
      originalFilename: "a.mp4",
      declaredMimeType: "video/mp4",
      sizeBytes: BigInt(1),
      status: "READY",
      durationMs: 60_000,
      rightsConfirmedAt: new Date(),
    },
  });
  return db.processingJob.create({
    data: {
      userId,
      projectId: project.id,
      sourceAssetId: asset.id,
      cutMode: "PRECISE",
      idempotencyKey: randomUUID(),
      clipCount: 1,
      billableSeconds: 10,
      creditsCharged: credits,
      pricingSnapshot: {},
    },
  });
}

async function give(userId: string, amount: number) {
  await db.$transaction((tx) =>
    postCreditTransaction(tx, { userId, type: "TEST_GRANT", amount, idempotencyKey: randomUUID() }),
  );
}

async function ledgerSum(userId: string) {
  const agg = await db.creditTransaction.aggregate({ where: { userId }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

describe("créditos", () => {
  beforeEach(resetDb);

  it("reserva → confirmação: debita uma vez e registra o consumo", async () => {
    const u = await createUser();
    await give(u.id, 10);
    const job = await seedJob(u.id, 3);
    await db.$transaction((tx) => holdCreditsForJob(tx, job));
    expect(await getBalance(u.id)).toBe(7);
    expect(await db.$transaction((tx) => captureCreditsForJob(tx, job.id))).toBe("captured");
    expect(await db.$transaction((tx) => captureCreditsForJob(tx, job.id))).toBe("noop");
    expect(await getBalance(u.id)).toBe(7);
    const types = (await db.creditTransaction.findMany({ where: { jobId: job.id } })).map((t) => t.type).sort();
    expect(types).toEqual(["PROCESSING_CAPTURE", "PROCESSING_HOLD"]);
  });

  it("reserva → falha: reembolso automático, uma única vez", async () => {
    const u = await createUser();
    await give(u.id, 10);
    const job = await seedJob(u.id, 4);
    await db.$transaction((tx) => holdCreditsForJob(tx, job));
    expect(await getBalance(u.id)).toBe(6);
    expect(await db.$transaction((tx) => refundCreditsForJob(tx, job.id, "falha"))).toBe("refunded");
    expect(await db.$transaction((tx) => refundCreditsForJob(tx, job.id, "falha"))).toBe("noop");
    expect(await getBalance(u.id)).toBe(10);
  });

  it("não confirma consumo de job já reembolsado (nem o contrário)", async () => {
    const u = await createUser();
    await give(u.id, 10);
    const job = await seedJob(u.id, 2);
    await db.$transaction((tx) => holdCreditsForJob(tx, job));
    await db.$transaction((tx) => refundCreditsForJob(tx, job.id, "x"));
    expect(await db.$transaction((tx) => captureCreditsForJob(tx, job.id))).toBe("noop");
    expect(await getBalance(u.id)).toBe(10);
  });

  it("cobrança duplicada com a mesma chave não debita duas vezes", async () => {
    const u = await createUser();
    await give(u.id, 10);
    const job = await seedJob(u.id, 5);
    const first = await db.$transaction((tx) => holdCreditsForJob(tx, job));
    const second = await db.$transaction((tx) => holdCreditsForJob(tx, job));
    expect(first?.duplicate).toBe(false);
    expect(second?.duplicate).toBe(true);
    expect(await getBalance(u.id)).toBe(5);
  });

  it("cobranças simultâneas não deixam o saldo negativo", async () => {
    const u = await createUser();
    await give(u.id, 5);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        db.$transaction((tx) =>
          postCreditTransaction(tx, { userId: u.id, type: "PROCESSING_HOLD", amount: -2, idempotencyKey: randomUUID() }),
        ),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(await getBalance(u.id)).toBe(1);
    expect(await ledgerSum(u.id)).toBe(1);
  });

  it("saldo insuficiente é recusado", async () => {
    const u = await createUser();
    await give(u.id, 1);
    const job = await seedJob(u.id, 2);
    await expect(db.$transaction((tx) => holdCreditsForJob(tx, job))).rejects.toThrow(/insuficientes/);
    expect(await getBalance(u.id)).toBe(1);
  });

  it("créditos de teste respeitam a configuração e o limite diário", async () => {
    const u = await createUser();
    await updateSettings({ testCreditsEnabled: false }, u.id);
    await expect(grantTestCredits(u.id)).rejects.toThrow(/desativados/);
    await updateSettings({ testCreditsEnabled: true, testCreditsAmount: 10 }, u.id);
    for (let i = 0; i < 5; i++) await grantTestCredits(u.id);
    await expect(grantTestCredits(u.id)).rejects.toThrow(/Limite diário/);
    expect(await getBalance(u.id)).toBe(50);
  });

  it("ajuste administrativo exige justificativa, é idempotente e auditado", async () => {
    const admin = await createUser();
    const u = await createUser();
    await expect(adminAdjustCredits({ adminUserId: admin.id, targetUserId: u.id, amount: 5, reason: "curto", idempotencyKey: "k1" })).rejects.toThrow(/justificativa/);
    const input = { adminUserId: admin.id, targetUserId: u.id, amount: 25, reason: "Cortesia para homologação", idempotencyKey: "k2" };
    await adminAdjustCredits(input);
    await adminAdjustCredits(input);
    expect(await getBalance(u.id)).toBe(25);
    const logs = await db.auditLog.findMany({ where: { action: "credits.admin_adjust", targetId: u.id } });
    expect(logs).toHaveLength(1);
    const tx = await db.creditTransaction.findFirstOrThrow({ where: { userId: u.id, type: "ADMIN_ADJUSTMENT" } });
    expect(tx.actorUserId).toBe(admin.id);
  });

  it("pagamento confirmado concede créditos uma única vez (webhook repetido)", async () => {
    const u = await createUser();
    const pay = await db.payment.create({
      data: { userId: u.id, provider: "teste", providerPaymentId: "pay_1", method: "PIX", amountCents: 1, creditsToGrant: 30, status: "PENDING" },
    });
    expect(await grantCreditsForPayment(pay.id)).toBe("noop");
    await db.payment.update({ where: { id: pay.id }, data: { status: "PAID", paidAt: new Date() } });
    const results = await Promise.all([grantCreditsForPayment(pay.id), grantCreditsForPayment(pay.id), grantCreditsForPayment(pay.id)]);
    expect(results.filter((r) => r === "granted")).toHaveLength(1);
    expect(await getBalance(u.id)).toBe(30);
  });

  it("saldo da carteira sempre igual à soma do livro-razão", async () => {
    const u = await createUser();
    await give(u.id, 20);
    const job = await seedJob(u.id, 7);
    await db.$transaction((tx) => holdCreditsForJob(tx, job));
    await db.$transaction((tx) => refundCreditsForJob(tx, job.id, "x"));
    expect(await getBalance(u.id)).toBe(await ledgerSum(u.id));
  });

  it("o banco recusa saldo negativo mesmo se o código falhar (CHECK)", async () => {
    const u = await createUser();
    await expect(db.creditWallet.update({ where: { userId: u.id }, data: { balance: -1 } })).rejects.toThrow();
  });
});
