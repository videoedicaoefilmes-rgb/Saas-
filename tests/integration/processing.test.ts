import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UnrecoverableError, type Job } from "bullmq";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { getStorage } from "@/server/storage";
import { closeQueues, getProcessingQueue, type ProcessingJobData } from "@/server/queue";
import { getBalance } from "@/server/services/credits";
import { planProcessing, runProcessingJob, startProcessing } from "@/server/services/processing";
import { getExportDownloadUrl, getJobZipManifest } from "@/server/services/exports";
import { updateSettings } from "@/server/settings";
import { processProcessingJob } from "../../worker/processors";
import { createUser, resetDb, testFfmpeg } from "../helpers";
import { giveCredits, readyProject } from "./flow-helpers";

function durationOf(file: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString();
  return Number(out);
}

function localPath(key: string) {
  return path.resolve(getEnv().STORAGE_LOCAL_DIR, key);
}

async function start(userId: string, projectId: string, key = randomUUID()) {
  const plan = await planProcessing(userId, projectId);
  return startProcessing(userId, { projectId, idempotencyKey: key, expectedCredits: plan.estimate.credits });
}

function fakeBullJob(jobId: string, attemptsMade: number, attempts = 3): Job<ProcessingJobData> {
  return { data: { jobId }, attemptsMade, opts: { attempts } } as unknown as Job<ProcessingJobData>;
}

