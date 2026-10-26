import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { closeQueues, getProcessingQueue } from "@/server/queue";
import { getOwnedProject, getProjectDetail, updateProject, deleteProject, listProjects } from "@/server/services/projects";
import { addClip, deleteClip, moveClip, updateClip, sortClipsByTime } from "@/server/services/clips";
import { completeUpload, getAssetPlaybackUrl, getAssetStatus, requestUpload } from "@/server/services/media";
import { getOwnedJob, listJobs, planProcessing, runProcessingJob, startProcessing } from "@/server/services/processing";
import { getExportDownloadUrl, getExportPreviewUrl, getJobZipManifest } from "@/server/services/exports";
import { listTransactions } from "@/server/services/credits";
import { createUser, resetDb, testFfmpeg } from "../helpers";
import { giveCredits, readyProject } from "./flow-helpers";

async function expectNotFound(p: Promise<unknown>) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err, "deveria ter sido bloqueado").toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe("NOT_FOUND");
}

describe("isolamento entre usuários (IDOR)", () => {
  let owner: { id: string };
  let intruder: { id: string };
  let projectId: string;
  let assetId: string;
  let clipId: string;
  let jobId: string;
  let exportId: string;

  beforeAll(async () => {
    await resetDb();
    await getProcessingQueue().obliterate({ force: true });
    owner = await createUser({ email: "dono@teste.dev" });
    intruder = await createUser({ email: "intruso@teste.dev" });
    await giveCredits(owner.id, 10);
    await giveCredits(intruder.id, 10);
    const r = await readyProject(owner.id, [["00:05", "00:10"]]);
    projectId = r.project.id;
    assetId = r.assetId;
    clipId = (await db.clip.findFirstOrThrow({ where: { projectId } })).id;
    const plan = await planProcessing(owner.id, projectId);
    const { job } = await startProcessing(owner.id, { projectId, idempotencyKey: randomUUID(), expectedCredits: plan.estimate.credits });
    jobId = job.id;
    await runProcessingJob(jobId, testFfmpeg, 1);
    exportId = (await db.export.findFirstOrThrow({ where: { jobId } })).id;
  });

  afterAll(async () => {
    await getProcessingQueue().obliterate({ force: true });
    await closeQueues();
  });

  it("o dono acessa normalmente", async () => {
    await expect(getOwnedProject(owner.id, projectId)).resolves.toBeTruthy();
    await expect(getExportDownloadUrl(owner.id, exportId)).resolves.toContain("t=");
  });

  it("projetos de outro usuário não são lidos, alterados nem excluídos", async () => {
    await expectNotFound(getOwnedProject(intruder.id, projectId));
    await expectNotFound(getProjectDetail(intruder.id, projectId));
    await expectNotFound(updateProject(intruder.id, projectId, { name: "hackeado" }));
    await expectNotFound(deleteProject(intruder.id, projectId));
    expect(await listProjects(intruder.id)).toHaveLength(0);
  });

  it("lances de outro usuário não são criados, alterados, movidos nem excluídos", async () => {
    await expectNotFound(addClip(intruder.id, projectId, { start: "1", end: "2" }));
    await expectNotFound(updateClip(intruder.id, clipId, { start: "1", end: "2" }));
    await expectNotFound(moveClip(intruder.id, clipId, "down"));
    await expectNotFound(deleteClip(intruder.id, clipId));
    await expectNotFound(sortClipsByTime(intruder.id, projectId));
    expect(await db.clip.count({ where: { projectId } })).toBe(1);
  });

  it("vídeos de outro usuário não são enviados, lidos nem reproduzidos", async () => {
    await expectNotFound(requestUpload(intruder.id, { projectId, filename: "x.mp4", sizeBytes: 100, rightsConfirmed: true }));
    await expectNotFound(completeUpload(intruder.id, assetId));
    await expectNotFound(getAssetPlaybackUrl(intruder.id, assetId));
    await expectNotFound(getAssetStatus(intruder.id, assetId));
  });

  it("processamentos e arquivos de outro usuário não são acessados", async () => {
    await expectNotFound(planProcessing(intruder.id, projectId));
    await expectNotFound(startProcessing(intruder.id, { projectId, idempotencyKey: randomUUID(), expectedCredits: 1 }));
    await expectNotFound(getOwnedJob(intruder.id, jobId));
    await expectNotFound(getExportDownloadUrl(intruder.id, exportId));
    await expectNotFound(getExportPreviewUrl(intruder.id, exportId));
    await expectNotFound(getJobZipManifest(intruder.id, jobId));
    expect(await listJobs(intruder.id)).toHaveLength(0);
  });

  it("histórico de créditos é individual", async () => {
    const mine = await listTransactions(intruder.id);
    expect(mine.every((t) => t.jobId === null)).toBe(true);
  });
});
