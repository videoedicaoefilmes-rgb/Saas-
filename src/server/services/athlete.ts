import { z } from "zod";
import { db } from "../db";
import { AppError, notFound } from "../errors";
import { getOwnedProject } from "./projects";

/**
 * Identificação do atleta: a pessoa pausa o vídeo num momento em que o atleta aparece e
 * clica sobre ele. Guardamos o instante e o ponto (normalizado 0–1 sobre a IMAGEM do vídeo,
 * sem as faixas pretas), para a futura sugestão automática de lances reconhecê-lo.
 * Nada disso é desenhado nos cortes gerados.
 */

export const MAX_MARKS_PER_VIDEO = 10;

const unit = z.number().finite().min(0, "Ponto fora da imagem.").max(1, "Ponto fora da imagem.");

export const athleteMarkSchema = z.object({
  timeMs: z.number().int().nonnegative(),
  x: unit,
  y: unit,
});

export const athleteInfoSchema = z.object({
  jerseyColor: z
    .string()
    .trim()
    .max(40, "Descreva a cor em até 40 caracteres.")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  jerseyNumber: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{1,3}$/.test(v), "O número da camisa deve ter de 1 a 3 dígitos."),
});

async function currentReadyAsset(projectId: string) {
  const asset = await db.mediaAsset.findFirst({
    where: { projectId, status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
  });
  if (!asset || asset.status !== "READY" || !asset.durationMs) {
    throw new AppError("CONFLICT", "Envie o vídeo e aguarde a validação antes de identificar o atleta.");
  }
  return asset;
}

/** Marcações do vídeo atual do projeto (as de vídeos substituídos não valem mais). */
export async function listAthleteMarks(userId: string, projectId: string) {
  await getOwnedProject(userId, projectId);
  const asset = await db.mediaAsset.findFirst({
    where: { projectId, status: "READY" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!asset) return [];
  return db.athleteMark.findMany({
    where: { mediaAssetId: asset.id },
    orderBy: { timeMs: "asc" },
    select: { id: true, timeMs: true, x: true, y: true, createdAt: true },
  });
}

export async function addAthleteMark(userId: string, projectId: string, raw: unknown) {
  await getOwnedProject(userId, projectId);
  const input = athleteMarkSchema.parse(raw);
  const asset = await currentReadyAsset(projectId);
  if (input.timeMs > asset.durationMs!) throw new AppError("VALIDATION", "Esse momento está fora da duração do vídeo.");

  return db.$transaction(async (tx) => {
    // Trava o projeto para o limite não ser furado por cliques simultâneos.
    await tx.$queryRaw`SELECT "id" FROM "projects" WHERE "id" = ${projectId} FOR UPDATE`;
    const count = await tx.athleteMark.count({ where: { mediaAssetId: asset.id } });
    if (count >= MAX_MARKS_PER_VIDEO) {
      throw new AppError("VALIDATION", `Limite de ${MAX_MARKS_PER_VIDEO} marcações por vídeo. Remova uma para adicionar outra.`);
    }
    return tx.athleteMark.create({
      data: { projectId, mediaAssetId: asset.id, timeMs: input.timeMs, x: input.x, y: input.y },
      select: { id: true, timeMs: true, x: true, y: true, createdAt: true },
    });
  });
}

export async function deleteAthleteMark(userId: string, markId: string) {
  const mark = await db.athleteMark.findFirst({ where: { id: markId, project: { userId } } });
  if (!mark) throw notFound("Marcação");
  await db.athleteMark.delete({ where: { id: mark.id } });
}

export async function updateAthleteInfo(userId: string, projectId: string, raw: unknown) {
  await getOwnedProject(userId, projectId);
  const input = athleteInfoSchema.parse(raw);
  return db.project.update({
    where: { id: projectId },
    data: { jerseyColor: input.jerseyColor, jerseyNumber: input.jerseyNumber },
    select: { jerseyColor: true, jerseyNumber: true },
  });
}
