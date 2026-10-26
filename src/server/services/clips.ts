import { z } from "zod";
import { db } from "../db";
import { AppError, notFound } from "../errors";
import { getSettings } from "../settings";
import { parseTimecode } from "@/lib/timecode";
import { CLIP_CATEGORIES, CLIP_RANGE_MESSAGES, validateClipRange } from "@/lib/clips";
import { getOwnedProject } from "./projects";

/**
 * Lances marcados manualmente. Horários chegam como texto (MM:SS, HH:MM:SS ou segundos)
 * e são convertidos/validados aqui, no servidor — a validação do navegador é só conveniência.
 */

export const clipInputSchema = z.object({
  start: z.string().max(20),
  end: z.string().max(20),
  title: z
    .string()
    .trim()
    .max(80, "Título com no máximo 80 caracteres.")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  category: z
    .enum(CLIP_CATEGORIES)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null))
    .transform((v) => v ?? null),
  notes: z
    .string()
    .trim()
    .max(500, "Observações com no máximo 500 caracteres.")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export type ClipInput = z.input<typeof clipInputSchema>;

async function resolveRange(projectId: string, input: z.output<typeof clipInputSchema>) {
  const start = parseTimecode(input.start);
  if (!start.ok) throw new AppError("VALIDATION", `Início: ${start.error}`);
  const end = parseTimecode(input.end);
  if (!end.ok) throw new AppError("VALIDATION", `Fim: ${end.error}`);

  const settings = await getSettings();
  const asset = await db.mediaAsset.findFirst({
    where: { projectId, status: "READY" },
    orderBy: { createdAt: "desc" },
    select: { durationMs: true },
  });
  const error = validateClipRange(
    { startMs: start.ms, endMs: end.ms },
    { videoDurationMs: asset?.durationMs ?? null, maxClipMs: settings.maxClipDurationSeconds * 1000 },
  );
  if (error) {
    const extra = error === "TOO_LONG" ? ` O máximo é ${settings.maxClipDurationSeconds} segundos.` : "";
    throw new AppError("VALIDATION", CLIP_RANGE_MESSAGES[error] + extra);
  }
  return { startMs: start.ms, endMs: end.ms, maxClips: settings.maxClipsPerJob };
}

export async function addClip(userId: string, projectId: string, rawInput: ClipInput) {
  await getOwnedProject(userId, projectId);
  const input = clipInputSchema.parse(rawInput);
  const { startMs, endMs, maxClips } = await resolveRange(projectId, input);

  return db.$transaction(async (tx) => {
    // Trava o projeto para numerar posições sem corrida entre duas inclusões simultâneas.
    await tx.$queryRaw`SELECT "id" FROM "projects" WHERE "id" = ${projectId} FOR UPDATE`;
    const count = await tx.clip.count({ where: { projectId } });
    if (count >= maxClips) throw new AppError("VALIDATION", `Limite de ${maxClips} lances por projeto.`);
    return tx.clip.create({
      data: {
        projectId,
        position: count + 1,
        startMs,
        endMs,
        title: input.title,
        category: input.category,
        notes: input.notes,
      },
    });
  });
}

async function getOwnedClip(userId: string, clipId: string) {
  const clip = await db.clip.findFirst({ where: { id: clipId, project: { userId } } });
  if (!clip) throw notFound("Lance");
  return clip;
}

export async function updateClip(userId: string, clipId: string, rawInput: ClipInput) {
  const clip = await getOwnedClip(userId, clipId);
  const input = clipInputSchema.parse(rawInput);
  const { startMs, endMs } = await resolveRange(clip.projectId, input);
  return db.clip.update({
    where: { id: clip.id },
    data: { startMs, endMs, title: input.title, category: input.category, notes: input.notes },
  });
}

export async function deleteClip(userId: string, clipId: string) {
  const clip = await getOwnedClip(userId, clipId);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "projects" WHERE "id" = ${clip.projectId} FOR UPDATE`;
    await tx.clip.delete({ where: { id: clip.id } });
    const rest = await tx.clip.findMany({ where: { projectId: clip.projectId }, orderBy: { position: "asc" }, select: { id: true } });
    for (const [i, c] of rest.entries()) {
      await tx.clip.update({ where: { id: c.id }, data: { position: i + 1 } });
    }
  });
}

export async function moveClip(userId: string, clipId: string, direction: "up" | "down") {
  const clip = await getOwnedClip(userId, clipId);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "projects" WHERE "id" = ${clip.projectId} FOR UPDATE`;
    const current = await tx.clip.findUniqueOrThrow({ where: { id: clip.id } });
    const neighbor = await tx.clip.findFirst({
      where: {
        projectId: clip.projectId,
        position: direction === "up" ? { lt: current.position } : { gt: current.position },
      },
      orderBy: { position: direction === "up" ? "desc" : "asc" },
    });
    if (!neighbor) return;
    await tx.clip.update({ where: { id: current.id }, data: { position: neighbor.position } });
    await tx.clip.update({ where: { id: neighbor.id }, data: { position: current.position } });
  });
}

/** Ordena os lances pelo horário de início (atalho útil após marcar fora de ordem). */
export async function sortClipsByTime(userId: string, projectId: string) {
  await getOwnedProject(userId, projectId);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "projects" WHERE "id" = ${projectId} FOR UPDATE`;
    const clips = await tx.clip.findMany({ where: { projectId }, orderBy: [{ startMs: "asc" }, { position: "asc" }] });
    for (const [i, c] of clips.entries()) {
      await tx.clip.update({ where: { id: c.id }, data: { position: i + 1 } });
    }
  });
}
