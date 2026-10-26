import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { getEnv } from "../env";
import { AppError, notFound } from "../errors";
import { getSettings, pricingRuleFrom } from "../settings";
import { getStorage } from "../storage";
import { exportKey } from "../storage/keys";
import { enqueueProcessing } from "../queue";
import { logger } from "../logger";
import { estimateCredits, estimateInfraCostCents, type PricingEstimate } from "@/lib/billing/pricing";
import { effectiveRange, validateClipRange, CLIP_RANGE_MESSAGES } from "@/lib/clips";
import { clipFilename } from "@/lib/naming";
import { formatTimecode } from "@/lib/timecode";
import { captureCreditsForJob, holdCreditsForJob, refundCreditsForJob } from "./credits";
import { getOwnedProject } from "./projects";
import { cutClip, probeOutput, FfmpegError, type FfmpegConfig } from "../media/ffmpeg";

// ─── Planejamento (estimativa) ───────────────────────────────────────────────

export type PlannedClip = {
  clipId: string;
  position: number;
  title: string | null;
  category: string | null;
  startMs: number;
  endMs: number;
  filename: string;
};

export type ProcessingPlan = {
  projectId: string;
  assetId: string;
  cutMode: "PRECISE" | "FAST";
  clips: PlannedClip[];
  estimate: PricingEstimate;
  balance: number;
  /** Problemas que impedem iniciar (mensagens em pt-BR). */
  blockers: string[];
};

/**
 * Calcula o que será processado e quanto custa. É a mesma função usada na tela de
 * confirmação e no início do processamento — o cliente nunca informa o preço.
 */
