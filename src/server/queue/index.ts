import { Queue, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { getEnv } from "../env";

/**
 * Filas (BullMQ sobre Redis). O banco é a fonte da verdade do estado de cada tarefa;
 * a fila apenas entrega o trabalho ao worker. Se o Redis perder dados, o worker
 * reconcilia a partir do banco (ver worker/reconcile.ts).
 */
export const QUEUES = {
  media: "media",
  processing: "processing",
  maintenance: "maintenance",
} as const;

export type MediaJobData = { assetId: string };
export type ProcessingJobData = { jobId: string };

let connection: IORedis | null = null;

export function getRedis(): IORedis {
  connection ??= new IORedis(getEnv().REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: true });
  return connection;
}

export function queueConnection(): { connection: ConnectionOptions; prefix: string } {
  return { connection: getRedis(), prefix: getEnv().REDIS_PREFIX };
}

const queues = new Map<string, Queue>();

function queue<T>(name: string): Queue<T> {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, queueConnection());
    queues.set(name, q);
  }
  return q as Queue<T>;
}

export async function enqueueProbe(assetId: string): Promise<void> {
  await queue<MediaJobData>(QUEUES.media).add(
    "probe",
    { assetId },
    { jobId: `probe-${assetId}`, attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 },
  );
}

export async function enqueueProcessing(jobId: string): Promise<void> {
  const env = getEnv();
  // jobId = ID do banco → o BullMQ ignora inclusões repetidas do mesmo processamento.
  await queue<ProcessingJobData>(QUEUES.processing).add(
    "process",
    { jobId },
    {
      jobId,
      attempts: env.JOB_MAX_ATTEMPTS,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );
}

export function getProcessingQueue(): Queue<ProcessingJobData> {
  return queue<ProcessingJobData>(QUEUES.processing);
}

export function getMediaQueue(): Queue<MediaJobData> {
  return queue<MediaJobData>(QUEUES.media);
}

export function getMaintenanceQueue(): Queue {
  return queue(QUEUES.maintenance);
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
  if (connection) {
    await connection.quit().catch(() => undefined);
    connection = null;
  }
}
