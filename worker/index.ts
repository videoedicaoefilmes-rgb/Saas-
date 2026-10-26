process.env.SERVICE_NAME ??= "worker";

import { Worker } from "bullmq";
import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";
import { db } from "@/server/db";
import { QUEUES, closeQueues, getMaintenanceQueue, queueConnection } from "@/server/queue";
import { processMediaJob, processProcessingJob } from "./processors";
import { applyRetention, reconcile } from "./maintenance";
import { runProcess } from "@/server/media/ffmpeg";

async function main() {
  const env = getEnv();

  // Falha cedo se o FFmpeg não estiver instalado.
  await runProcess(env.FFMPEG_PATH, ["-hide_banner", "-version"], 10_000);
  await runProcess(env.FFPROBE_PATH, ["-hide_banner", "-version"], 10_000);

  const processing = new Worker(QUEUES.processing, processProcessingJob, {
    ...queueConnection(),
    concurrency: env.WORKER_CONCURRENCY,
    // Cortes longos: o lock é renovado automaticamente enquanto o processo estiver vivo.
    lockDuration: 120_000,
    maxStalledCount: 1,
  });
  const media = new Worker(QUEUES.media, processMediaJob, { ...queueConnection(), concurrency: 2 });
  const maintenance = new Worker(
    QUEUES.maintenance,
    async (job) => (job.name === "retention" ? applyRetention() : reconcile()),
    { ...queueConnection(), concurrency: 1 },
  );

  for (const [name, w] of [["processing", processing], ["media", media], ["maintenance", maintenance]] as const) {
    w.on("failed", (job, err) => logger.warn({ queue: name, bullJobId: job?.id, err: err.message }, "Tarefa falhou"));
    w.on("error", (err) => logger.error({ queue: name, err }, "Erro no worker"));
  }

  const mq = getMaintenanceQueue();
  await mq.upsertJobScheduler("reconcile-every-2min", { every: 120_000 }, { name: "reconcile" });
  await mq.upsertJobScheduler("retention-hourly", { every: 3_600_000 }, { name: "retention" });
  await reconcile().catch((err) => logger.error({ err }, "Reconciliação inicial falhou"));

  logger.info({ concurrency: env.WORKER_CONCURRENCY, threads: env.FFMPEG_THREADS, storage: env.STORAGE_DRIVER }, "Worker iniciado");

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, "Encerrando worker (aguardando tarefas em andamento)...");
    await Promise.allSettled([processing.close(), media.close(), maintenance.close()]);
    await closeQueues();
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Worker não pôde iniciar");
  process.exit(1);
});
