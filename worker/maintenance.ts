import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { getStorage } from "@/server/storage";
import { enqueueProbe, enqueueProcessing, getMediaQueue, getProcessingQueue } from "@/server/queue";
import { failJob } from "@/server/services/processing";

/**
 * Reconciliação: o banco é a fonte da verdade. Corrige divergências entre banco e fila
 * (Redis reiniciado, worker encerrado no meio de uma tarefa, falha ao enfileirar).
 */
export async function reconcile(): Promise<{ requeued: number; failed: number; probes: number }> {
  const queue = getProcessingQueue();
  const cutoff = new Date(Date.now() - 60_000);
  let requeued = 0;
  let failed = 0;

  const jobs = await db.processingJob.findMany({
    where: { status: { in: ["QUEUED", "RUNNING"] }, updatedAt: { lt: cutoff } },
    select: { id: true, status: true },
    take: 500,
  });
  for (const job of jobs) {
    const bull = await queue.getJob(job.id);
    const state = bull ? await bull.getState() : "missing";
    if (state === "failed") {
      await failJob(job.id, "WORKER_FAILED", "O processamento falhou. Seus créditos foram devolvidos.");
      failed++;
    } else if (state === "missing" || state === "unknown") {
      if (job.status === "QUEUED") {
        await enqueueProcessing(job.id);
        requeued++;
      } else {
        await failJob(job.id, "WORKER_LOST", "O processamento foi interrompido. Seus créditos foram devolvidos.");
        failed++;
      }
    }
  }

  const mediaQueue = getMediaQueue();
  let probes = 0;
  const assets = await db.mediaAsset.findMany({
    where: { status: { in: ["UPLOADED", "PROBING"] }, updatedAt: { lt: cutoff } },
    select: { id: true },
    take: 500,
  });
  for (const asset of assets) {
    const bull = await mediaQueue.getJob(`probe-${asset.id}`);
    if (!bull) {
      await enqueueProbe(asset.id);
      probes++;
    }
  }

  if (requeued || failed || probes) logger.info({ requeued, failed, probes }, "Reconciliação aplicada");
  return { requeued, failed, probes };
}

/** Política de retenção: remove arquivos expirados e envios abandonados. */
export async function applyRetention(now = new Date()): Promise<{ sources: number; exports: number; abandoned: number }> {
  const storage = getStorage();

  const expiredAssets = await db.mediaAsset.findMany({
    where: { status: { in: ["READY", "UPLOADED", "REJECTED"] }, expiresAt: { lt: now } },
    select: { id: true, storageKey: true, projectId: true },
    take: 500,
  });
  let sources = 0;
  for (const asset of expiredAssets) {
    const active = await db.processingJob.count({ where: { sourceAssetId: asset.id, status: { in: ["QUEUED", "RUNNING"] } } });
    if (active > 0) continue;
    await storage.delete(asset.storageKey);
    await db.mediaAsset.update({ where: { id: asset.id }, data: { status: "DELETED", deletedAt: now } });
    sources++;
  }

  const expiredExports = await db.export.findMany({
    where: { status: "DONE", expiresAt: { lt: now } },
    select: { id: true, storageKey: true },
    take: 1000,
  });
  for (const exp of expiredExports) {
    await storage.delete(exp.storageKey);
    await db.export.update({ where: { id: exp.id }, data: { status: "DELETED" } });
  }

  const abandoned = await db.mediaAsset.findMany({
    where: { status: "PENDING_UPLOAD", createdAt: { lt: new Date(now.getTime() - 24 * 3600_000) } },
    select: { id: true, storageKey: true },
    take: 500,
  });
  for (const asset of abandoned) {
    await storage.delete(asset.storageKey);
    await db.mediaAsset.update({ where: { id: asset.id }, data: { status: "DELETED", deletedAt: now } });
  }

  const result = { sources, exports: expiredExports.length, abandoned: abandoned.length };
  if (result.sources || result.exports || result.abandoned) logger.info(result, "Retenção aplicada");
  return result;
}
