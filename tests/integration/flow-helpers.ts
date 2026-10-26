import { statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { postCreditTransaction } from "@/server/services/credits";
import { completeUpload, probeAsset, requestUpload } from "@/server/services/media";
import { createProject, type ProjectInput } from "@/server/services/projects";
import { addClip } from "@/server/services/clips";
import { fixtures } from "../fixtures/videos";
import { putLocalObject, testFfmpeg } from "../helpers";

export async function giveCredits(userId: string, amount: number) {
  await db.$transaction((tx) => postCreditTransaction(tx, { userId, type: "TEST_GRANT", amount, idempotencyKey: randomUUID() }));
}

/** Projeto com vídeo de 60 s pronto (READY) e os lances informados. */
export async function readyProject(userId: string, clips: Array<[string, string]>, project: Partial<ProjectInput> = {}) {
  const p = await createProject(userId, { name: "Final do campeonato", athleteName: "João Silva", matchName: "Final Sub-15", ...project });
  const size = statSync(fixtures.mp4).size;
  const { assetId } = await requestUpload(userId, { projectId: p.id, filename: "final.mp4", sizeBytes: size, rightsConfirmed: true });
  const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
  await putLocalObject(asset.storageKey, fixtures.mp4);
  await completeUpload(userId, assetId);
  await probeAsset(assetId, testFfmpeg);
  for (const [start, end] of clips) await addClip(userId, p.id, { start, end, title: null, category: null, notes: null });
  return { project: p, assetId, storageKey: asset.storageKey };
}