describe("processamento de vídeo", () => {
  beforeAll(async () => {
    await getProcessingQueue().obliterate({ force: true });
  });
  beforeEach(resetDb);
  afterAll(async () => {
    await getProcessingQueue().obliterate({ force: true });
    await closeQueues();
  });

  it("três lances → três MP4 cortados com precisão, créditos consumidos corretamente", async () => {
    const u = await createUser();
    await giveCredits(u.id, 10);
    const { project } = await readyProject(u.id, [
      ["00:05", "00:12.5"],
      ["0:20", "0:31"],
      ["45", "58"],
    ]);

    const plan = await planProcessing(u.id, project.id);
    expect(plan.blockers).toEqual([]);
    expect(plan.estimate).toMatchObject({ clipCount: 3, billableSeconds: 8 + 11 + 13, credits: 1 });

    const { job, duplicate } = await start(u.id, project.id);
    expect(duplicate).toBe(false);
    expect(await getBalance(u.id)).toBe(9); // reservado

    expect(await runProcessingJob(job.id, testFfmpeg, 1)).toBe("SUCCEEDED");
    const done = await db.processingJob.findUniqueOrThrow({ where: { id: job.id }, include: { exports: { orderBy: { position: "asc" } } } });
    expect(done.status).toBe("SUCCEEDED");
    expect(done.creditStatus).toBe("CAPTURED");
    expect(done.processingMs).toBeGreaterThan(0);
    expect(Number(done.outputBytes)).toBeGreaterThan(0);
    expect(await getBalance(u.id)).toBe(9);

    expect(done.exports.map((e) => e.filename)).toEqual([
      "joao_silva_final_sub-15_lance_001.mp4",
      "joao_silva_final_sub-15_lance_002.mp4",
      "joao_silva_final_sub-15_lance_003.mp4",
    ]);
    const expected = [7.5, 11, 13];
    done.exports.forEach((e, i) => {
      expect(e.status).toBe("DONE");
      const d = durationOf(localPath(e.storageKey));
      expect(Math.abs(d - expected[i]!)).toBeLessThan(0.15);
    });

    const url = await getExportDownloadUrl(u.id, done.exports[0]!.id);
    expect(url).toContain("/api/storage/local?t=");
    const zip = await getJobZipManifest(u.id, job.id);
    expect(zip.zipName).toBe("joao_silva_final_sub-15_lances.zip");
    expect(zip.entries).toHaveLength(3);
  });

  it("margens antes/depois são aplicadas e limitadas ao vídeo", async () => {
    const u = await createUser();
    await giveCredits(u.id, 10);
    const { project } = await readyProject(u.id, [["00:01", "00:05"], ["00:55", "00:59"]], { paddingBeforeSeconds: 2, paddingAfterSeconds: 3 });
    const plan = await planProcessing(u.id, project.id);
    expect(plan.clips.map((c) => [c.startMs, c.endMs])).toEqual([
      [0, 8_000],
      [53_000, 60_000],
    ]);
  });

  it("modo rápido (sem recodificar) é mais impreciso no início — trade-off documentado", async () => {
    const u = await createUser();
    await giveCredits(u.id, 10);
    const { project } = await readyProject(u.id, [["00:15", "00:25"]], { cutMode: "FAST" });
    const { job } = await start(u.id, project.id);
    await runProcessingJob(job.id, testFfmpeg, 1);
    const exp = await db.export.findFirstOrThrow({ where: { jobId: job.id } });
    // Keyframes a cada 10 s no vídeo de teste: o corte rápido pode começar até 5 s antes.
    expect(durationOf(localPath(exp.storageKey))).toBeGreaterThanOrEqual(9.9);
  });

  it("mesma chave de idempotência não cria nem cobra um segundo processamento", async () => {
    const u = await createUser();
    await giveCredits(u.id, 10);
    const { project } = await readyProject(u.id, [["00:05", "01:00"]]);
    const key = randomUUID();
    const [a, b] = await Promise.all([start(u.id, project.id, key), start(u.id, project.id, key)]);
    expect(a.job.id).toBe(b.job.id);
    expect(await db.processingJob.count()).toBe(1);
    expect(await getBalance(u.id)).toBe(9);
  });

  it("não permite dois processamentos ativos no mesmo projeto", async () => {
    const u = await createUser();
    await giveCredits(u.id, 10);
    const { project } = await readyProject(u.id, [["00:05", "00:10"]]);
    await start(u.id, project.id);
    await expect(start(u.id, project.id)).rejects.toThrow(/já está sendo processado/);
    expect(await getBalance(u.id)).toBe(9);
  });

  it("recusa quando o custo mudou desde a confirmação", async () => {
    const u = await createUser();
    await giveCredits(u.id, 10);
    const { project } = await readyProject(u.id, [["00:05", "00:10"]]);
    await updateSettings({ billingMinCredits: 2 }, u.id);
    await expect(startProcessing(u.id, { projectId: project.id, idempotencyKey: randomUUID(), expectedCredits: 1 })).rejects.toThrow(/custo foi atualizado/);
    expect(await getBalance(u.id)).toBe(10);
  });

  it("recusa sem créditos suficientes e sem cobrar", async () => {
    const u = await createUser();
    const { project } = await readyProject(u.id, [["00:05", "00:10"]]);
    await expect(start(u.id, project.id)).rejects.toThrow(/insuficientes/);
    expect(await db.processingJob.count()).toBe(0);
  });

  it("falha definitiva: job FAILED e créditos reembolsados automaticamente", async () => {
    const u = await createUser();
    await giveCredits(u.id, 10);
    const { project, storageKey } = await readyProject(u.id, [["00:05", "00:10"], ["00:20", "00:30"]]);
    const { job } = await start(u.id, project.id);
    expect(await getBalance(u.id)).toBe(9);

    await getStorage().delete(storageKey); // simula vídeo de origem corrompido/indisponível

    // Tentativas intermediárias: erro propagado para a fila tentar de novo, sem reembolso ainda.
    await expect(processProcessingJob(fakeBullJob(job.id, 0))).rejects.toThrow();
    expect((await db.processingJob.findUniqueOrThrow({ where: { id: job.id } })).creditStatus).toBe("HELD");

    // Última tentativa: falha definitiva + reembolso.
    await expect(processProcessingJob(fakeBullJob(job.id, 2))).rejects.toBeInstanceOf(UnrecoverableError);
    const failed = await db.processingJob.findUniqueOrThrow({ where: { id: job.id }, include: { exports: true } });
    expect(failed.status).toBe("FAILED");
    expect(failed.creditStatus).toBe("REFUNDED");
    expect(failed.errorMessage).toMatch(/créditos foram devolvidos/);
    expect(failed.exports.every((e) => e.status === "FAILED")).toBe(true);
    expect(await getBalance(u.id)).toBe(10);

    // Reprocessar um job já finalizado não cobra nem processa novamente.
    expect(await runProcessingJob(job.id, testFfmpeg, 4)).toBe("SKIPPED");
    expect(await getBalance(u.id)).toBe(10);
  });

  it("lance fora da duração do vídeo bloqueia o processamento", async () => {
    const u = await createUser();
    await giveCredits(u.id, 10);
    const { project } = await readyProject(u.id, [["00:05", "00:10"]]);
    await db.clip.create({ data: { projectId: project.id, position: 2, startMs: 70_000, endMs: 80_000 } });
    const plan = await planProcessing(u.id, project.id);
    expect(plan.blockers.join(" ")).toMatch(/ultrapassa a duração/);
    await expect(start(u.id, project.id)).rejects.toThrow(/ultrapassa/);
  });

  it("processamento pausado pelo administrador é recusado", async () => {
    const u = await createUser();
    await giveCredits(u.id, 10);
    const { project } = await readyProject(u.id, [["00:05", "00:10"]]);
    await updateSettings({ processingPaused: true }, u.id);
    await expect(start(u.id, project.id)).rejects.toThrow(/pausados/);
  });
});