export async function planProcessing(userId: string, projectId: string): Promise<ProcessingPlan> {
  const project = await getOwnedProject(userId, projectId);
  const settings = await getSettings();
  const rule = pricingRuleFrom(settings);
  const blockers: string[] = [];

  const asset = await db.mediaAsset.findFirst({
    where: { projectId, status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
  });
  const clips = await db.clip.findMany({ where: { projectId }, orderBy: { position: "asc" } });
  const wallet = await db.creditWallet.findUnique({ where: { userId } });
  const balance = wallet?.balance ?? 0;

  if (!asset || asset.status !== "READY" || !asset.durationMs) blockers.push("Envie o vídeo e aguarde a validação.");
  if (clips.length === 0) blockers.push("Marque pelo menos um lance.");
  if (clips.length > settings.maxClipsPerJob) blockers.push(`Máximo de ${settings.maxClipsPerJob} lances por processamento.`);

  const duration = asset?.durationMs ?? 0;
  const planned: PlannedClip[] = [];
  for (const clip of clips) {
    if (duration > 0) {
      const err = validateClipRange(clip, { videoDurationMs: duration, maxClipMs: settings.maxClipDurationSeconds * 1000 });
      if (err) {
        blockers.push(`Lance ${clip.position} (${formatTimecode(clip.startMs)}): ${CLIP_RANGE_MESSAGES[err]}`);
        continue;
      }
    }
    const range = duration > 0 ? effectiveRange(clip, { beforeMs: project.paddingBeforeMs, afterMs: project.paddingAfterMs }, duration) : clip;
    planned.push({
      clipId: clip.id,
      position: clip.position,
      title: clip.title,
      category: clip.category,
      startMs: range.startMs,
      endMs: range.endMs,
      filename: clipFilename({
        athleteName: project.athleteName,
        matchName: project.matchName,
        projectName: project.name,
        position: clip.position,
      }),
    });
  }

  const estimate = estimateCredits(
    planned.map((c) => c.endMs - c.startMs),
    rule,
  );
  if (blockers.length === 0 && estimate.credits > balance) {
    blockers.push(`Créditos insuficientes: este processamento custa ${estimate.credits} e você tem ${balance}.`);
  }
  if (settings.processingPaused) blockers.push("Novos processamentos estão pausados para manutenção. Tente mais tarde.");

  return {
    projectId,
    assetId: asset?.id ?? "",
    cutMode: project.cutMode,
    clips: planned,
    estimate,
    balance,
    blockers,
  };
}

// ─── Início ──────────────────────────────────────────────────────────────────

export const startProcessingSchema = z.object({
  projectId: z.string().min(1),
  /** Gerada no navegador ao abrir a confirmação: o mesmo clique repetido não cria outro job. */
  idempotencyKey: z.string().min(16).max(64),
  /** Custo exibido ao usuário; se mudou desde então, pedimos nova confirmação. */
  expectedCredits: z.number().int().nonnegative(),
});

export async function startProcessing(userId: string, rawInput: unknown) {
  const input = startProcessingSchema.parse(rawInput);

  const existing = await db.processingJob.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
  });
  if (existing) return { job: existing, duplicate: true };

  const plan = await planProcessing(userId, input.projectId);
  if (plan.blockers.length > 0) {
    const insufficient = plan.estimate.credits > plan.balance;
    throw new AppError(insufficient ? "INSUFFICIENT_CREDITS" : "VALIDATION", plan.blockers[0]!);
  }
  if (plan.estimate.credits !== input.expectedCredits) {
    throw new AppError("PRICE_CHANGED", `O custo foi atualizado para ${plan.estimate.credits} crédito(s). Revise e confirme novamente.`);
  }

  const settings = await getSettings();
  const env = getEnv();
  const project = await getOwnedProject(userId, input.projectId);
  const jobId = randomUUID().replaceAll("-", "");

  let job;
  try {
    job = await db.$transaction(async (tx) => {
      // Serializa as operações financeiras do usuário (mesmo lock usado pela carteira).
      await tx.creditWallet.upsert({ where: { userId }, create: { userId }, update: {} });
      await tx.$queryRaw`SELECT "id" FROM "credit_wallets" WHERE "userId" = ${userId} FOR UPDATE`;

      const dup = await tx.processingJob.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
      });
      if (dup) return dup;

      const activeForUser = await tx.processingJob.count({ where: { userId, status: { in: ["QUEUED", "RUNNING"] } } });
      if (activeForUser >= settings.maxActiveJobsPerUser) {
        throw new AppError("RATE_LIMITED", "Você já tem processamentos em andamento. Aguarde a conclusão.");
      }
      const activeForProject = await tx.processingJob.count({
        where: { projectId: project.id, status: { in: ["QUEUED", "RUNNING"] } },
      });
      if (activeForProject > 0) throw new AppError("CONFLICT", "Este projeto já está sendo processado.");

      const created = await tx.processingJob.create({
        data: {
          id: jobId,
          userId,
          projectId: project.id,
          sourceAssetId: plan.assetId,
          cutMode: plan.cutMode,
          idempotencyKey: input.idempotencyKey,
          clipCount: plan.clips.length,
          billableSeconds: plan.estimate.billableSeconds,
          creditsCharged: plan.estimate.credits,
          creditStatus: "HELD",
          pricingSnapshot: plan.estimate.rule,
        },
      });
      const expiresAt = new Date(Date.now() + env.RETENTION_EXPORT_DAYS * 86400_000);
      for (const clip of plan.clips) {
        const exportId = randomUUID().replaceAll("-", "");
        await tx.export.create({
          data: {
            id: exportId,
            userId,
            projectId: project.id,
            jobId,
            clipId: clip.clipId,
            position: clip.position,
            startMs: clip.startMs,
            endMs: clip.endMs,
            title: clip.title,
            category: clip.category as never,
            filename: clip.filename,
            storageKey: exportKey(userId, project.id, jobId, exportId),
            expiresAt,
          },
        });
      }
      await holdCreditsForJob(tx, created);
      return created;
    });
  } catch (err) {
    // Índice único parcial: outro job ativo do mesmo projeto criado em paralelo.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = await db.processingJob.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
      });
      if (again) return { job: again, duplicate: true };
      throw new AppError("CONFLICT", "Este projeto já está sendo processado.");
    }
    throw err;
  }

  if (job.id !== jobId) return { job, duplicate: true };

  try {
    await enqueueProcessing(job.id);
  } catch (err) {
    // Sem fila não há processamento: devolve os créditos imediatamente.
    logger.error({ err, correlationId: job.id }, "Falha ao enfileirar processamento");
    await failJob(job.id, "QUEUE_UNAVAILABLE", "Não foi possível iniciar o processamento agora. Seus créditos foram devolvidos.");
    throw new AppError("UNAVAILABLE", "Não foi possível iniciar o processamento agora. Seus créditos foram devolvidos.");
  }
  logger.info({ correlationId: job.id, userId, clips: job.clipCount, credits: job.creditsCharged }, "Processamento enfileirado");
  return { job, duplicate: false };
}

// ─── Consulta ────────────────────────────────────────────────────────────────

export async function getOwnedJob(userId: string, jobId: string) {
  const job = await db.processingJob.findFirst({
    where: { id: jobId, userId },
    include: {
      exports: { orderBy: { position: "asc" } },
      project: { select: { id: true, name: true, athleteName: true, matchName: true } },
    },
  });
  if (!job) throw notFound("Processamento");
  return job;
}

export async function listJobs(userId: string, take = 20) {
  return db.processingJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    include: { project: { select: { id: true, name: true } } },
  });
}

