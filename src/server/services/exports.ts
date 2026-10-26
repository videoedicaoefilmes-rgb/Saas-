import { db } from "../db";
import { getEnv } from "../env";
import { AppError, notFound } from "../errors";
import { getStorage } from "../storage";
import { zipFilename } from "@/lib/naming";

/**
 * Downloads. Toda URL é emitida somente após checar que o arquivo pertence ao usuário,
 * e expira em poucos minutos (SIGNED_DOWNLOAD_TTL_SECONDS).
 */

export async function getExportDownloadUrl(userId: string, exportId: string): Promise<string> {
  const exp = await db.export.findFirst({ where: { id: exportId, userId } });
  if (!exp) throw notFound("Arquivo");
  if (exp.status === "DELETED") throw new AppError("NOT_FOUND", "Este arquivo expirou e foi removido.");
  if (exp.status !== "DONE") throw new AppError("CONFLICT", "Este arquivo ainda não está pronto.");
  return getStorage().createDownloadUrl(exp.storageKey, {
    ttlSeconds: getEnv().SIGNED_DOWNLOAD_TTL_SECONDS,
    downloadFilename: exp.filename,
    contentType: "video/mp4",
  });
}

/** URL para pré-visualizar o lance no navegador (sem forçar download). */
export async function getExportPreviewUrl(userId: string, exportId: string): Promise<string> {
  const exp = await db.export.findFirst({ where: { id: exportId, userId, status: "DONE" } });
  if (!exp) throw notFound("Arquivo");
  return getStorage().createDownloadUrl(exp.storageKey, { ttlSeconds: 3600, contentType: "video/mp4" });
}

export async function getJobZipManifest(userId: string, jobId: string) {
  const job = await db.processingJob.findFirst({
    where: { id: jobId, userId },
    include: {
      project: { select: { name: true, athleteName: true, matchName: true } },
      exports: { where: { status: "DONE" }, orderBy: { position: "asc" } },
    },
  });
  if (!job) throw notFound("Processamento");
  if (job.exports.length === 0) throw new AppError("CONFLICT", "Não há arquivos prontos para baixar.");
  return {
    zipName: zipFilename(job.project),
    entries: job.exports.map((e) => ({
      filename: e.filename,
      storageKey: e.storageKey,
      sizeBytes: Number(e.sizeBytes ?? 0),
      modifiedAt: e.completedAt ?? e.updatedAt,
    })),
  };
}
