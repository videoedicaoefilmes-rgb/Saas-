import { UnrecoverableError, type Job } from "bullmq";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { FfmpegError } from "@/server/media/ffmpeg";
import { probeAsset } from "@/server/services/media";
import { failJob, PermanentJobError, runProcessingJob } from "@/server/services/processing";
import type { MediaJobData, ProcessingJobData } from "@/server/queue";
import { ffmpegConfig } from "./config";

function userMessageFor(err: unknown): { code: string; message: string } {
  if (err instanceof PermanentJobError) return { code: err.code, message: err.userMessage };
  if (err instanceof FfmpegError && err.kind === "timeout") {
    return { code: "TIMEOUT", message: "O processamento excedeu o tempo limite. Seus créditos foram devolvidos." };
  }
  if (err instanceof FfmpegError) {
    return { code: "FFMPEG_FAILED", message: "Não foi possível cortar este vídeo. Seus créditos foram devolvidos." };
  }
  return { code: "INTERNAL", message: "Ocorreu um erro no processamento. Seus créditos foram devolvidos." };
}

export async function processProcessingJob(job: Job<ProcessingJobData>): Promise<string> {
  const { jobId } = job.data;
  const attempt = job.attemptsMade + 1;
  const maxAttempts = job.opts.attempts ?? 1;
  try {
    return await runProcessingJob(jobId, ffmpegConfig(), attempt);
  } catch (err) {
    const final = err instanceof PermanentJobError || attempt >= maxAttempts;
    logger.error({ err, correlationId: jobId, attempt, maxAttempts, final }, "Tentativa de processamento falhou");
    if (final) {
      const { code, message } = userMessageFor(err);
      await failJob(jobId, code, message);
      throw new UnrecoverableError(message);
    }
    await db.processingJob
      .update({ where: { id: jobId }, data: { errorMessage: `Tentativa ${attempt} falhou; tentando novamente.` } })
      .catch(() => undefined);
    throw err;
  }
}

export async function processMediaJob(job: Job<MediaJobData>): Promise<string> {
  const { assetId } = job.data;
  const attempt = job.attemptsMade + 1;
  const maxAttempts = job.opts.attempts ?? 1;
  try {
    return await probeAsset(assetId, ffmpegConfig());
  } catch (err) {
    logger.error({ err, assetId, attempt }, "Análise do vídeo falhou");
    if (attempt >= maxAttempts) {
      await db.mediaAsset.updateMany({
        where: { id: assetId, status: { in: ["UPLOADED", "PROBING"] } },
        data: { status: "REJECTED", rejectionReason: "Não conseguimos analisar este vídeo. Tente enviar novamente." },
      });
      throw new UnrecoverableError("probe failed");
    }
    throw err;
  }
}
