import { z } from "zod";
import { db } from "../db";
import { AppError, notFound } from "../errors";
import { audit } from "../audit";
import { getStorage } from "../storage";
import { projectPrefix } from "../storage/keys";
import { logger } from "../logger";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const projectInputSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome ao projeto (mínimo 2 caracteres).").max(120, "Nome muito longo."),
  athleteName: optionalText(80),
  teamName: optionalText(80),
  matchName: optionalText(120),
  matchDate: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.")
    .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null)),
  cutMode: z.enum(["PRECISE", "FAST"]).default("PRECISE"),
  paddingBeforeSeconds: z.coerce.number().int().min(0, "Margem mínima: 0 s.").max(30, "Margem máxima: 30 s.").default(0),
  paddingAfterSeconds: z.coerce.number().int().min(0, "Margem mínima: 0 s.").max(30, "Margem máxima: 30 s.").default(0),
});

export type ProjectInput = z.input<typeof projectInputSchema>;

function toData(input: z.output<typeof projectInputSchema>) {
  return {
    name: input.name,
    athleteName: input.athleteName,
    teamName: input.teamName,
    matchName: input.matchName,
    matchDate: input.matchDate,
    cutMode: input.cutMode,
    paddingBeforeMs: input.paddingBeforeSeconds * 1000,
    paddingAfterMs: input.paddingAfterSeconds * 1000,
  };
}

export async function createProject(userId: string, input: ProjectInput) {
  const data = toData(projectInputSchema.parse(input));
  return db.project.create({ data: { ...data, userId } });
}

/**
 * Busca um projeto garantindo que pertence ao usuário. Projetos de outros usuários
 * respondem exatamente como inexistentes (proteção contra IDOR).
 */
export async function getOwnedProject(userId: string, projectId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw notFound("Projeto");
  return project;
}

export async function updateProject(userId: string, projectId: string, input: ProjectInput) {
  await getOwnedProject(userId, projectId);
  const data = toData(projectInputSchema.parse(input));
  return db.project.update({ where: { id: projectId }, data });
}

export async function listProjects(userId: string, opts: { take?: number } = {}) {
  return db.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: opts.take ?? 100,
    select: {
      id: true,
      name: true,
      athleteName: true,
      matchName: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { clips: true } },
      mediaAssets: {
        where: { status: { not: "DELETED" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, durationMs: true },
      },
      processingJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, createdAt: true },
      },
    },
  });
}

/** Detalhe completo para a página do projeto. */
export async function getProjectDetail(userId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    include: {
      clips: { orderBy: { position: "asc" } },
      mediaAssets: { where: { status: { not: "DELETED" } }, orderBy: { createdAt: "desc" }, take: 1 },
      processingJobs: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!project) throw notFound("Projeto");
  const { mediaAssets, ...rest } = project;
  return { ...rest, asset: mediaAssets[0] ?? null };
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  await getOwnedProject(userId, projectId);
  const active = await db.processingJob.count({ where: { projectId, status: { in: ["QUEUED", "RUNNING"] } } });
  if (active > 0) {
    throw new AppError("CONFLICT", "Aguarde o processamento em andamento terminar antes de excluir o projeto.");
  }
  // Arquivos primeiro: se a remoção do armazenamento falhar, o registro continua e a ação pode ser repetida.
  const removed = await getStorage().deletePrefix(projectPrefix(userId, projectId));
  await db.project.delete({ where: { id: projectId } });
  await audit({ actorUserId: userId, action: "project.delete", targetType: "Project", targetId: projectId, metadata: { filesRemoved: removed } });
  logger.info({ userId, projectId, filesRemoved: removed }, "Projeto excluído");
}
