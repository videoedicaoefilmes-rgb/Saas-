import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db";
import { getEnv } from "../env";
import { AppError, notFound } from "../errors";
import { getSettings } from "../settings";
import { getStorage } from "../storage";
import { sourceKey } from "../storage/keys";
import { enqueueProbe } from "../queue";
import { allowedVideoExtension, sanitizeDisplayFilename } from "@/lib/naming";
import { getOwnedProject } from "./projects";
import { hasIsoBmffSignature, probe, validateProbe, type FfmpegConfig } from "../media/ffmpeg";
import { logger } from "../logger";

/**
 * Upload de vídeos em duas etapas:
 * 1. requestUpload → cria o registro e devolve uma URL assinada (PUT direto ao armazenamento).
 * 2. completeUpload → confere tamanho e assinatura do arquivo e agenda a análise (ffprobe) no worker.
 *
 * A abstração `source` (MediaSource) reserva espaço para importações futuras por APIs
 * oficiais. Nenhum download de plataformas de terceiros é feito no MVP.
 */

export const requestUploadSchema = z.object({
  projectId: z.string().min(1),
  filename: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  rightsConfirmed: z.literal(true, { error: "Confirme que você tem autorização para usar este vídeo." }),
});

const MIME_BY_EXT = { mp4: "video/mp4", mov: "video/quicktime" } as const;