// ─── Execução (worker) ───────────────────────────────────────────────────────

/** Erro que não adianta tentar de novo (ex.: vídeo de origem removido). */
export class PermanentJobError extends Error {
  constructor(
    public readonly code: string,
    public readonly userMessage: string,
  ) {
    super(userMessage);
    this.name = "PermanentJobError";
  }
}

export type RunResult = "SUCCEEDED" | "SKIPPED";

/**
 * Processa todos os lances pendentes de um job. Idempotente: lances já concluídos
 * (de uma tentativa anterior) não são refeitos. Lança erro para a fila tentar novamente.
 */
export async function runProcessingJob(jobId: string, cfg: FfmpegConfig, attempt: number): Promise<RunResult> {
  const env = getEnv();
  const log = logger.child({ correlationId: jobId });
  const job = await db.processingJob.findUnique({
    where: { id: jobId },
    include: { sourceAsset: true, exports: { orderBy: { position: "asc" } } },
  });
  if (!job) {
    log.warn("Job inexistente no banco — ignorado");
    return "SKIPPED";
  }
  if (job.status !== "QUEUED" && job.status !== "RUNNING") return "SKIPPED";
  if (job.sourceAsset.status !== "READY") {
    throw new PermanentJobError("SOURCE_UNAVAILABLE", "O vídeo de origem não está mais disponível.");
  }

  const started = Date.now();
  await db.processingJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: job.startedAt ?? new Date(), attempts: attempt },
  });

  const storage = getStorage();
  const tmpRoot = env.WORKER_TMP_DIR || os.tmpdir();
  const workDir = await mkdtemp(path.join(tmpRoot, "gmclips-"));
  try {
    const input = await storage.ffmpegInput(job.sourceAsset.storageKey, 6 * 3600);
    for (const exp of job.exports) {
      if (exp.status === "DONE") continue;
      await db.export.update({ where: { id: exp.id }, data: { status: "PROCESSING" } });
      const out = path.join(workDir, `${exp.id}.mp4`);
      const t0 = Date.now();
      try {
        await cutClip({ input, output: out, startMs: exp.startMs, endMs: exp.endMs, mode: job.cutMode }, cfg);
      } catch (err) {
        if (err instanceof FfmpegError) log.warn({ exportId: exp.id, kind: err.kind, stderr: err.stderrTail.slice(-2000) }, "FFmpeg falhou");
        throw err;
      }
      const info = await probeOutput(out, cfg);
      if (!info.video || info.durationMs <= 0) throw new Error("Arquivo gerado sem vídeo válido");
      const { size } = await stat(out);
      await storage.putFile(exp.storageKey, out, "video/mp4");
      await rm(out, { force: true });
      await db.export.update({
        where: { id: exp.id },
        data: { status: "DONE", sizeBytes: BigInt(size), durationMs: info.durationMs, completedAt: new Date(), errorMessage: null },
      });
      log.info({ exportId: exp.id, ms: Date.now() - t0, bytes: size }, "Lance processado");
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  const processingMs = Date.now() - started;
  await db.$transaction(async (tx) => {
    const totals = await tx.export.aggregate({ where: { jobId }, _sum: { sizeBytes: true } });
    await tx.processingJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        processingMs,
        outputBytes: totals._sum.sizeBytes ?? BigInt(0),
        estimatedCostCents: estimateInfraCostCents(processingMs, env.INFRA_COST_CENTS_PER_PROCESSING_MINUTE),
        errorCode: null,
        errorMessage: null,
      },
    });
    await captureCreditsForJob(tx, jobId);
  });
  log.info({ processingMs, clips: job.exports.length }, "Processamento concluído");
  return "SUCCEEDED";
}

/**
 * Falha definitiva: marca o job e os lances pendentes como falhos e devolve os créditos.
 * Idempotente — pode ser chamado pelo worker, pela reconciliação ou pela web.
 */
export async function failJob(jobId: string, errorCode: string, userMessage: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const job = await tx.processingJob.findUnique({ where: { id: jobId } });
    if (!job || job.status === "SUCCEEDED" || job.status === "FAILED" || job.status === "CANCELED") return;
    await tx.processingJob.update({
      where: { id: jobId },
      data: { status: "FAILED", finishedAt: new Date(), errorCode, errorMessage: userMessage },
    });
    await tx.export.updateMany({
      where: { jobId, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "FAILED", errorMessage: userMessage },
    });
    await refundCreditsForJob(tx, jobId, "Reembolso: processamento não concluído");
  });
  logger.warn({ correlationId: jobId, errorCode }, "Processamento falhou definitivamente — créditos devolvidos");
}