export async function requestUpload(userId: string, rawInput: unknown) {
  const input = requestUploadSchema.parse(rawInput);
  const env = getEnv();
  const settings = await getSettings();
  if (settings.uploadsPaused) throw new AppError("UNAVAILABLE", "Novos envios estão temporariamente pausados para manutenção.");

  const project = await getOwnedProject(userId, input.projectId);
  const ext = allowedVideoExtension(input.filename);
  if (!ext) throw new AppError("VALIDATION", "Formato não aceito. Envie um vídeo MP4 ou MOV.");
  if (input.sizeBytes > env.UPLOAD_MAX_BYTES) {
    const gb = (env.UPLOAD_MAX_BYTES / 1024 ** 3).toFixed(1).replace(".", ",");
    throw new AppError("VALIDATION", `O arquivo passa do limite atual de ${gb} GB.`);
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const recent = await db.mediaAsset.count({ where: { userId, createdAt: { gte: since } } });
  if (recent >= env.UPLOADS_PER_DAY_PER_USER) {
    throw new AppError("RATE_LIMITED", "Você atingiu o limite de envios das últimas 24 horas.");
  }

  const active = await db.processingJob.count({ where: { projectId: project.id, status: { in: ["QUEUED", "RUNNING"] } } });
  if (active > 0) throw new AppError("CONFLICT", "Aguarde o processamento atual terminar para trocar o vídeo.");

  const assetId = randomUUID().replaceAll("-", "");
  const key = sourceKey(userId, project.id, assetId, ext);
  const contentType = MIME_BY_EXT[ext];

  const asset = await db.mediaAsset.create({
    data: {
      id: assetId,
      userId,
      projectId: project.id,
      storageKey: key,
      originalFilename: sanitizeDisplayFilename(input.filename),
      declaredMimeType: contentType,
      sizeBytes: BigInt(input.sizeBytes),
      rightsConfirmedAt: new Date(),
    },
  });

  const upload = await getStorage().createUploadTarget(key, {
    contentType,
    sizeBytes: input.sizeBytes,
    ttlSeconds: env.SIGNED_UPLOAD_TTL_SECONDS,
  });
  return { assetId: asset.id, upload };
}

async function getOwnedAsset(userId: string, assetId: string) {
  const asset = await db.mediaAsset.findFirst({ where: { id: assetId, userId } });
  if (!asset) throw notFound("Vídeo");
  return asset;
}

async function reject(assetId: string, storageKey: string, reason: string) {
  await getStorage()
    .delete(storageKey)
    .catch((err) => logger.warn({ err, assetId }, "Falha ao remover arquivo rejeitado"));
  await db.mediaAsset.update({ where: { id: assetId }, data: { status: "REJECTED", rejectionReason: reason } });
}

export async function completeUpload(userId: string, assetId: string) {
  const env = getEnv();
  const asset = await getOwnedAsset(userId, assetId);
  if (asset.status !== "PENDING_UPLOAD") return asset; // idempotente

  const storage = getStorage();
  const info = await storage.head(asset.storageKey);
  if (!info) throw new AppError("VALIDATION", "Não recebemos o arquivo. Tente enviar novamente.");

  if (info.sizeBytes !== Number(asset.sizeBytes) || info.sizeBytes > env.UPLOAD_MAX_BYTES) {
    await reject(asset.id, asset.storageKey, "O tamanho do arquivo recebido não confere. Envie novamente.");
    return db.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
  }

  const head = await storage.readHead(asset.storageKey, 16);
  if (!hasIsoBmffSignature(head)) {
    await reject(asset.id, asset.storageKey, "O arquivo não é um vídeo MP4 ou MOV válido.");
    return db.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
  }

  const now = new Date();
  const updated = await db.mediaAsset.update({
    where: { id: asset.id },
    data: {
      status: "UPLOADED",
      uploadedAt: now,
      expiresAt: new Date(now.getTime() + env.RETENTION_SOURCE_DAYS * 86400_000),
    },
  });

  // Um vídeo por projeto: o anterior é removido ao concluir um novo envio.
  const previous = await db.mediaAsset.findMany({
    where: { projectId: asset.projectId, id: { not: asset.id }, status: { not: "DELETED" } },
  });
  for (const old of previous) {
    await storage.delete(old.storageKey).catch((err) => logger.warn({ err, assetId: old.id }, "Falha ao remover vídeo anterior"));
    await db.mediaAsset.update({ where: { id: old.id }, data: { status: "DELETED", deletedAt: now } });
  }

  await enqueueProbe(asset.id);
  return updated;
}

/** Executado pelo worker: extrai metadados e valida o formato real do vídeo. */
export async function probeAsset(assetId: string, cfg: FfmpegConfig): Promise<"READY" | "REJECTED" | "SKIPPED"> {
  const env = getEnv();
  const asset = await db.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset || !["UPLOADED", "PROBING"].includes(asset.status)) return "SKIPPED";
  await db.mediaAsset.update({ where: { id: assetId }, data: { status: "PROBING" } });

  const input = await getStorage().ffmpegInput(asset.storageKey, 600);
  let info;
  try {
    info = await probe(input, cfg);
  } catch (err) {
    logger.warn({ err, assetId }, "ffprobe falhou");
    await reject(asset.id, asset.storageKey, "Não conseguimos ler este vídeo. Ele pode estar corrompido ou em formato não suportado.");
    return "REJECTED";
  }

  const verdict = validateProbe(info, { maxDurationMs: env.UPLOAD_MAX_DURATION_SECONDS * 1000 });
  if (!verdict.ok) {
    await reject(asset.id, asset.storageKey, verdict.reason);
    return "REJECTED";
  }

  await db.mediaAsset.update({
    where: { id: assetId },
    data: {
      status: "READY",
      probedAt: new Date(),
      durationMs: info.durationMs,
      width: info.video!.width,
      height: info.video!.height,
      fps: info.video!.fps,
      videoCodec: info.video!.codec,
      audioCodec: info.audio?.codec ?? null,
      formatName: info.formatName,
      bitRate: info.bitRate,
    },
  });
  return "READY";
}

/** URL temporária para o player do editor (reprodução no navegador). */
export async function getAssetPlaybackUrl(userId: string, assetId: string): Promise<string> {
  const asset = await getOwnedAsset(userId, assetId);
  if (asset.status !== "READY") throw new AppError("CONFLICT", "O vídeo ainda não está pronto.");
  return getStorage().createDownloadUrl(asset.storageKey, {
    ttlSeconds: 3600,
    contentType: asset.declaredMimeType,
  });
}

export async function getAssetStatus(userId: string, assetId: string) {
  const asset = await getOwnedAsset(userId, assetId);
  return { id: asset.id, status: asset.status, rejectionReason: asset.rejectionReason, durationMs: asset.durationMs };
}
